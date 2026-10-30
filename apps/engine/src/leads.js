'use strict';
/* Lead CRM + revenue tracking + follow-up sequencing. See docs/07 */
const S = require('./store');

const STAGES = {
  clinic: ['enquiry', 'quoted', 'booked', 'visited', 'recalled'],
  lab: ['enquiry', 'quoted', 'collection_booked', 'collected', 'reported'],
  salon: ['enquiry', 'slot_offered', 'booked', 'attended', 'rebooked']
};
const PROB = { enquiry: 15, quoted: 40, slot_offered: 70, collection_booked: 70, booked: 90, visited: 100, collected: 100, reported: 100, attended: 100, recalled: 20, rebooked: 60, no_show: 40, lost: 0 };

function get(orgId, phone) { return S.lead(orgId, phone); }

function upsert(org, { phone, name, source = 'wa_inbound', first_message = null, intent = 'enquiry', service_interest = null, est_value = 0 }) {
  let l = S.lead(org.id, phone);
  if (!l) {
    l = {
      id: S.id('ld'), org_id: org.id, phone, name: name || null, source,
      first_message, intent, service_interest, stage: 'enquiry',
      est_value: est_value || 0, probability: PROB.enquiry, owner_id: null,
      next_action_at: S.addMin(new Date(), 120).toISOString(), next_action: 'reply',
      last_inbound_at: new Date().toISOString(), do_not_contact: false,
      created_at: new Date().toISOString(), via: null, followups_sent: 0
    };
    S.load().leads.push(l);
  } else {
    l.last_inbound_at = new Date().toISOString();
    if (name && !l.name) l.name = name;
    if (service_interest) l.service_interest = service_interest;
  }
  S.save();
  return l;
}

function setStage(org, lead, stage, extra = {}) {
  if (!lead) return;
  lead.stage = stage;
  lead.probability = PROB[stage] || lead.probability;
  lead.next_action_at = stage === 'booked' || stage === 'visited' ? null : S.addMin(new Date(), 1440).toISOString();
  lead.next_action = stage === 'booked' ? 'confirm slot' : stage === 'visited' ? null : 'follow up';
  Object.assign(lead, extra);
  S.event(org.id, 'stage_change', { lead: lead.id, stage, ...extra });
  S.save();
}

function onBooked(org, patient, token, serviceId) {
  const svc = serviceId ? S.load().services.find(s => s.id === serviceId) : null;
  const l = S.lead(org.id, patient.phone);
  if (!l) return;
  setStage(org, l, org.mode === 'lab' ? 'collection_booked' : 'booked', {
    patient_id: patient.id,
    est_value: svc ? svc.price : l.est_value
  });
}

function onVisited(org, token) {
  const p = S.load().patients.find(x => x.id === token.patient_id);
  const l = p ? S.lead(org.id, p.phone) : null;
  if (l) setStage(org, l, org.mode === 'lab' ? 'collected' : org.mode === 'salon' ? 'attended' : 'visited');
}

function onNoShow(org, token) {
  const p = S.load().patients.find(x => x.id === token.patient_id);
  const l = p ? S.lead(org.id, p.phone) : null;
  if (l) { l.stage = 'no_show'; l.probability = PROB.no_show; l.next_action = 'no-show recovery'; l.next_action_at = S.addMin(new Date(), 30).toISOString(); S.save(); }
}

function markRecovered(lead) { if (lead) { lead.via = 'recovery'; S.save(); } }

