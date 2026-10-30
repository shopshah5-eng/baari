'use strict';
const path = require('path');
const fs = require('fs');
const express = require('express');

const S = require('./store');
const ETA = require('./eta');
const Q = require('./queue');
const Leads = require('./leads');
const KB = require('./kb');
const AI = require('./ai');
const Bot = require('./bot');
const Jobs = require('./jobs');
const Review = require('./review');
const Lab = require('./lab');
const WA = require('./wa');
const RT = require('./realtime');
const Sec = require('./security');
const A = require('./auth');
const B = require('./billing');

const app = express();
app.set('trust proxy', true);
app.use(Sec.headers);

/* operator routes mount first: /api/admin/* would otherwise be parsed as a tenant slug */
const mountAdmin = require('./routes/admin');

/* ── Razorpay webhook needs the raw bytes, so it mounts before the JSON parser ── */
app.post('/api/webhooks/razorpay', express.raw({ type: '*/*' }), (req, res) => {
  const sig = req.headers['x-razorpay-signature'];
  const check = B.verifyWebhook(req.body, sig);
  if (!check.ok) return res.status(400).json({ error: 'bad signature', reason: check.reason });
  let evt = {};
  try { evt = JSON.parse(req.body.toString()); } catch { return res.status(400).json({ error: 'bad json' }); }
  const payId = evt?.payload?.payment?.entity?.notes?.payment_id || evt?.payload?.order?.entity?.receipt;
  const d = S.load();
  const pay = (d.payments || []).find(p => p.id === payId || p.ref === payId || p.razorpay_order_id === evt?.payload?.order?.entity?.id);
  if (pay && (evt.event === 'payment.captured' || evt.event === 'order.paid')) {
    B.markPaid(pay, { razorpay_payment_id: evt.payload.payment.entity.id, method: 'razorpay' });
    RT.publish(pay.org_id, 'billing', { status: 'paid', id: pay.id });
  }
  res.json({ ok: true });
});

app.use(express.json({ limit: '10mb' }));
app.use('/api/v2', require('./routes/api-v2'));
mountAdmin(app);
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));
app.use('/media/reports', express.static(path.join(__dirname, '..', 'data', 'reports')));

/* tenant resolution: slug for dev/preview, JWT claim in production */
function org(req, res) {
  const o = S.org(req.params.slug);
  if (!o) { res.status(404).json({ error: 'tenant not found' }); return null; }
  return o;
}
const undoStack = {};
const snapshot = o => { undoStack[o.id] = { at: Date.now(), tokens: JSON.parse(JSON.stringify(S.load().tokens.filter(t => t.org_id === o.id))) }; };

function nameOf(t) { const p = S.load().patients.find(x => x.id === t.patient_id); return p ? (p.name || 'Walk-in') : 'Walk-in'; }
function phoneOf(t) { const p = S.load().patients.find(x => x.id === t.patient_id); return p ? p.phone : null; }
function reviewStats(orgId) {
  const fb = S.load().feedback.filter(f => f.org_id === orgId);
  const asks = S.load().review_asks.filter(a => a.org_id === orgId);
  return { asks: asks.length, ratings: fb.length, avg: fb.length ? +(fb.reduce((a, f) => a + f.rating, 0) / fb.length).toFixed(1) : null, low: fb.filter(f => f.rating <= 3).length, clicked: asks.filter(a => a.clicked_at).length };
}

