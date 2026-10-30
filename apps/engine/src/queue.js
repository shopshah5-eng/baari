'use strict';
/* Queue engine — per-provider independent queues.
   Every mutation writes a queue_event and returns the affected tokens so the
   caller can message exactly the right patients (never a global broadcast). */
const S = require('./store');
const ETA = require('./eta');
const leadsMod = require('./leads');

const ACTIVE = ['BOOKED', 'ARRIVED', 'CALLED', 'IN_CONSULT'];

function providerCode(orgId, providerId) {
  const p = S.load().providers.find(x => x.id === providerId);
  return (p && p.code) || 'X';
}
function tokenLabel(orgId, t) { return providerCode(orgId, t.provider_id) + '-' + String(t.number).padStart(2, '0'); }

function nextNumber(orgId, providerId, day) {
  const nums = S.tokensToday(orgId, day).filter(t => t.provider_id === providerId).map(t => t.number);
  return (nums.length ? Math.max(...nums) : 0) + 1;
}

function findProvider(org, hint) {
  const provs = S.providers(org.id);
  if (!hint) return null;
  const h = String(hint).toLowerCase();
  return provs.find(p => h.includes(p.name.toLowerCase().split(' ').slice(-1)[0].toLowerCase())) ||
         provs.find(p => p.name.toLowerCase().includes(h)) || null;
}

/* earliest-available provider, with a preference bias */
function assignProvider(org, patient, serviceId) {
  const provs = S.providers(org.id);
  const lastSeen = patient && patient.last_provider_id;
  let best = null;
  for (const p of provs) {
    const q = ETA.queueOf(org.id, p.id);
    const load = q.reduce((a, t) => a + ETA.durationOf(org.id, t), 0);
    let score = load + (q.length * 0.5);
    if (lastSeen && p.id === lastSeen) score -= 6;          // continuity of care
    if (!q.length) score -= 3;
    if (!best || score < best.score) best = { p, score };
  }
  return best ? best.p : provs[0];
}

/* ---- create a token ---- */
function issueToken(org, opts) {
  const { phone, name, provider_id, service_id, reason, source = 'walkin', priority = 100, committed_at = null, travel_minutes = null, actor = null } = opts;
  const day = S.istDay();
  let patient = S.patient(org.id, phone);
  if (!patient) {
    patient = { id: S.id('pt'), org_id: org.id, phone, name: name || null, locale: org.locale || 'hi', consent: { wa: true, marketing: false }, visits: 0, blocked: false, created_at: new Date().toISOString() };
    S.load().patients.push(patient);
  } else if (name && !patient.name) patient.name = name;

  const provider = provider_id ? S.load().providers.find(p => p.id === provider_id) : assignProvider(org, patient, service_id);
  const token = {
    id: S.id('tk'), org_id: org.id, patient_id: patient.id, provider_id: provider.id, day,
    number: priority === 0 ? 0 : nextNumber(org.id, provider.id, day),
    state: 'ARRIVED', source, reason: reason || null, service_id: service_id || null,
    priority, committed_at, travel_minutes, created_at: new Date().toISOString(),
    checked_in_at: new Date().toISOString(), alerts_sent: {}, actor
  };
  S.load().tokens.push(token);
  patient.last_provider_id = provider.id;
  S.event(org.id, 'issued', { token: token.id, label: tokenLabel(org.id, token), source }, actor);
  leadsMod.onBooked(org, patient, token, service_id);
  recalc(org);
  return { token, patient, provider, label: tokenLabel(org.id, token) };
}

function recalc(org) {
  const now = new Date().toISOString();
  for (const t of S.tokensToday(org.id)) {
    if (!ACTIVE.includes(t.state)) continue;
    const e = ETA.etaFor(org.id, t);
    // round to the minute: keeps repeated recalcs identical (restart-safe) and
    // stops the patient's message and the TV from jittering by seconds
    t.eta_at = new Date(Math.round(new Date(e.startAt).getTime() / 60000) * 60000).toISOString();
    t.queue_position = e.position; t.ahead = e.ahead;
    t.leave_by_at = ETA.leaveBy(e.startAt, t.travel_minutes || 20);
  }
  S.save();
  return twoAheadCandidates(org);
}

/* which waiting patients are now 2-or-fewer away and haven't arrived */
function twoAheadCandidates(org) {
  const thresh = (org.settings && org.settings.two_ahead_threshold) || 2;
  return S.tokensToday(org.id).filter(t => {
    if (!ACTIVE.includes(t.state)) return false;
    if (t.state !== 'BOOKED' && t.state !== 'ARRIVED') return false;
    if (t.ahead === undefined || t.ahead > thresh) return false;
    if (t.alerts_sent && t.alerts_sent.two_ahead) return false;
    return true;
  });
}
function markAlerted(token, kind) {
  token.alerts_sent = token.alerts_sent || {};
  token.alerts_sent[kind] = new Date().toISOString();
  S.save();
}

