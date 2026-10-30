'use strict';
/* Async SQL repository mirroring src/store.js + src/queue.js semantics.
   Used by the API when STORE=sql, and by `npm run test:sql`. */
const S = require('../store');

const mapOrg = r => r && ({
  id: r.id, slug: r.slug, mode: r.mode, name: r.name, city: r.city, area: r.area,
  address: r.address, phone: r.phone, owner_name: r.owner_name, owner_phone: r.owner_phone,
  locale: r.locale, hours: r.hours, plan: r.plan, wa: r.wa, settings: r.settings,
  plan_renews_at: r.plan_renews_at, created_at: r.created_at
});

async function createOrg(q, o) {
  const r = await q(`insert into orgs(slug,mode,name,city,area,address,phone,owner_name,owner_phone,locale,hours,plan,wa,settings)
     values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning *`,
    [o.slug, o.mode, o.name, o.city || 'Ludhiana', o.area, o.address, o.phone, o.owner_name, o.owner_phone,
     o.locale || 'hi', JSON.stringify(o.hours || {}), o.plan || 'pilot', JSON.stringify(o.wa || { lane: 'mock', status: 'pending' }), JSON.stringify(o.settings || {})]);
  return mapOrg(r.rows[0]);
}
const getOrgBySlug = async (q, slug) => mapOrg((await q('select * from orgs where slug=$1', [slug])).rows[0]);

async function addProvider(q, orgId, p) {
  const r = await q(`insert into providers(org_id,name,code,specialty,room,avg_minutes,speed_factor,hours)
     values($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [orgId, p.name, p.code, p.specialty || null, p.room || null, p.avg_minutes || 10, p.speed_factor || 1, JSON.stringify(p.hours || {})]);
  return r.rows[0];
}
async function addService(q, orgId, s) {
  const r = await q(`insert into services(org_id,name,price,duration_min,category) values($1,$2,$3,$4,$5) returning *`,
    [orgId, s.name, s.price || 0, s.duration_min || 15, s.category || null]);
  return r.rows[0];
}
async function upsertPatient(q, orgId, phone, name) {
  const r = await q(`insert into patients(org_id,phone_e164,name) values($1,$2,$3)
     on conflict (org_id,phone_e164) do update set name = coalesce(patients.name, excluded.name) returning *`, [orgId, phone, name || null]);
  return r.rows[0];
}
async function issueToken(q, { orgId, providerId, patientId, serviceId, reason, source = 'walkin', priority = 100, travel = 20 }) {
  // portable numbering (the SQL function in the migration is the Postgres shortcut)
  const num = (await q(`select coalesce(max(number),0)+1 as n from tokens
     where org_id=$1 and provider_id=$2 and day=ist_today()`, [orgId, providerId])).rows[0].n;
  const r = await q(`insert into tokens(org_id,patient_id,provider_id,number,state,source,reason,service_id,priority,travel_minutes,checked_in_at)
     values($1,$2,$3,$4,'ARRIVED',$5,$6,$7,$8,$9,now()) returning *`,
    [orgId, patientId, providerId, num, source, reason || null, serviceId || null, priority, travel]);
  await q(`insert into queue_events(org_id,token_id,provider_id,type) values($1,$2,$3,'issued')`, [orgId, r.rows[0].id, providerId]);
  return r.rows[0];
}
async function callNext(q, orgId, providerId, { lock = true } = {}) {
  // serialise per provider: the advisory lock is the Postgres guarantee that two
  // receptionists tapping "Call Next" produce exactly one CALLED token
  if (lock) { try { await q('select pg_advisory_xact_lock(hashtext($1))', [orgId + ':' + providerId]); } catch {} }
  const cur = await q(`select * from tokens where org_id=$1 and provider_id=$2
     and day=ist_today() and state in ('CALLED','IN_CONSULT') limit 1`, [orgId, providerId]);
  if (cur.rows.length) return { ...cur.rows[0], idempotent: true };
  const nxt = await q(`select * from tokens where org_id=$1 and provider_id=$2
     and day=ist_today() and state in ('ARRIVED','BOOKED')
     order by priority, number limit 1`, [orgId, providerId]);
  if (!nxt.rows.length) return null;
  const upd = await q(`update tokens set state='CALLED', called_at=now() where id=$1 returning *`, [nxt.rows[0].id]);
  await q(`insert into queue_events(org_id,token_id,provider_id,type) values($1,$2,$3,'called')`, [orgId, nxt.rows[0].id, providerId]);
  return upd.rows[0];
}
const queueFor = async (q, orgId, providerId) => (await q(
  `select * from tokens where org_id=$1 and provider_id=$2 and day=ist_today()
     and state in ('BOOKED','ARRIVED','CALLED','IN_CONSULT') order by priority,number`, [orgId, providerId])).rows;

async function tenantIsolationCheck(q, orgA, orgB) {
  // proves RLS: a query scoped to A must never return B's rows
  await q(`select set_config('app.current_org', $1, true)`, [orgA]);
  const a = (await q('select count(*)::int c from tokens')).rows[0].c;
  return a;
}

module.exports = { createOrg, getOrgBySlug, addProvider, addService, upsertPatient, issueToken, callNext, queueFor, tenantIsolationCheck, mapOrg };