/* one state builder shared by REST and SSE */
function buildState(o) {
  Q.recalc(o);
  const provs = S.providers(o.id).map(p => {
    const q = ETA.queueOf(o.id, p.id);
    const cur = q.find(t => t.state === 'CALLED' || t.state === 'IN_CONSULT') || null;
    const st = ETA.statsFor(o.id, p.id);
    return {
      id: p.id, name: p.name, code: p.code, room: p.room, specialty: p.specialty, avg_minutes: p.avg_minutes,
      learned: st ? { ewma: st.ewma_minutes, samples: st.samples } : null,
      current: cur ? { id: cur.id, label: Q.tokenLabel(o.id, cur), name: nameOf(cur), state: cur.state } : null,
      waiting: q.filter(t => t.state !== 'CALLED' && t.state !== 'IN_CONSULT').map(t => ({
        id: t.id, label: Q.tokenLabel(o.id, t), name: nameOf(t), reason: t.reason, state: t.state,
        eta: t.eta_at, ahead: t.ahead, leaveBy: t.leave_by_at, priority: t.priority, phone: phoneOf(t)
      })),
      done: S.tokensToday(o.id).filter(t => t.provider_id === p.id && t.state === 'DONE').length
    };
  });
  const todays = S.tokensToday(o.id);
  return {
    org: { slug: o.slug, name: o.name, mode: o.mode, area: o.area, city: o.city, phone: o.phone, owner: o.owner_name, wa: o.wa, settings: o.settings, plan: o.plan, locale: o.locale },
    providers: provs,
    today: { total: todays.length, done: todays.filter(t => t.state === 'DONE').length, waiting: todays.filter(t => ['ARRIVED', 'BOOKED'].includes(t.state)).length, noShow: todays.filter(t => t.state === 'SKIPPED').length },
    revenue: Leads.revenue(o.id),
    reviewStats: reviewStats(o.id),
    lab: { prescriptions: Lab.prescriptions(o.id).length, collections: Lab.list(o.id).length, pending_reports: Lab.list(o.id).filter(c => c.status !== 'reported').length }
  };
}

/* ─────────────────────────── tenants / health ─────────────────────────── */
app.get('/api/tenants', (req, res) => res.json(S.load().orgs.map(o => ({ slug: o.slug, name: o.name, mode: o.mode, area: o.area, plan: o.plan }))));
app.get('/api/health', (req, res) => res.json({ ok: true, version: require('../package.json').version, gemini: AI.hasGemini, tenants: S.load().orgs.length, store: process.env.STORE || 'json', uptime_min: Math.round(process.uptime() / 60) }));
app.get('/api/:slug/state', (req, res) => { const o = org(req, res); if (!o) return; res.json(buildState(o)); });

/* ─────────────────────────── desk actions ─────────────────────────── */
app.post('/api/:slug/walkin', Sec.idempotent(), (req, res) => {
  const o = org(req, res); if (!o) return;
  snapshot(o);
  const { name, phone, provider_id, reason, service_id } = req.body || {};
  const p = phone ? Sec.normPhone(phone) : 'walkin_' + Date.now();
  const r = Q.issueToken(o, { phone: p, name: name || 'Walk-in', provider_id: provider_id || null, service_id: service_id || null, reason: reason || 'walk-in', source: 'walkin' });
  RT.publish(o.id, 'state', buildState(o));
  res.json({ ok: true, token: { id: r.token.id, label: r.label, provider: r.provider.name, eta: r.token.eta_at } });
});

app.post('/api/:slug/call/:providerId', Sec.idempotent(5000), (req, res) => {
  const o = org(req, res); if (!o) return;
  snapshot(o);
  const r = Q.callNext(o, req.params.providerId, 'desk');
  if (r.empty) return res.json({ ok: false, empty: true });
  const t = r.token, ph = phoneOf(t);
  if (ph) {
    const prov = S.load().providers.find(p => p.id === t.provider_id) || {};
    WA.send(o, ph, `🎫 *Aapki baari aa gayi!*\n\nToken ${r.label} — kripya *${prov.room || 'cabin'}* mein aayein.\n${prov.name}`, { template: 'called' });
  }
  RT.publish(o.id, 'called', { label: r.label, name: nameOf(t), provider: t.provider_id });
  RT.publish(o.id, 'state', buildState(o));
  res.json({ ok: true, label: r.label, name: nameOf(t), idempotent: !!r.idempotent });
});

