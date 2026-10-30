'use strict';
/* Per-provider ETA engine. See docs/08-scheduling-and-eta-engine.md
   - durations come from the SERVICE when known, else the provider's learned average
   - EWMA learns from real called->done times; after 5 samples it beats the configured average
   - every ETA is a WINDOW (+/- 5 min), never a false point estimate
   - nothing here is ever global: a patient only ever sees THEIR provider's queue */
const S = require('./store');

const ACTIVE = ['BOOKED', 'ARRIVED', 'CALLED', 'IN_CONSULT'];

function bucket(date = new Date()) {
  const h = Number(new Date(date).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }));
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

function statsFor(orgId, providerId) {
  return S.load().provider_stats.find(s => s.org_id === orgId && s.provider_id === providerId) || null;
}

function serviceFor(orgId, serviceId) {
  return S.load().services.find(s => s.id === serviceId) || null;
}

/* minutes this token will consume */
function durationOf(orgId, token) {
  const svc = token.service_id ? serviceFor(orgId, token.service_id) : null;
  const prov = S.load().providers.find(p => p.id === token.provider_id) || {};
  const sf = prov.speed_factor || 1;
  if (svc && svc.duration_min) return Math.max(2, Math.round(svc.duration_min * sf));
  const st = statsFor(orgId, token.provider_id);
  if (st && st.samples >= 5) return Math.max(2, Math.round(st.ewma_minutes));
  return Math.max(2, Math.round((prov.avg_minutes || 10) * sf));
}

function queueOf(orgId, providerId, day = S.istDay()) {
  return S.tokensToday(orgId, day)
    .filter(t => t.provider_id === providerId && ACTIVE.includes(t.state))
    .sort((a, b) => (a.priority - b.priority) || (a.number - b.number));
}

/* returns { startAt, endAt, position, ahead, label } for one token */
function etaFor(orgId, token) {
  const prov = S.load().providers.find(p => p.id === token.provider_id) || {};
  const q = queueOf(orgId, token.provider_id, token.day);
  const idx = q.findIndex(t => t.id === token.id);
  const ahead = idx < 0 ? 0 : idx;
  const now = new Date();

  // 1. when does the provider actually become free?
  const nowServing = q.find(t => t.state === 'CALLED' || t.state === 'IN_CONSULT');
  let cursor = now;
  if (nowServing && nowServing.id !== token.id) {
    const started = nowServing.called_at ? new Date(nowServing.called_at) : now;
    const expected = S.addMin(started, durationOf(orgId, nowServing));
    // if the consultation is running long, that's real, and it moves everyone
    cursor = expected > now ? expected : now;
  }

  // 2. add up everyone ahead of this token
  for (const t of q.slice(0, ahead)) {
    if (t.state === 'CALLED' || t.state === 'IN_CONSULT') continue; // already counted above
    cursor = S.addMin(cursor, durationOf(orgId, t));
  }

  // 2b. an explicit "doctor delayed +15m" pushes this provider's availability forward
  if (prov.delay_until && new Date(prov.delay_until) > cursor) cursor = new Date(prov.delay_until);

  // 3. lunch / break creep
  const brk = minutesUntilBreak(prov);
  if (brk !== null && S.minsBetween(now, cursor) > brk) cursor = S.addMin(cursor, 30);

  // 4. committed appointments win: never show earlier than the promise
  if (token.committed_at) {
    const c = new Date(token.committed_at);
    if (c > cursor) cursor = c;
  }

  const isNow = (nowServing && nowServing.id === token.id) || ahead === 0;
  const startAt = cursor;
  const endAt = S.addMin(cursor, durationOf(orgId, token));
  return {
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    position: idx < 0 ? null : idx + 1,
    ahead,
    isNow,
    label: isNow ? 'abhi' : windowLabel(startAt, endAt)
  };
}

