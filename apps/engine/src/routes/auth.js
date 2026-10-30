'use strict';
const S = require('../store');
const A = require('../auth');
const Sec = require('../security');

module.exports = function mount(app) {
  const loginLimiter = Sec.rateLimit({ windowMs: 60000, max: 20 });

  app.get('/api/auth/config', (req, res) => res.json({ google: !!process.env.GOOGLE_CLIENT_ID, auth_required: A.AUTH_REQUIRED }));

  app.get('/auth/google', (req, res) => {
    const redirect = (process.env.PUBLIC_URL || 'http://localhost:3000') + '/auth/google/callback';
    if (!process.env.GOOGLE_CLIENT_ID) return res.redirect('/login?error=google_not_configured');
    res.redirect(A.googleAuthUrl(redirect, req.query.t || ''));
  });

  app.get('/auth/google/callback', loginLimiter, async (req, res) => {
    const redirect = (process.env.PUBLIC_URL || 'http://localhost:3000') + '/auth/google/callback';
    try {
      const who = await A.googleExchange(req.query.code, redirect);
      const slug = req.query.state || S.load().orgs[0]?.slug;
      const org = S.org(slug);
      if (!org) return res.redirect('/login?error=no_tenant');
      const token = A.ownerToken(org, who.email);
      res.setHeader('Set-Cookie', `baari_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${A.TTL}`);
      const d = S.load(); d.audit_log = d.audit_log || [];
      d.audit_log.push({ at: new Date().toISOString(), org_id: org.id, actor: who.email, action: 'login_google' }); S.save();
      res.redirect('/desk?t=' + org.slug);
    } catch (e) { res.redirect('/login?error=' + encodeURIComponent(e.message)); }
  });

  /* desk PIN: staff sign-in that structurally cannot reach revenue or patient history */
  app.post('/api/auth/desk-pin', loginLimiter, (req, res) => {
    const { slug, pin, provider_id } = req.body || {};
    const org = S.org(slug);
    if (!org) return res.status(404).json({ error: 'tenant not found' });
    const rec = (org.desk_pins || {})[provider_id || 'default'];
    if (!rec) return res.status(400).json({ error: 'desk PIN set nahi hai. Owner /app se set karein.' });
    if (!A.checkPin(String(pin || ''), rec)) return res.status(401).json({ error: 'galat PIN' });
    const token = A.deskToken(org, provider_id);
    res.setHeader('Set-Cookie', `baari_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${A.TTL}`);
    res.json({ ok: true, token, role: 'desk', scope: ['queue'] });
  });

  app.post('/api/:slug/desk-pin', A.requireRole('owner'), (req, res) => {
    const org = S.org(req.params.slug);
    if (!org) return res.status(404).json({ error: 'no tenant' });
    const pin = String(req.body?.pin || '');
    if (!/^\d{4}$/.test(pin)) return res.status(400).json({ error: '4-digit PIN chahiye' });
    org.desk_pins = org.desk_pins || {};
    org.desk_pins[req.body?.provider_id || 'default'] = A.hashPin(pin);
    S.save();
    res.json({ ok: true });
  });

  /* dev login — only when auth is not enforced */
  app.post('/api/auth/dev-login', (req, res) => {
    if (A.AUTH_REQUIRED) return res.status(403).json({ error: 'disabled' });
    const org = S.org(req.body?.slug || S.load().orgs[0].slug);
    if (!org) return res.status(404).json({ error: 'no tenant' });
    const token = A.ownerToken(org, 'dev@baari.local');
    res.json({ ok: true, token, role: 'owner', org: org.slug });
  });

  app.get('/api/auth/me', (req, res) => {
    const ctx = A.context(req);
    if (!ctx) return res.json({ authenticated: false, auth_required: A.AUTH_REQUIRED });
    const org = S.orgById(ctx.orgId);
    res.json({ authenticated: true, role: ctx.role, user: ctx.user, org: org?.slug, mode: ctx.via });
  });
};