app.post('/api/:slug/token/:id/:action', (req, res) => {
  const o = org(req, res); if (!o) return;
  snapshot(o);
  const a = req.params.action;
  let out = null;
  if (a === 'done') out = Q.markDone(o, req.params.id, 'desk');
  else if (a === 'skip') out = Q.skip(o, req.params.id, 'desk');
  else if (a === 'arrive') out = Q.arrive(o, req.params.id);
  else if (a === 'hold') out = Q.hold(o, req.params.id, req.body?.minutes || 5, 'desk');
  if (!out) return res.status(404).json({ error: 'token not found' });
  RT.publish(o.id, 'state', buildState(o));
  res.json({ ok: true, learned: out.learned || null, token: { id: out.token.id, state: out.token.state } });
});

app.post('/api/:slug/delay', (req, res) => {
  const o = org(req, res); if (!o) return;
  snapshot(o);
  const { provider_id, minutes } = req.body || {};
  const r = Q.delay(o, provider_id || S.providers(o.id)[0].id, Number(minutes || 15), 'desk');
  for (const a of r.affected) {
    const ph = phoneOf(a.token);
    if (ph) WA.send(o, ph, `⏸ Doctor ${minutes} minute late hain. Aapka naya anumaanit samay: *${new Date(a.token.eta_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true })}*.\nPareshani ke liye maaf kijiye 🙏`, { template: 'delay_notice' });
  }
  RT.publish(o.id, 'delay', { minutes, affected: r.affected.length });
  RT.publish(o.id, 'state', buildState(o));
  res.json({ ok: true, affected: r.affected.length });
});

app.post('/api/:slug/emergency', (req, res) => {
  const o = org(req, res); if (!o) return;
  snapshot(o);
  const r = Q.emergency(o, req.body?.provider_id || S.providers(o.id)[0].id, req.body?.label, 'desk');
  for (const a of r.affected) {
    const ph = phoneOf(a.token);
    if (ph) WA.send(o, ph, '🚨 Ek *emergency case* aa gaya hai — unhe pehle dekha jayega.\nAapka number ~10 minute late chalega. Samajhne ke liye dhanyavaad 🙏', { template: 'emergency' });
  }
  RT.publish(o.id, 'state', buildState(o));
  res.json({ ok: true, label: r.label, affected: r.affected.length });
});

app.post('/api/:slug/undo', (req, res) => {
  const o = org(req, res); if (!o) return;
  const snap = undoStack[o.id];
  if (!snap || Date.now() - snap.at > 60000) return res.json({ ok: false, reason: 'nothing to undo' });
  const d = S.load();
  d.tokens = d.tokens.filter(t => t.org_id !== o.id).concat(snap.tokens);
  delete undoStack[o.id];
  S.save(); Q.recalc(o); RT.publish(o.id, 'state', buildState(o));
  res.json({ ok: true });
});

/* ─────────────────────────── bot ─────────────────────────── */
app.post('/api/:slug/bot', Sec.rateLimit({ windowMs: 60000, max: 120 }), async (req, res) => {
  const o = org(req, res); if (!o) return;
  const { phone = '919810000099', text = '', type = 'text', geo = null } = req.body || {};
  try { await Bot.handle(o, { phone: Sec.normPhone(phone), text, type, geo }); }
  catch (e) { console.error(e); return res.status(500).json({ error: e.message }); }
  RT.publish(o.id, 'state', buildState(o));
  res.json({ ok: true });
});

app.get('/api/:slug/inbox', (req, res) => {
  const o = org(req, res); if (!o) return;
  res.json(WA.inbox(o, req.query.phone || '919810000099', req.query.since || null));
});

app.post('/api/:slug/simulate/advance', (req, res) => {
  const o = org(req, res); if (!o) return;
  const n = { twoAhead: Jobs.twoAhead(o), reviews: Jobs.reviews(o), followups: Jobs.followups(o) };
  RT.publish(o.id, 'state', buildState(o));
  res.json({ ok: true, ...n });
});