/* "~6:15–6:25 PM" — a window, never "6:17" */
function windowLabel(a, b) {
  const f = d => new Date(d).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true });
  const s = round5(a), e = S.addMin(round5(a), Math.max(10, S.minsBetween(a, b)));
  return '~' + f(s).replace(' ', '') + '–' + f(e).replace(' ', '');
}
function round5(d) {
  const t = new Date(d); t.setSeconds(0, 0);
  t.setMinutes(Math.round(t.getMinutes() / 5) * 5);
  return t;
}

/* per-city travel estimate. GPS pin overrides this when the patient shares one. */
const CITY_FACTOR = { ludhiana: 2.4, jalandhar: 2.3, patiala: 2.2, chandigarh: 2.8, default: 2.2 };
const LOCALITY = {
  ludhiana: {
    'model town': { 'sarabha nagar': 12, 'dugri': 18, 'haibowal': 22, 'civil lines': 10, 'brs nagar': 14, 'sahnewal': 35, 'khanna': 50, 'pakhowal road': 16, 'kitchlu nagar': 8 },
    'sarabha nagar': { 'model town': 12, 'dugri': 16, 'brs nagar': 6, 'civil lines': 14 }
  }
};
function travelMinutes(org, fromText) {
  if (!fromText) return { minutes: 20, source: 'default' };
  const city = (org.city || 'ludhiana').toLowerCase();
  const key = s => (s || '').toLowerCase().trim();
  const table = LOCALITY[city] || {};
  const findLoc = txt => Object.keys(table).find(loc => key(txt).includes(loc)) ||
                         (table['model town'] && Object.keys(table['model town']).find(loc => key(txt).includes(loc))) || null;
  const from = findLoc(fromText);
  const to = findLoc(org.area);
  if (from && to) {
    if (from === to) return { minutes: 8, source: 'locality' };
    const m = (table[from] && table[from][to]) || (table[to] && table[to][from]);
    if (m) return { minutes: m, source: 'locality' };
  }
  if (from) return { minutes: 15, source: 'locality' };
  return { minutes: 20, source: 'default' };
}
function travelFromPin(km) {
  const f = CITY_FACTOR.default;
  return Math.min(90, Math.max(8, Math.round(km * f + 5)));
}
function leaveBy(etaStartISO, travel) {
  const l = S.addMin(etaStartISO, -(travel + 10));
  const t = round5(l);
  return t.toISOString();
}

function minutesUntilBreak(prov) {
  // provider.hours = {lunch:['14:00','16:00']} in IST
  if (!prov.hours || !prov.hours.lunch) return null;
  const [lh, lm] = prov.hours.lunch[0].split(':').map(Number);
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const lunch = new Date(ist); lunch.setHours(lh, lm, 0, 0);
  const diff = (lunch - ist) / 60000;
  return diff > 0 && diff < 90 ? diff : null;
}

/* ---- self-learning: called -> done ---- */
function learn(orgId, token) {
  if (!token.called_at || !token.done_at) return null;
  const actual = S.minsBetween(token.called_at, token.done_at);
  if (actual < 2) return { actual, skipped: 'too_short_to_learn' };
  const d = S.load();
  let st = d.provider_stats.find(s => s.org_id === orgId && s.provider_id === token.provider_id);
  if (!st) {
    st = { id: S.id('ps'), org_id: orgId, provider_id: token.provider_id, samples: 0, ewma_minutes: actual, bucket: bucket(), updated_at: new Date().toISOString() };
    d.provider_stats.push(st);
  }
  const a = 0.3;
  st.ewma_minutes = st.samples === 0 ? actual : Math.round((a * actual + (1 - a) * st.ewma_minutes) * 10) / 10;
  st.samples += 1;
  st.updated_at = new Date().toISOString();
  S.save();
  return { actual, ewma: st.ewma_minutes, samples: st.samples };
}

module.exports = { etaFor, durationOf, queueOf, windowLabel, travelMinutes, travelFromPin, leaveBy, learn, statsFor, bucket, round5 };
