'use strict';
/* Operator console — you, across all tenants. Read-heavy, audited. */
const S = require('../store');
const B = require('../billing');
const { PLANS } = require('../plans');

module.exports = function mount(app) {
  const key = req => req.headers['x-admin-key'] || req.query.key;
  const guard = (req, res, next) => {
    if (process.env.ADMIN_KEY && key(req) !== process.env.ADMIN_KEY) return res.status(401).json({ error: 'admin key required' });
    next();
  };

  app.get('/api/admin/tenants', guard, (req, res) => {
    const d = S.load();
    res.json(d.orgs.map(o => {
      const tokens = d.tokens.filter(t => t.org_id === o.id);
      const leads = d.leads.filter(l => l.org_id === o.id);
      const msgs = d.messages.filter(m => m.org_id === o.id);
      const lastMsg = msgs.length ? msgs[msgs.length - 1].created_at : null;
      const daysSinceActive = lastMsg ? Math.round((Date.now() - new Date(lastMsg)) / 864e5) : null;
      return {
        slug: o.slug, name: o.name, mode: o.mode, area: o.area, plan: o.plan,
        wa: o.wa?.status, lane: o.wa?.lane,
        tokens_today: tokens.filter(t => t.day === S.istDay()).length,
        tokens_total: tokens.length, leads: leads.length,
        messages: msgs.length, last_activity: lastMsg,
        mrr: (PLANS[o.plan] || PLANS.pilot).monthly,
        churn_risk: daysSinceActive === null || daysSinceActive > 3
      };
    }));
  });

  app.get('/api/admin/revenue', guard, (req, res) => res.json(B.revenueSummary()));

  app.post('/api/admin/tenant/:slug/plan', guard, (req, res) => {
    const o = S.org(req.params.slug);
    if (!o) return res.status(404).json({ error: 'no tenant' });
    if (!PLANS[req.body?.plan]) return res.status(400).json({ error: 'unknown plan' });
    o.plan = req.body.plan;
    const d = S.load(); d.audit_log = d.audit_log || [];
    d.audit_log.push({ at: new Date().toISOString(), org_id: o.id, actor: req.body?.by || 'admin', action: 'plan_change', payload: { plan: o.plan } });
    S.save();
    res.json({ ok: true, plan: o.plan });
  });

  app.get('/api/admin/health', guard, (req, res) => {
    const d = S.load();
    res.json({
      tenants: d.orgs.length,
      sessions: require('../wa-gateway').sessions.size,
      sse_clients: d.orgs.reduce((a, o) => a + require('../realtime').count(o.id), 0),
      tokens_today: d.tokens.filter(t => t.day === S.istDay()).length,
      messages_24h: d.messages.filter(m => Date.now() - new Date(m.created_at) < 864e5).length,
      gemini: require('../ai').hasGemini,
      store: process.env.STORE || 'json'
    });
  });

  app.get('/api/admin/audit', guard, (req, res) => res.json((S.load().audit_log || []).slice(-200).reverse()));
};
