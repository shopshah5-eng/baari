'use strict';
const S = require('../store');
const GW = require('../wa-gateway');

module.exports = function mount(app) {
  const org = req => S.org(req.params.slug);

  app.get('/api/:slug/wa/status', (req, res) => {
    const o = org(req); if (!o) return res.status(404).json({ error: 'no tenant' });
    const st = GW.status(o.id);
    const d = S.load();
    const row = (d.wa_sessions || []).find(r => r.org_id === o.id);
    const sent = (d.messages || []).filter(m => m.org_id === o.id && m.direction === 'out');
    res.json({
      ...st, configured: o.wa, stored: row ? { status: row.status, last_seen_at: row.last_seen_at, creds_backed_up: !!row.creds_enc } : null,
      messages_today: sent.filter(m => new Date(m.created_at).toDateString() === new Date().toDateString()).length,
      failed_last_24h: sent.filter(m => m.status === 'failed').length
    });
  });

  /* QR over SSE — the owner scans it in WhatsApp > Linked devices */
  app.post('/api/:slug/wa/connect', async (req, res) => {
    const o = org(req); if (!o) return res.status(404).json({ error: 'no tenant' });
    const r = await GW.startBaileys(o, {
      onMessage: async (organization, msg) => require('../bot').handle(organization, msg)
    });
    if (!r.ok) return res.status(400).json({ ...r, hint: 'npm i @whiskeysockets/baileys, ya WA_LANE=mock rakhein' });
    res.json({ ok: true, status: r.status, stream: `/api/${o.slug}/wa/qr` });
  });

  app.get('/api/:slug/wa/qr', (req, res) => {
    const o = org(req); if (!o) return res.status(404).json({ error: 'no tenant' });
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    send('status', GW.status(o.id));
    const off = GW.subscribe(o.id, send);
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => { clearInterval(ping); off && off(); });
  });

  /* QR payload → PNG (the owner scans this in WhatsApp > Linked devices) */
  app.get('/api/:slug/wa/qr.png', async (req, res) => {
    const QR = require('qrcode');
    if (!req.query.d) return res.status(400).json({ error: 'no payload' });
    const buf = await QR.toBuffer(String(req.query.d), { margin: 1, width: 380, color: { dark: '#0B7A6B', light: '#FFFFFF' } });
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    res.end(buf);
  });

  app.post('/api/:slug/wa/logout', async (req, res) => {
    const o = org(req); if (!o) return res.status(404).json({ error: 'no tenant' });
    await GW.logout(o.id);
    res.json({ ok: true });
  });

  /* Official Meta lane credentials (encrypted at rest by the caller's KMS in prod) */
  app.post('/api/:slug/wa/meta', (req, res) => {
    const o = org(req); if (!o) return res.status(404).json({ error: 'no tenant' });
    const { phone_number_id, token, waba_id } = req.body || {};
    if (!phone_number_id || !token) return res.status(400).json({ error: 'phone_number_id aur token chahiye' });
    o.wa = { ...(o.wa || {}), lane: 'both', meta: { phone_number_id, token, waba_id: waba_id || null }, status: o.wa?.status || 'pending' };
    S.save();
    res.json({ ok: true, lane: o.wa.lane });
  });

  app.post('/api/:slug/wa/test', async (req, res) => {
    const o = org(req); if (!o) return res.status(404).json({ error: 'no tenant' });
    const phone = require('../security').normPhone(req.body?.phone || o.owner_phone);
    const r = await GW.deliver(o, phone, '✅ Baari test message — WhatsApp lane working hai.', { kind: 'transactional' });
    res.json(r);
  });
};
