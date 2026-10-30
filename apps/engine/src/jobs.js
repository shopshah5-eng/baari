'use strict';
/* Background jobs: two-ahead alerts, review asks, follow-up ladder.
   In production these live in BullMQ/Redis + cron. */
const S = require('./store');
const WA = require('./wa');
const Q = require('./queue');
const ETA = require('./eta');
const Leads = require('./leads');
const Review = require('./review');

const fmt = iso => new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', '');

/* 🔔 the flagship: only when 2 (or fewer) patients are ahead, and only once */
function twoAhead(org) {
  const cands = Q.twoAheadCandidates(org);
  for (const t of cands) {
    const p = S.load().patients.find(x => x.id === t.patient_id);
    if (!p || p.blocked) continue;
    const prov = S.load().providers.find(x => x.id === t.provider_id) || {};
    const e = ETA.etaFor(org.id, t);
    const mins = Math.max(3, S.minsBetween(new Date(), e.startAt));
    const travel = t.travel_minutes || 20;
    const leaveBy = ETA.leaveBy(e.startAt, travel);
    const urgent = mins <= travel + 12;

    WA.send(org, p.phone,
      e.ahead === 0
        ? `🎫 *Aapka number ab hai!*\n\nToken ${Q.tokenLabel(org.id, t)} · ${prov.name}${prov.room ? ' · ' + prov.room : ''}\nKripya cabin ke paas aayein.`
        : urgent
        ? `🔔 *${(p.name || '').split(' ')[0] || 'Aap'}, ab nikalne ka time hai!*\n\nAapki baari ~*${mins} min* me. Aapse pehle sirf *${e.ahead} log* hain.\n🎫 Token ${Q.tokenLabel(org.id, t)} · ${prov.name}${prov.room ? ' · ' + prov.room : ''}\n🚗 Niklein: *${fmt(leaveBy)}* (${travel} min raasta)\n\n_Aa rahe hain? Reply karein._`
        : `🔔 *Aapki baari paas aa rahi hai*\n\nToken ${Q.tokenLabel(org.id, t)} · ${prov.name}\nAapse pehle ${e.ahead} log · anumaanit *${ETA.windowLabel(e.startAt, e.endAt)}*\n🚗 Ghar se *${fmt(leaveBy)}* niklein.\n\n_Taiyar ho jayein 🙏_`,
      { template: 'two_ahead_alert', buttons: ['✅ Nikal raha hoon', '⏰ 15 min late'] });
    Q.markAlerted(t, 'two_ahead');
  }
  return cands.length;
}

/* post-visit review ask (no Google API needed — link only) */
function reviews(org) {
  const delay = org.settings.review_delay_minutes ?? 120;
  const due = S.load().tokens.filter(t => t.org_id === org.id && t.state === 'DONE' && t.done_at &&
    S.minsBetween(t.done_at, new Date()) >= delay && !S.load().review_asks.some(a => a.token_id === t.id));
  let n = 0;
  for (const t of due) { const r = Review.askReview(org, t); if (r.asked) n++; }
  return n;
}

/* follow-up ladder with anti-ban caps (docs/07 §4) */
const COPY = [
  'Sir/ma\'am, koi sawaal hai? Price ya time ke baare me bata dein 🙏',
  'Doctor ke paas kal *11:30 AM* aur *6:15 PM* khali hai. Book kar dein?',
  'Aapne treatment ke liye poochha tha — abhi bhi takleef hai? Aaj hi dikha lein.',
  'Koi baat nahi 🙂 jab zarurat ho, yahin message kar dein. Aapka number humare paas hai.'
];
function followups(org) {
  const scale = org.settings.followup_scale || 60; // demo = minutes, prod = hours
  const now = new Date();
  let n = 0;
  for (const l of S.load().leads.filter(x => x.org_id === org.id && !x.do_not_contact)) {
    if (!['enquiry', 'quoted', 'slot_offered'].includes(l.stage)) continue;
    if (!l.last_inbound_at) continue;
    const step = l.followups_sent || 0;
    if (step >= Leads.LADDER.length) continue;
    const sinceMin = S.minsBetween(l.last_inbound_at, now);
    const threshold = Leads.LADDER[step] * scale;
    if (sinceMin < threshold) continue;
    if (sinceMin > 72 * scale && !(org.settings.campaigns_allowed)) continue; // 72h Baileys safety
    const r = WA.send(org, l.phone, COPY[step], { template: 'followup_' + (step + 1), kind: 'followup', buttons: step === 0 ? ['Price poochhna hai', '❌ Nahi chahiye'] : undefined });
    if (r && !r.held) { l.followups_sent = step + 1; n++; }
  }
  if (n) S.save();
  return n;
}

function tick() {
  for (const org of S.load().orgs) {
    try {
      Q.recalc(org);
      twoAhead(org);
      reviews(org);
      followups(org);
    } catch (e) { console.error('job error', org.slug, e.message); }
  }
}

module.exports = { tick, twoAhead, reviews, followups };
