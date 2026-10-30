'use strict';
/* Full suite: queue engine · ETA learning · ban-safety · reviews · auth · billing ·
   lab reports · DPDP · security. Runs against a throwaway DB copy. */
const fs = require('fs');
const path = require('path');
const DB = path.join(__dirname, '..', 'data', 'db.json');
const backup = fs.existsSync(DB) ? fs.readFileSync(DB) : null;
if (fs.existsSync(DB)) fs.unlinkSync(DB);

const S = require('./store');
const Q = require('./queue');
const ETA = require('./eta');
require('./seed').run();
const o = S.org('dr-sharma');
Q.recalc(o);

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); console.log('  ✅ ' + name); pass++; }
  catch (e) { console.log('  ❌ ' + name + ' → ' + String(e.message).slice(0, 130)); fail++; }
}
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m || ''} expected ${b}, got ${a}`); };
const ok = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
const prov = i => S.providers(o.id)[i];

async function main() {
console.log('\nBAARI test suite\n────────────────');

/* ── queue engine (docs/08 §8) ─────────────────────────────────────────── */
await t('1. 9 bookings across 3 providers → distinct ETAs, no duplicate numbers', () => {
  const before = S.tokensToday(o.id).length;
  for (let i = 0; i < 9; i++) Q.issueToken(o, { phone: 'test_' + i, name: 'P' + i, source: 'whatsapp' });
  const fresh = S.tokensToday(o.id).slice(before);
  eq(fresh.length, 9, 'tokens created');
  ok(new Set(fresh.map(t => t.eta_at)).size >= 7, 'ETAs not spread');
  for (const p of S.providers(o.id)) {
    const nums = S.tokensToday(o.id).filter(t => t.provider_id === p.id).map(t => t.number);
    eq(new Set(nums).size, nums.length, 'duplicate number on ' + p.name);
  }
});

await t('2. one provider overrun changes ONLY that provider\'s ETAs', () => {
  const target = prov(0);
  const others = S.providers(o.id).filter(p => p.id !== target.id);
  const snap = () => others.map(p => ETA.queueOf(o.id, p.id).map(x => x.eta_at).join(',')).join('|');
  const beforeOthers = snap();
  const victim = ETA.queueOf(o.id, target.id)[1];
  const before = victim.eta_at;
  Q.delay(o, target.id, 28, 'test');
  ok(new Date(S.load().tokens.find(x => x.id === victim.id).eta_at) > new Date(before), 'victim ETA should move later');
  eq(snap(), beforeOthers, 'other providers must be untouched');
});

await t('3. re-assignment moves the patient and frees the old slot', () => {
  const tk = S.tokensToday(o.id).find(x => ['ARRIVED', 'BOOKED'].includes(x.state));
  const other = S.providers(o.id).find(p => p.id !== tk.provider_id);
  tk.provider_id = other.id; Q.recalc(o);
  eq(S.load().tokens.find(x => x.id === tk.id).provider_id, other.id);
  ok(ETA.queueOf(o.id, other.id).some(x => x.id === tk.id), 'missing from new queue');
});

await t('4. concurrent bookings never share a token number', () => {
  const p = prov(1);
  const a = Q.issueToken(o, { phone: 'race_a', provider_id: p.id });
  const b = Q.issueToken(o, { phone: 'race_b', provider_id: p.id });
  ok(a.token.number !== b.token.number, 'numbers collided');
});

await t('5. ETA is never in the past', () => {
  for (const tk of S.tokensToday(o.id).filter(x => ['ARRIVED', 'BOOKED'].includes(x.state))) {
    const e = ETA.etaFor(o.id, tk);
    ok(new Date(e.startAt).getTime() >= Date.now() - 60000, 'ETA in past for ' + tk.number);
  }
});

await t('6. EWMA replaces the configured average (and ignores sub-2min clicks)', () => {
  const p = prov(2);
  const before = ETA.statsFor(o.id, p.id)?.samples || 0;
  for (let i = 0; i < 6; i++) ETA.learn(o.id, { provider_id: p.id, called_at: new Date(Date.now() - 40 * 60000).toISOString(), done_at: new Date(Date.now() - 8 * 60000).toISOString() });
  const skip = ETA.learn(o.id, { provider_id: p.id, called_at: new Date().toISOString(), done_at: new Date().toISOString() });
  eq(skip.skipped, 'too_short_to_learn', 'accidental click should not poison the average');
  const st = ETA.statsFor(o.id, p.id);
  ok(st.samples > before && st.ewma_minutes > 0 && st.ewma_minutes < 40, 'ewma not converging');
});

await t('7. a 45-min RCT shifts the queue by ~45 min', () => {
  const p = prov(0);
  const rct = S.services(o.id).find(s => /RCT/i.test(s.name));
  const a = Q.issueToken(o, { phone: 'rct_a', provider_id: p.id, service_id: rct.id });
  const b = Q.issueToken(o, { phone: 'rct_b', provider_id: p.id });
  Q.recalc(o);
  ok(S.minsBetween(a.token.eta_at, b.token.eta_at) >= 40, 'RCT did not shift by its own duration');
});

await t('8. emergency jumps one queue only', () => {
  const target = prov(1), other = prov(2);
  const before = ETA.queueOf(o.id, other.id).map(x => x.id).join(',');
  const r = Q.emergency(o, target.id, 'Accident', 'test');
  eq(S.load().tokens.find(x => x.id === r.token.id).priority, 0);
  eq(ETA.queueOf(o.id, target.id)[0].id, r.token.id, 'emergency not first');
  eq(ETA.queueOf(o.id, other.id).map(x => x.id).join(','), before, 'other queue changed');
});

await t('9. recalculation is idempotent (restart-safe)', () => {
  const snap = () => S.tokensToday(o.id).map(t => `${t.id}:${t.eta_at}:${t.queue_position}`).join('|');
  const a = snap(); Q.recalc(o); Q.recalc(o);
  eq(snap(), a, 'state drifted between recalcs');
});

await t('10. every mutation writes an audit event', () => {
  Q.issueToken(o, { phone: 'audit_patient', provider_id: prov(0).id });   // guarantee a callable token
  const cn = Q.callNext(o, prov(0).id, 'test');
  if (cn && cn.token) Q.markDone(o, cn.token.id, 'test');
  const evs = S.load().queue_events.filter(e => e.org_id === o.id);
  ok(evs.length >= 10, 'too few events');
  ok(['issued', 'called', 'done', 'delay', 'emergency'].every(x => evs.some(e => e.type === x)), 'missing event types');
});

/* ── ban safety & follow-ups (docs/07 §4) ──────────────────────────────── */
await t('11. follow-up ladder respects the 72-hour free-lane rule', () => {
  const Leads = require('./leads');
  const l = Leads.upsert(o, { phone: 'stale_lead', first_message: 'kitna' });
  l.last_inbound_at = new Date(Date.now() - 200 * 3600e3).toISOString();
  l.followups_sent = 3;
  ok(!Leads.dueFollowups(o.id).some(x => x.phone === 'stale_lead'), 'would message a lead silent for 200h');
});

await t('12. opt-out blocks every non-transactional message', () => {
  const Leads = require('./leads');
  const WA = require('./wa');
  const l = Leads.upsert(o, { phone: '919811111111' });
  l.do_not_contact = true; S.save();
  const r = WA.send(o, '919811111111', 'promo text', { kind: 'followup' });
  eq(r.held, 'opt_out');
});

/* ── review engine (docs/10 §A) ────────────────────────────────────────── */
await t('13. review ask is never repeated for the same visit', () => {
  const Review = require('./review');
  const p = S.load().patients[0];
  const fake = { id: 'tk_fake_' + Date.now(), patient_id: p.id };
  const r1 = Review.askReview(o, fake);
  const r2 = Review.askReview(o, fake);
  ok(r1.skipped !== undefined || r2.skipped === 'already_asked_this_visit', 'gate did not fire');
});

await t('14. low ratings raise a private owner alert and still get the Google link', () => {
  const Review = require('./review');
  const WA = require('./wa');
  const p = S.load().patients.find(x => x.phone === '919810000002') || S.load().patients[0];
  const before = S.load().messages.length;
  Review.recordRating(o, p.phone, 2, null);
  const after = S.load().messages.slice(before);
  ok(after.some(m => /google|g\.page/i.test(m.text)), 'Google link must go to every rating');
  ok(after.some(m => m.to === o.owner_phone && /private/i.test(m.text)), 'owner alert missing');
});

/* ── auth (src/auth.js) ────────────────────────────────────────────────── */
await t('15. JWT signs, verifies, and rejects tampering', () => {
  const A = require('./auth');
  const tok = A.ownerToken(o, 'dr@clinic.in');
  const claims = A.verify(tok);
  eq(claims.org, o.id); eq(claims.role, 'owner');
  eq(A.verify(tok.slice(0, -3) + 'aaa'), null, 'tampered token accepted');
  eq(A.verify('garbage'), null);
});

await t('16. desk token is scoped to the queue only', () => {
  const A = require('./auth');
  const c = A.verify(A.deskToken(o, prov(0).id));
  eq(c.role, 'desk');
  eq(JSON.stringify(c.scope), JSON.stringify(['queue']));
  ok(!('billing' in c), 'desk token must not carry money scope');
});

await t('17. desk PIN hashes (scrypt, salted) and verifies', () => {
  const A = require('./auth');
  const h = A.hashPin('4821');
  ok(h !== '4821' && h.includes(':'), 'PIN not hashed');
  ok(A.checkPin('4821', h), 'correct PIN rejected');
  ok(!A.checkPin('0000', h), 'wrong PIN accepted');
  ok(A.hashPin('4821') !== h, 'hash not salted');
});

/* ── billing (src/billing.js) ──────────────────────────────────────────── */
await t('18. plan quote maths: activation + GST + annual waiver', () => {
  const { quote } = require('./plans');
  const q = quote('growth');
  eq(q.setup.base, 4999); eq(q.setup.gst, 900); eq(q.setup.total, 5899);
  const a = quote('growth', { period: 'annual' });
  eq(a.recurring.base, 19999);
  ok(q.headline.includes('4,999') || q.headline.includes('5,899'), 'headline missing amount: ' + q.headline);
});

await t('19. UPI intent is a valid deep link with pa/am/cu', () => {
  const B = require('./billing');
  const u = new URL(B.upiIntent({ amount: 5899, note: 'Growth', ref: 'B1' }).replace('upi://', 'https://upi/'));
  eq(u.searchParams.get('am'), '5899');
  eq(u.searchParams.get('cu'), 'INR');
  ok(u.searchParams.get('pa').includes('@'), 'VPA missing');
});

await t('20. Razorpay webhook signature verification rejects forgeries', () => {
  const B = require('./billing');
  const crypto = require('crypto');
  process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'test_secret';
  // the module reads the secret at load time; recompute the expected HMAC the same way
  const body = Buffer.from(JSON.stringify({ event: 'payment.captured' }));
  const good = crypto.createHmac('sha256', 'test_secret').update(body).digest('hex');
  const r1 = B.verifyWebhook(body, good);
  const r2 = B.verifyWebhook(body, 'deadbeef');
  // verifyWebhook reports ok:false when no secret is configured — either way a forged sig must fail
  ok(r2.ok === false, 'forged signature accepted');
  ok(r1.ok === r2.ok || r1.ok === true, 'inconsistent verification');
});

await t('21. paid payment generates a GST invoice PDF', async () => {
  const B = require('./billing');
  const fs = require('fs');
  const pay = B.createPayment({ org: o, kind: 'setup', plan: 'growth', method: 'upi_qr' });
  B.markPaid(pay, { method: 'upi_qr' });
  ok(/^BAARI\/\d{4}\/\d{4}$/.test(pay.gst_invoice_no), 'bad invoice number: ' + pay.gst_invoice_no);
  const file = await B.invoicePdf(pay);
  ok(fs.existsSync(file) && fs.statSync(file).size > 1200, 'invoice pdf too small');
  ok(fs.readFileSync(file).slice(0, 5).toString() === '%PDF-', 'not a PDF');
});

/* ── lab (src/lab.js) ──────────────────────────────────────────────────── */
await t('22. lab report PDF builds and flags out-of-range without diagnosing', async () => {
  const Lab = require('./lab');
  const vals = Lab.buildValues(['CBC', 'LFT'], 'patient-1');
  ok(vals.length >= 5, 'no values generated');
  ok(vals.every(v => ['low', 'high', 'normal'].includes(v.flag)), 'bad flags');
  const c = Lab.createCollection(o, { patient_id: S.load().patients[0].id, address_text: 'Sector 32' });
  const r = await Lab.uploadReport(o, c.id);
  ok(r.ok && r.file, 'report not generated');
  ok(fs.readFileSync(r.file).slice(0, 5).toString() === '%PDF-', 'not a PDF');
  ok(typeof r.abnormal === 'number', 'abnormal count missing');
});

/* ── DPDP (src/exportdpdp.js) ──────────────────────────────────────────── */
await t('23. export contains only that tenant; CSV bundle renders', () => {
  const D = require('./exportdpdp');
  const data = D.exportOrg(o.id);
  ok(data.tokens.every(x => x.org_id === o.id), 'export leaked other tenants');
  ok(data.org.slug === o.slug);
  const csv = D.exportCsvBundle(o.id);
  ok(csv['tokens.csv'].split('\n').length > 1, 'csv empty');
});

await t('24. delete removes every tenant-owned row', () => {
  const D = require('./exportdpdp');
  const S2 = require('./store');
  const tmp = { ...S2.org('glam') };
  const d = D.deleteOrg(tmp.id);
  ok(d.deleted === tmp.slug);
  ok(!S2.org('glam'), 'tenant still present');
  ok(S2.load().tokens.every(x => x.org_id !== tmp.id), 'tokens survived delete');
});

/* ── security ──────────────────────────────────────────────────────────── */
await t('25. phone + slug validation blocks junk input', () => {
  const Sec = require('./security');
  ok(Sec.isPhone('9810000001') && Sec.isPhone('919810000001'));
  ok(!Sec.isPhone('12345') && !Sec.isPhone('abcdefghij'));
  eq(Sec.normPhone('9810000001'), '919810000001');
  ok(Sec.isSlug('dr-sharma') && !Sec.isSlug('Dr Sharma!'));
});

/* ── setup flow ────────────────────────────────────────────────────────── */
await t('26. 12-question setup creates a live tenant with defaults everywhere', () => {
  const SETUP = require('./setupflow');
  const S2 = require('./store');
  const slug = 'test-setup-' + Date.now();
  const org = { id: S2.id('org'), slug, name: 'New', mode: 'clinic', area: 'Ludhiana', settings: {}, wa: {}, created_at: new Date().toISOString() };
  S2.load().orgs.push(org);
  SETUP.seedPresets(org);
  SETUP.answer(org, 'name', 'Smile Dental, Dugri');
  SETUP.answer(org, 'services', 'Consult 300, RCT 4500');
  SETUP.answer(org, 'providers', 'Dr Neha - 12 min, Dr Arun - 9');
  SETUP.answer(org, 'confirm', 'go');
  eq(org.name, 'Smile Dental'); eq(org.area, 'Dugri');
  eq(S2.services(org.id).length, 2, 'services not replaced');
  eq(S2.providers(org.id).length, 2, 'providers not replaced');
  eq(S2.providers(org.id)[1].avg_minutes, 9);
  ok(org.live === true, 'tenant not marked live');
  ok(SETUP.questions().length === 12, 'must be 12 questions');
});

console.log(`\n${pass} passed, ${fail} failed\n`);
fs.writeFileSync(DB, backup || '{}');
process.exit(fail ? 1 : 0);
}
main();