/* ---- revenue ---- */
function revenue(orgId) {
  const leads = S.load().leads.filter(l => l.org_id === orgId);
  const done = S.load().tokens.filter(t => t.org_id === orgId && t.state === 'DONE');
  const priceOf = t => { const s = t.service_id ? S.load().services.find(x => x.id === t.service_id) : null; return s ? s.price : 0; };
  const open = leads.filter(l => ['enquiry', 'quoted', 'slot_offered'].includes(l.stage));
  const booked = leads.filter(l => ['booked', 'collection_booked'].includes(l.stage));
  const recovered = leads.filter(l => l.via === 'recovery' && ['booked', 'visited', 'attended', 'collected', 'reported', 'collection_booked'].includes(l.stage));
  const leaked = leads.filter(l => l.stage === 'enquiry' && S.minsBetween(l.last_inbound_at || l.created_at, new Date()) > 240);
  return {
    pipeline: open.reduce((a, l) => a + (l.est_value || 0), 0),
    weighted: Math.round(open.reduce((a, l) => a + (l.est_value || 0) * (l.probability / 100), 0)),
    booked: booked.reduce((a, l) => a + (l.est_value || 0), 0),
    collected: done.reduce((a, t) => a + priceOf(t), 0),
    recovered: recovered.reduce((a, l) => a + (l.est_value || 0), 0),
    leakage: leaked.reduce((a, l) => a + (l.est_value || 0), 0),
    counts: {
      leads: leads.length,
      open: open.length, booked: booked.length, visited: leads.filter(l => ['visited', 'attended', 'collected', 'reported'].includes(l.stage)).length,
      noShow: leads.filter(l => l.stage === 'no_show').length,
      unreplied: leaked.length
    }
  };
}

/* today's work list — the only lead screen staff ever see */
function worklist(orgId) {
  const now = new Date();
  const ls = S.load().leads.filter(l => l.org_id === orgId && !l.do_not_contact);
  const out = { urgent: [], followup: [], offered: [], today: [] };
  for (const l of ls) {
    if (l.stage === 'enquiry') out.urgent.push(l);
    else if (l.stage === 'quoted' && l.next_action_at && new Date(l.next_action_at) <= S.addMin(now, 60)) out.followup.push(l);
    else if (['slot_offered', 'collection_booked'].includes(l.stage)) out.offered.push(l);
    else if (['booked'].includes(l.stage)) out.today.push(l);
  }
  return out;
}

/* follow-up ladder: 2h, 24h, 72h, 7d — with hard anti-ban caps */
const LADDER = [2, 24, 72, 168];
function dueFollowups(orgId, now = new Date()) {
  const org = S.orgById(orgId);
  const cap = { max3in7d: 3, max1in24h: 1 };
  return S.load().leads.filter(l => {
    if (l.org_id !== orgId || l.do_not_contact) return false;
    if (!['enquiry', 'quoted', 'slot_offered'].includes(l.stage)) return false;
    if (!l.last_inbound_at) return false;                        // we only reply to people who spoke to us
    const step = l.followups_sent || 0;
    if (step >= LADDER.length) return false;
    const sinceH = S.minsBetween(l.last_inbound_at, now) / 60;
    if (sinceH < LADDER[step]) return false;
    if (sinceH > 72 && !(l.consent_marketing)) return false;     // 72h rule (Baileys safety)
    return true;
  });
}

function monthlyReport(orgId) {
  const org = S.orgById(orgId);
  const r = revenue(orgId);
  const fb = S.load().feedback.filter(f => f.org_id === orgId);
  const waitMins = S.load().tokens.filter(t => t.org_id === orgId && t.called_at && t.checked_in_at && t.state === 'DONE')
    .map(t => S.minsBetween(t.checked_in_at, t.called_at));
  const avgWait = waitMins.length ? Math.round(waitMins.reduce((a, b) => a + b, 0) / waitMins.length) : 0;
  return {
    org: org.name, month: new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }),
    enquiry: r.counts.leads, booked: r.counts.booked, visited: r.counts.visited,
    revenue: r.collected, recovered: r.recovered, leaked: r.leakage, unreplied: r.counts.unreplied,
    reviews: fb.length, avgRating: fb.length ? (fb.reduce((a, f) => a + f.rating, 0) / fb.length).toFixed(1) : '—',
    avgWait
  };
}

module.exports = { get, upsert, setStage, onBooked, onVisited, onNoShow, markRecovered, revenue, worklist, dueFollowups, monthlyReport, LADDER, STAGES };