/* review link click tracking → mark clicked, then bounce to Google (no API needed) */
app.get('/r/:tokenId', (req, res) => {
  const ask = S.load().review_asks.find(a => a.token_id === req.params.tokenId);
  if (ask) { ask.clicked_at = new Date().toISOString(); S.save(); }
  const orgId = ask ? ask.org_id : null;
  const o = orgId ? S.orgById(orgId) : null;
  const url = (o && o.settings && o.settings.google_review_url) || 'https://www.google.com/maps';
  res.redirect(url);
});

/* ─────────────────────────── leads / revenue ─────────────────────────── */
app.get('/api/:slug/leads', (req, res) => {
  const o = org(req, res); if (!o) return;
  const wl = Leads.worklist(o.id);
  const decorate = l => ({ ...l, ageMin: S.minsBetween(l.created_at, new Date()), sinceInbound: S.minsBetween(l.last_inbound_at || l.created_at, new Date()) });
  res.json({ urgent: wl.urgent.map(decorate), followup: wl.followup.map(decorate), offered: wl.offered.map(decorate), today: wl.today.map(decorate), all: S.load().leads.filter(l => l.org_id === o.id).map(decorate) });
});

app.post('/api/:slug/leads/:id/followup', (req, res) => {
  const o = org(req, res); if (!o) return;
  const l = S.load().leads.find(x => x.id === req.params.id && x.org_id === o.id);
  if (!l) return res.status(404).json({ error: 'no lead' });
  const r = WA.send(o, l.phone, req.body?.text || "Sir/ma'am, koi sawaal hai? Price ya time ke baare me bata dein 🙏", { kind: 'followup', template: 'manual_followup' });
  if (!r.held) { l.followups_sent = (l.followups_sent || 0) + 1; l.next_action_at = S.addMin(new Date(), 1440).toISOString(); S.save(); }
  res.json({ ok: true, held: r.held || null });
});

app.get('/api/:slug/revenue', (req, res) => { const o = org(req, res); if (!o) return; res.json({ revenue: Leads.revenue(o.id), report: Leads.monthlyReport(o.id) }); });

/* ─────────────────────────── knowledge base ─────────────────────────── */
app.get('/api/:slug/kb', (req, res) => { const o = org(req, res); if (!o) return; res.json(KB.docs(o.id).map(d => ({ id: d.id, source: d.source, title: d.title, text: d.text }))); });
app.post('/api/:slug/kb/ingest', (req, res) => { const o = org(req, res); if (!o) return; res.json({ ok: true, added: KB.ingestUrl(o.id, req.body?.url || 'clinic-website.in').length }); });
app.post('/api/:slug/kb/ask', (req, res) => {
  const o = org(req, res); if (!o) return;
  const hits = KB.retrieve(o.id, req.body?.q || '', 3);
  res.json({ hits: hits.map(h => ({ score: +h.score.toFixed(2), title: h.doc.title, text: h.doc.text })), threshold: 0.34 });
});

/* ─────────────────────────── public pages ─────────────────────────── */
app.get('/api/status/:tokenId', (req, res) => {
  const t = S.load().tokens.find(x => x.id === req.params.tokenId);
  if (!t) return res.status(404).json({ error: 'not found' });
  const o = S.orgById(t.org_id);
  const e = ETA.etaFor(o.id, t);
  const prov = S.load().providers.find(p => p.id === t.provider_id) || {};
  res.json({ org: o.name, area: o.area, phone: o.phone, label: Q.tokenLabel(o.id, t), state: t.state, provider: prov.name, room: prov.room, ahead: e.ahead, eta: e.startAt, leaveBy: t.leave_by_at, label_time: e.label });
});