function callNext(org, providerId, actor) {
  const q = ETA.queueOf(org.id, providerId);
  const cur = q.find(t => t.state === 'CALLED' || t.state === 'IN_CONSULT');
  if (cur) return { alreadyServing: cur, token: cur, label: tokenLabel(org.id, cur), idempotent: true };
  const next = q.find(t => t.state === 'ARRIVED' || t.state === 'BOOKED');
  if (!next) return { empty: true };
  next.state = 'CALLED'; next.called_at = new Date().toISOString();
  S.event(org.id, 'called', { token: next.id, label: tokenLabel(org.id, next) }, actor);
  const alerts = recalc(org);
  return { token: next, label: tokenLabel(org.id, next), alerts };
}

function markDone(org, tokenId, actor) {
  const t = S.load().tokens.find(x => x.id === tokenId && x.org_id === org.id);
  if (!t) return null;
  t.state = 'DONE'; t.done_at = new Date().toISOString();
  const pv = S.load().providers.find(p => p.id === t.provider_id);
  if (pv && pv.delay_until && new Date(pv.delay_until) <= new Date()) delete pv.delay_until;
  const learned = ETA.learn(org.id, t);
  S.event(org.id, 'done', { token: t.id, learned }, actor);
  const p = S.load().patients.find(x => x.id === t.patient_id);
  if (p) { p.visits = (p.visits || 0) + 1; p.last_visit_at = t.done_at; p.last_provider_id = t.provider_id; }
  leadsMod.onVisited(org, t);
  const alerts = recalc(org);
  return { token: t, label: tokenLabel(org.id, t), learned, alerts };
}

function skip(org, tokenId, actor) {
  const t = S.load().tokens.find(x => x.id === tokenId && x.org_id === org.id);
  if (!t) return null;
  t.state = 'SKIPPED'; t.skipped_at = new Date().toISOString();
  S.event(org.id, 'skipped', { token: t.id }, actor);
  leadsMod.onNoShow(org, t);
  recalc(org);
  return { token: t, label: tokenLabel(org.id, t) };
}

function hold(org, tokenId, minutes = 5, actor) {
  const t = S.load().tokens.find(x => x.id === tokenId && x.org_id === org.id);
  if (!t) return null;
  t.state = 'HOLD'; t.hold_until = S.addMin(new Date(), minutes).toISOString();
  S.event(org.id, 'hold', { token: t.id, minutes }, actor);
  recalc(org);
  return { token: t };
}

function arrive(org, tokenId) {
  const t = S.load().tokens.find(x => x.id === tokenId && x.org_id === org.id);
  if (!t) return null;
  t.state = t.state === 'CALLED' ? 'CALLED' : 'ARRIVED';
  t.checked_in_at = t.checked_in_at || new Date().toISOString();
  S.save();
  return { token: t };
}

function delay(org, providerId, minutes, actor) {
  const prov = S.load().providers.find(p => p.id === providerId);
  if (prov) {
    const from = prov.delay_until && new Date(prov.delay_until) > new Date() ? new Date(prov.delay_until) : new Date();
    prov.delay_until = S.addMin(from, minutes).toISOString();
  }
  const q = ETA.queueOf(org.id, providerId);
  S.event(org.id, 'delay', { provider: providerId, minutes, affected: q.length }, actor);
  recalc(org);
  return { affected: q.map(t => ({ label: tokenLabel(org.id, t), token: t })) };
}

function emergency(org, providerId, label, actor) {
  const provider = S.load().providers.find(p => p.id === providerId) || S.providers(org.id)[0];
  const res = issueToken(org, { phone: 'emg_' + Date.now(), name: label || 'Emergency', provider_id: provider.id, source: 'emergency', priority: 0, reason: 'Emergency' });
  res.token.state = 'CALLED'; res.token.called_at = new Date().toISOString(); // jump straight in
  S.event(org.id, 'emergency', { token: res.token.id, label: res.label, provider: provider.id }, actor);
  const q = ETA.queueOf(org.id, provider.id).filter(t => t.id !== res.token.id);
  recalc(org);
  return { ...res, affected: q.map(t => ({ label: tokenLabel(org.id, t), token: t })) };
}

module.exports = { issueToken, callNext, markDone, skip, hold, arrive, delay, emergency, recalc, tokenLabel, assignProvider, findProvider, twoAheadCandidates, markAlerted, providerCode };
