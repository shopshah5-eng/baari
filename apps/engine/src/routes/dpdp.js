'use strict';
/* DPDP Act 2023: full export in one tap, hard delete on request. */
const S = require('../store');
const D = require('../exportdpdp');

module.exports = function mount(app) {
  const org = req => S.org(req.params.slug);

  app.get('/api/:slug/export', (req, res) => {
    const o = org(req); if (!o) return res.status(404).json({ error: 'no tenant' });
    const data = D.exportOrg(o.id);
    res.setHeader('Content-Disposition', `attachment; filename="baari-${o.slug}-export.json"`);
    res.json(data);
  });

  app.get('/api/:slug/export/csv', (req, res) => {
    const o = org(req); if (!o) return res.status(404).json({ error: 'no tenant' });
    const files = D.exportCsvBundle(o.id);
    const bundle = Object.entries(files).map(([name, csv]) => `### ${name}\n${csv}\n`).join('\n');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="baari-${o.slug}-export.txt"`);
    res.send(bundle);
  });

  app.delete('/api/:slug', (req, res) => {
    const o = org(req); if (!o) return res.status(404).json({ error: 'no tenant' });
    if (req.body?.confirm !== o.slug) return res.status(400).json({ error: 'type the slug to confirm' });
    const r = D.deleteOrg(o.id);
    res.json({ ok: true, ...r });
  });
};