app.get('/api/public/:slug', (req, res) => {
  const o = org(req, res); if (!o) return;
  res.json({
    org: { name: o.name, mode: o.mode, area: o.area, phone: o.phone, hours: o.hours, slug: o.slug },
    providers: S.providers(o.id).map(p => ({ id: p.id, name: p.name, room: p.room, specialty: p.specialty })),
    services: S.services(o.id).map(s => ({ id: s.id, name: s.name, price: s.price, dur: s.duration_min })),
    queue: S.providers(o.id).map(p => { const q = ETA.queueOf(o.id, p.id); return { provider: p.name, code: p.code, waiting: q.length, next_eta: q.length ? q[0].eta_at : null }; })
  });
});

app.post('/api/public/:slug/book', Sec.rateLimit({ windowMs: 60000, max: 30 }), (req, res) => {
  const o = org(req, res); if (!o) return;
  const { name, phone, provider_id, service_id } = req.body || {};
  if (!Sec.isPhone(phone)) return res.status(400).json({ error: 'valid phone chahiye' });
  const r = Q.issueToken(o, { phone: Sec.normPhone(phone), name, provider_id: provider_id || null, service_id: service_id || null, source: 'web', reason: 'web booking' });
  RT.publish(o.id, 'state', buildState(o));
  res.json({ ok: true, token: { label: r.label, provider: r.provider.name, status_url: '/status/' + r.token.id } });
});

/* ─────────────────────────── self-serve setup ─────────────────────────── */
const SETUP = require('./setupflow');
app.get('/api/setup/questions', (req, res) => res.json(SETUP.questions()));
app.post('/api/setup/start', (req, res) => {
  const { slug, name, mode, area, phone, owner_phone } = req.body || {};
  if (!Sec.isSlug(slug)) return res.status(400).json({ error: 'slug invalid' });
  if (S.org(slug)) return res.json({ ok: true, exists: true, slug });
  const o = {
    id: S.id('org'), slug, name: name || 'New Clinic', mode: mode || 'clinic', area: area || 'Ludhiana', city: 'Ludhiana',
    address: area, phone: phone || '', owner_name: 'Owner', owner_phone: owner_phone || phone || '', staff_phones: [],
    locale: 'hi', plan: 'pilot', wa: { lane: process.env.WA_LANE || 'mock', status: 'pending', phone },
    hours: {}, settings: { google_review_url: '', two_ahead_threshold: 2, demo_mode: true, review_delay_minutes: 0, followup_scale: 1 },
    created_at: new Date().toISOString()
  };
  S.load().orgs.push(o);
  SETUP.seedPresets(o);
  S.save();
  res.json({ ok: true, slug: o.slug });
});
app.post('/api/setup/answer', (req, res) => {
  const { slug, k, value } = req.body || {};
  const o = S.org(slug); if (!o) return res.status(404).json({ error: 'no tenant' });
  SETUP.answer(o, k, value);
  res.json({ ok: true });
});

/* ─────────────────────────── mount routers ─────────────────────────── */
require('./routes/auth')(app);
require('./routes/billing')(app);
require('./routes/lab')(app);
require('./routes/wa')(app);
require('./routes/dpdp')(app);
require('./routes/stream')(app, buildState);

/* ─────────────────────────── boot ─────────────────────────── */
const PORT = process.env.PORT || 3000;
if (S.load().orgs.length === 0) require('./seed').run();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🟢 Baari running on http://localhost:${PORT}`);
  console.log(`   tenants: ${S.load().orgs.map(o => o.slug).join(', ')}`);
  console.log(`   gemini: ${AI.hasGemini ? 'live' : 'mock'} · store: ${process.env.STORE || 'json'} · auth: ${A.AUTH_REQUIRED ? 'required' : 'demo'}\n`);
});

const tickMs = Number(process.env.JOB_TICK_MS || 15000);
setInterval(() => {
  try {
    const n = Jobs.tick();
    if (n) for (const o of S.load().orgs) RT.publish(o.id, 'state', buildState(o));
  } catch (e) { console.error('tick', e.message); }
}, tickMs);

module.exports = app;
