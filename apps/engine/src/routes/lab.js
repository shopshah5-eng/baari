'use strict';
const S = require('../store');
const Lab = require('../lab');
const fs = require('fs');

module.exports = function mount(app) {
  app.get('/api/:slug/lab/inbox', (req, res) => {
    const org = S.org(req.params.slug);
    if (!org) return res.status(404).json({ error: 'no tenant' });
    const rxs = Lab.prescriptions(org.id).map(r => ({
      ...r, patient: S.load().patients.find(p => p.id === r.patient_id) || null
    })).sort((a, b) => b.created_at.localeCompare(a.created_at));
    res.json({ prescriptions: rxs, collections: Lab.list(org.id) });
  });

  app.post('/api/:slug/lab/collection', (req, res) => {
    const org = S.org(req.params.slug);
    if (!org) return res.status(404).json({ error: 'no tenant' });
    const { prescription_id, patient_id, geo, address_text, slot_start } = req.body || {};
    const pid = patient_id || (S.load().prescriptions || []).find(r => r.id === prescription_id)?.patient_id;
    const c = Lab.createCollection(org, { prescription_id, patient_id: pid, geo, address_text, slot_start });
    res.json({ ok: true, collection: c });
  });

  /* upload / generate the report → PDF → WhatsApp to the patient */
  app.post('/api/:slug/lab/report/:collectionId', async (req, res) => {
    const org = S.org(req.params.slug);
    if (!org) return res.status(404).json({ error: 'no tenant' });
    const r = await Lab.uploadReport(org, req.params.collectionId);
    if (r.error) return res.status(404).json(r);
    res.json(r);
  });

  app.get('/api/:slug/lab/report/:collectionId.pdf', (req, res) => {
    const org = S.org(req.params.slug);
    const c = Lab.list(org?.id).find(x => x.id === req.params.collectionId);
    if (!c) return res.status(404).json({ error: 'not found' });
    const file = require('path').join(__dirname, '..', '..', 'data', 'reports', `report-${c.id}.pdf`);
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'report not generated yet' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="report-${c.id.slice(-6)}.pdf"`);
    fs.createReadStream(file).pipe(res);
  });

  /* public verification page a doctor/lab can open from the PDF footer */
  app.get('/verify/:collectionId', (req, res) => {
    const c = (S.load().collections || []).find(x => x.id === req.params.collectionId);
    if (!c) return res.status(404).send('<h3>Report not found</h3>');
    const org = S.orgById(c.org_id);
    const p = S.load().patients.find(x => x.id === c.patient_id);
    res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Report verify</title>
      <link rel="stylesheet" href="/assets/app.css"></head><body>
      <div class="wrap" style="max-width:520px;padding-top:40px">
      <div class="brand" style="font-size:22px;margin-bottom:16px"><span class="dot">#</span> baari</div>
      <div class="card pad">
        <div class="pill live">✓ Report verified</div>
        <h2 style="font-size:18px;margin:12px 0 4px">${org?.name || 'Lab'}</h2>
        <div class="muted">${c.id.slice(-8).toUpperCase()} · ${new Date(c.reported_at || c.created_at).toLocaleDateString('en-IN')}</div>
        <div class="hr"></div>
        <div class="row"><div style="flex:1"><div class="tiny">Patient</div><b>${(p?.name || 'Patient').replace(/</g, '&lt;')}</b></div>
        <div style="flex:1"><div class="tiny">Status</div><b>${c.status}</b></div></div>
        <p class="muted" style="margin-top:14px">Yeh report ${org?.name || 'lab'} ne issue ki hai. Koi bhi doubt ho to clinic se sampark karein.</p>
      </div></div></body></html>`);
  });
};
