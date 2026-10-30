'use strict';
const S = require('../store');
const B = require('../billing');
const { PLANS, ADDONS, quote } = require('../plans');
const Sec = require('../security');
const fs = require('fs');

module.exports = function mount(app) {
  app.get('/api/plans', (req, res) => res.json({ plans: PLANS, addons: ADDONS }));

  app.post('/api/:slug/billing/quote', (req, res) => {
    const { plan = 'growth', period = 'monthly', addons = [] } = req.body || {};
    res.json(quote(plan, { period, addons }));
  });

  app.post('/api/:slug/billing/pay', Sec.rateLimit({ windowMs: 60000, max: 20 }), async (req, res) => {
    const org = S.org(req.params.slug);
    if (!org) return res.status(404).json({ error: 'no tenant' });
    const { kind = 'setup', plan = 'growth', period = 'monthly', addons = [], method = 'upi_qr' } = req.body || {};
    const pay = B.createPayment({ org, kind, plan, period, addons, method });
    const out = { payment: pay, quote: quote(plan, { period, addons }) };
    if (method === 'razorpay') {
      const order = await B.razorpayOrder(pay);
      out.razorpay = order;
      if (!order.ok) out.instruction = 'Razorpay keys nahi hain — UPI QR se payment lein';
    }
    out.upi = { intent: B.upiIntent({ amount: pay.amount_inr, note: `Baari ${plan} ${kind}`, ref: pay.ref }), qr: await B.upiQrDataUrl({ amount: pay.amount_inr, note: `Baari ${plan}`, ref: pay.ref }) };
    res.json(out);
  });

  /* operator marks a UPI payment received (owner confirms in the bank app first) */
  app.post('/api/:slug/billing/mark-paid/:payId', (req, res) => {
    const d = S.load();
    const pay = (d.payments || []).find(p => p.id === req.params.payId && p.org_id === S.org(req.params.slug)?.id);
    if (!pay) return res.status(404).json({ error: 'payment not found' });
    B.markPaid(pay, { method: 'upi_qr', confirmed_by: req.body?.by || 'manual' });
    res.json({ ok: true, invoice_no: pay.gst_invoice_no });
  });

  app.get('/api/:slug/billing/history', (req, res) => {
    const org = S.org(req.params.slug);
    if (!org) return res.status(404).json({ error: 'no tenant' });
    res.json((S.load().payments || []).filter(p => p.org_id === org.id).sort((a, b) => b.created_at.localeCompare(a.created_at)));
  });

  app.get('/api/:slug/billing/invoice/:payId.pdf', async (req, res) => {
    const org = S.org(req.params.slug);
    const pay = (S.load().payments || []).find(p => p.id === req.params.payId && p.org_id === org?.id);
    if (!pay) return res.status(404).json({ error: 'not found' });
    if (pay.status !== 'paid') return res.status(400).json({ error: 'payment pending' });
    const file = await B.invoicePdf(pay);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${pay.gst_invoice_no.replace(/\//g, '-')}.pdf"`);
    fs.createReadStream(file).pipe(res);
  });
};
