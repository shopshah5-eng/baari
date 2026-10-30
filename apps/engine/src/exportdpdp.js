'use strict';
/* DPDP Act 2023: one-tap full export and hard delete. Say this in every sales pitch. */
const S = require('./store');

const TABLES = ['patients', 'leads', 'tokens', 'queue_events', 'feedback', 'review_asks', 'messages', 'prescriptions', 'collections', 'payments', 'kb_docs', 'providers', 'services'];

function exportOrg(orgId) {
  const d = S.load();
  const org = S.orgById(orgId);
  if (!org) return null;
  const out = { exported_at: new Date().toISOString(), org: { ...org } };
  for (const t of TABLES) out[t] = (d[t] || []).filter(r => r.org_id === orgId);
  return out;
}

function toCsv(rows) {
  if (!rows || !rows.length) return '';
  const keys = [...new Set(rows.flatMap(r => Object.keys(r)))];
  const esc = v => v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v).replace(/"/g, '""') : String(v).replace(/"/g, '""');
  return [keys.join(','), ...rows.map(r => keys.map(k => `"${esc(r[k])}"`).join(','))].join('\n');
}

function exportCsvBundle(orgId) {
  const data = exportOrg(orgId);
  if (!data) return null;
  const files = {};
  for (const t of TABLES) files[`${t}.csv`] = toCsv(data[t]);
  return files;
}

function deleteOrg(orgId) {
  const d = S.load();
  const org = S.orgById(orgId);
  if (!org) return null;
  for (const t of TABLES) d[t] = (d[t] || []).filter(r => r.org_id !== orgId);
  d.orgs = d.orgs.filter(o => o.id !== orgId);
  S.event(orgId, 'tenant_deleted', { slug: org.slug });
  S.saveNow();
  return { deleted: org.slug, at: new Date().toISOString() };
}

module.exports = { exportOrg, exportCsvBundle, toCsv, deleteOrg, TABLES };
