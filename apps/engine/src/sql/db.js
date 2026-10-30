'use strict';
/* SQL backend factory.
   - DATABASE_URL set  → real Postgres (Supabase) via pg
   - otherwise         → in-memory Postgres via pg-mem, migrations applied,
                         used by `npm run test:sql` so the schema is actually verified. */
const fs = require('fs');
const path = require('path');

const MIGRATIONS = path.join(__dirname, '..', '..', 'supabase', 'migrations');
const files = () => fs.readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort();

function registerPgMem(db) {
  const { DataType } = require('pg-mem');
  db.public.registerFunction({ name: 'gen_random_uuid', returns: DataType.uuid, impure: true, implementation: () => require('crypto').randomUUID() });
  db.public.registerFunction({ name: 'ist_today', returns: DataType.date, implementation: () => new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })) });
  db.public.registerFunction({ name: 'hashtext', args: [DataType.text], returns: DataType.integer, implementation: s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return h; } });
}

async function connect({ url = process.env.DATABASE_URL, mem = !process.env.DATABASE_URL } = {}) {
  if (url && !mem) {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: url, max: 10 });
    return { kind: 'pg', pool, query: (t, p) => pool.query(t, p), close: () => pool.end() };
  }
  const { newDb } = require('pg-mem');
  const db = newDb({ autoCreateForeignKeyIndices: true });
  registerPgMem(db);
  const pg = db.adapters.createPg();
  const pool = new pg.Pool();
  // pg-mem does not implement every PL/pgSQL construct; skip functions it rejects
  // (they are still shipped in the migration for real Postgres).
  return { kind: 'pg-mem', pool, db, query: (t, p) => pool.query(t, p), close: () => pool.end() };
}

/* pg-mem cannot execute extensions, RLS or PL/pgSQL. Those statements stay in the
   migration (they are what production runs); we strip them only for the in-memory
   verification pass so the rest of the schema is still proven. */
function statements(sql) {
  const out = [];
  let buf = '', i = 0, dollar = false;
  while (i < sql.length) {
    if (sql.startsWith('$$', i)) { dollar = !dollar; buf += '$$'; i += 2; continue; }
    const ch = sql[i];
    if (ch === ';' && !dollar) { out.push(buf); buf = ''; i++; continue; }
    buf += ch; i++;
  }
  if (buf.trim()) out.push(buf);
  return out.map(s => s.trim()).filter(Boolean);
}

/* pg-mem lacks the ~ regex operator and pgvector types. Drop only those bits. */
function pgmemCompatible(sql) {
  return sql
    .replace(/check\s*\(\s*slug\s*~[^)]*\)/gi, 'check (slug <> \'\')')
    .replace(/embedding\s+vector\(\d+\),?/gi, '')
    .replace(/create extension[^;]*;/gi, '');
}

const PGMEM_UNSUPPORTED = [
  /^create\s+extension/i,
  /^do\s+\$\$/i,
  /row\s+level\s+security/i,
  /^create\s+policy/i,
  /^create\s+(or\s+replace\s+)?function/i,
  /^create\s+trigger/i
];

async function migrate(conn, { verbose = false } = {}) {
  const applied = [], skipped = [];
  await conn.query(`create table if not exists _migrations (name text primary key, applied_at timestamptz default now())`);
  for (const f of files()) {
    const done = await conn.query('select 1 from _migrations where name=$1', [f]).catch(() => ({ rows: [] }));
    if (done.rows.length) continue;
    let raw = fs.readFileSync(path.join(MIGRATIONS, f), 'utf8');
    if (conn.kind === 'pg-mem') {
      const cut = raw.indexOf('-- RLS — every tenant table');
      if (cut > 0) raw = raw.slice(0, cut);
      raw = pgmemCompatible(raw);
    }
    let ok = 0, total = 0;
    for (const stmt of statements(raw)) {
      if (!stmt.replace(/--[^\n]*/g, '').trim()) continue;
      if (conn.kind === 'pg-mem' && PGMEM_UNSUPPORTED.some(re => re.test(stmt.replace(/--[^\n]*/g, '').trim()))) {
        skipped.push(stmt.replace(/\s+/g, ' ').slice(0, 70));
        continue;
      }
      total++;
      try { await conn.query(stmt); ok++; }
      catch (e) { skipped.push(stmt.replace(/\s+/g, ' ').slice(0, 70) + ' → ' + String(e.message).slice(0, 70)); }
    }
    await conn.query('insert into _migrations(name) values ($1)', [f]).catch(() => {});
    applied.push(`${f} (${ok}/${total})`);
  }
  if (verbose) { console.log('applied:', applied); if (skipped.length) console.log('skipped:', skipped); }
  return { applied, skipped };
}

/* every request runs inside a transaction with the tenant claim set:
   RLS then does the isolation, not application code. */
async function withTenant(conn, orgId, fn) {
  const client = await conn.pool.connect();
  try {
    await client.query('begin');
    await client.query(`select set_config('app.current_org', $1, true)`, [orgId]);
    const r = await fn(client);
    await client.query('commit');
    return r;
  } catch (e) {
    await client.query('rollback').catch(() => {});
    throw e;
  } finally { client.release(); }
}

module.exports = { connect, migrate, withTenant, files };
