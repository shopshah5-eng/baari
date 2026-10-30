'use strict';
/* Payments: Direct UPI QR (zero MDR) + Razorpay orders + signed webhooks + GST invoice PDF. */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const S = require('./store');
const { PLANS, ADDONS, quote, withGst, GST, inr } = require('./plans');
const RZP_KEY = process.env.RAZORPAY_KEY_ID || '';
const RZP_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const UPI_VPA = process.env.UPI_VPA || 'baari@upi';
const UPI_NAME = process.env.UPI_PAYEE_NAME || 'Baari Systems';
const INVOICE_DIR = path.join(__dirname, '..', 'data', 'invoices');

/* UPI deep link — works in every Indian UPI app; render as QR client-side */
function upiIntent({ amount, note, ref }) {
  const p = new URLSearchParams({
    pa: UPI_VPA, pn: UPI_NAME, am: String(inr(amount)), cu: 'INR', tn: note || 'Baari', tr: ref || ''
  });
  return 'upi://pay?' + p.toString();
}
function upiQrDataUrl({ amount, note, ref }) {
  const QR = require('qrcode');
  return QR.toDataURL(upiIntent({ amount, note, ref }), { margin: 1, width: 420, errorCorrectionLevel: 'M' });
}

function nextInvoiceNo(orgId) {
  const d = S.load();
  d.counters = d.counters || {};
  const key = 'inv:' + new Date().getFullYear() + ':' + orgId;
  d.counters[key] = (d.counters[key] || 0) + 1;
  S.save();
  return `BAARI/${new Date().getFullYear()}/${String(d.counters[key]).padStart(4, '0')}`;
}

function createPayment({ org, kind, plan, period = 'monthly', addons = [], method = 'upi_qr' }) {
  const d = S.load();
  d.payments = d.payments || [];
  const amount = kind === 'setup' || kind === 'pilot'
    ? quote(plan, { period, addons }).setup.total
    : quote(plan, { period, addons }).recurring.total;
  const pay = {
    id: S.id('pay'), org_id: org.id, kind, plan, period, method,
    amount_inr: amount, status: 'pending', ref: 'B' + Date.now().toString(36).toUpperCase(),
    gst_invoice_no: null, created_at: new Date().toISOString()
  };
  d.payments.push(pay);
  S.event(org.id, 'payment_created', { id: pay.id, kind, amount });
  return pay;
}

/* Razorpay order (server-side; needs keys, otherwise returns a UPI-only instruction) */
async function razorpayOrder(pay) {
  if (!RZP_KEY || !RZP_SECRET) return { ok: false, reason: 'razorpay_keys_missing', fallback: 'upi_qr' };
  const auth = 'Basic ' + Buffer.from(RZP_KEY + ':' + RZP_SECRET).toString('base64');
  const r = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: auth },
    body: JSON.stringify({ amount: Math.round(pay.amount_inr * 100), currency: 'INR', receipt: pay.ref, notes: { org: pay.org_id, kind: pay.kind } })
  });
  const j = await r.json();
  if (!j.id) return { ok: false, reason: 'razorpay_error', detail: j };
  pay.razorpay_order_id = j.id; S.save();
  return { ok: true, order_id: j.id, key_id: RZP_KEY, amount: pay.amount_inr };
}

/* webhook: raw body HMAC-SHA256 of the exact bytes, compared in constant time */
function verifyWebhook(rawBody, signature) {
  if (!RZP_SECRET) return { ok: false, reason: 'no_secret' };
  const expected = crypto.createHmac('sha256', RZP_SECRET).update(rawBody).digest('hex');
  const a = Buffer.from(String(signature || '')); const b = Buffer.from(expected);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  return { ok, expected };
}

function markPaid(pay, extra = {}) {
  pay.status = 'paid';
  pay.paid_at = new Date().toISOString();
  Object.assign(pay, extra);
  if (!pay.gst_invoice_no) pay.gst_invoice_no = nextInvoiceNo(pay.org_id);
  const org = S.orgById(pay.org_id);
  if (org && pay.kind === 'setup') org.plan = pay.plan;
  if (org && pay.kind === 'subscription') {
    org.plan = pay.plan;
    org.plan_renews_at = new Date(Date.now() + (pay.period === 'annual' ? 365 : 30) * 864e5).toISOString();
  }
  S.event(pay.org_id, 'payment_paid', { id: pay.id, kind: pay.kind, amount: pay.amount_inr });
  S.save();
  return pay;
}

/* pdfkit streams asynchronously; we collect the chunks and write synchronously so
   callers can stat/read the file immediately (tests, WhatsApp attachment, email). */
function finish(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

/* GST invoice PDF (tax invoice, 18% inclusive split) */
async function invoicePdf(pay) {
  const PDF = require('pdfkit');
  const org = S.orgById(pay.org_id) || { name: 'Clinic', area: '' };
  fs.mkdirSync(INVOICE_DIR, { recursive: true });
  const file = path.join(INVOICE_DIR, `${pay.gst_invoice_no.replace(/\//g, '-')}.pdf`);
  const doc = new PDF({ size: 'A4', margin: 48 });
  const w = doc.page.width - 96;
  const base = pay.amount_inr / (1 + GST);
  const tax = pay.amount_inr - base;
  const hs = n => '₹' + Number(n).toFixed(2);

  doc.fillColor('#0B7A6B').fontSize(24).font('Helvetica-Bold').text('baari', 48, 48);
  doc.fillColor('#0F1E1B').fontSize(9).font('Helvetica').text('Baari Systems Pvt Ltd · Ludhiana, Punjab · GSTIN 03XXXXX0000X1ZX', 48, 78);
  doc.fontSize(16).font('Helvetica-Bold').text('TAX INVOICE', 48, 48, { align: 'right', width: w });
  doc.fontSize(9).font('Helvetica')
    .text('Invoice No: ' + pay.gst_invoice_no, { align: 'right', width: w })
    .text('Date: ' + new Date(pay.paid_at || Date.now()).toLocaleDateString('en-IN'))
    .text('Ref: ' + pay.ref, { align: 'right', width: w });
  let y = 130;
  doc.moveTo(48, y).lineTo(48 + w, y).strokeColor('#DCE7E3').stroke();
  y += 14;
  doc.fontSize(11).font('Helvetica-Bold').fillColor('#0F1E1B').text('Billed to', 48, y);
  doc.fontSize(11).font('Helvetica').text(org.name, 48, y + 16).text((org.area || '') + (org.city ? ', ' + org.city : ''), 48, y + 32);
  y += 64;
  const rows = [
    ['Description', 'SAC', 'Amount'],
    [`${(PLANS[pay.plan] || {}).name || 'Baari'} plan — ${pay.kind === 'setup' ? 'activation & configuration' : 'annual subscription'}`, '998314', hs(base.toFixed(2))],
    ['CGST @ 9%', '', hs((tax / 2).toFixed(2))],
    ['SGST @ 9%', '', hs((tax / 2).toFixed(2))]
  ];
  doc.font('Helvetica-Bold').fontSize(10);
  doc.rect(48, y - 6, w, 22).fill('#E6F4F1').fillColor('#0F1E1B').text('Description', 56, y);
  doc.text('SAC', 48 + w - 150, y).text('Amount', 48 + w - 80, y);
  y += 26;
  doc.font('Helvetica').fontSize(10);
  for (const r of rows.slice(1)) { doc.text(r[0], 56, y, { width: w - 220 }); doc.text(r[1], 48 + w - 150, y); doc.text(r[2], 48 + w - 80, y); y += 18; }
  y += 6;
  doc.moveTo(48, y).lineTo(48 + w, y).strokeColor('#DCE7E3').stroke();
  y += 12;
  doc.font('Helvetica-Bold').fontSize(12).text('Total (incl. GST)', 48, y).text(hs(pay.amount_inr), 48 + w - 110, y, { width: 110, align: 'right' });
  y += 34;
  doc.font('Helvetica').fontSize(8).fillColor('#6B7C78').text(
    'Payment received. Software services — SAC 998314. This is a computer-generated invoice and does not require a signature.\n' +
    'Baari: WhatsApp-first front office for clinics, labs and salons. Support: help@baari.clinic', 48, y, { width: w });
  const buf = await finish(doc);
  fs.writeFileSync(file, buf);
  pay.invoice_file = file;
  S.save();
  return file;
}

function revenueSummary() {
  const d = S.load();
  const pays = d.payments || [];
  const paid = pays.filter(p => p.status === 'paid');
  const mrr = d.orgs.reduce((a, o) => {
    const plan = PLANS[o.plan] || PLANS.pilot;
    return a + (o.plan_renews_at ? plan.monthly : (o.plan === 'pilot' ? 0 : plan.monthly));
  }, 0);
  return {
    tenants: d.orgs.length,
    paid_count: paid.length,
    collected: inr(paid.reduce((a, p) => a + p.amount_inr, 0)),
    pending: inr(pays.filter(p => p.status === 'pending').reduce((a, p) => a + p.amount_inr, 0)),
    mrr: inr(mrr), arr: inr(mrr * 12),
    by_plan: d.orgs.reduce((a, o) => (a[o.plan] = (a[o.plan] || 0) + 1, a), {})
  };
}

module.exports = { upiIntent, upiQrDataUrl, createPayment, razorpayOrder, verifyWebhook, markPaid, invoicePdf, revenueSummary, quote, PLANS, ADDONS, upiVpa: UPI_VPA, RZP_KEY };
