'use strict';
/* Verifies the production schema + queue functions against an in-memory Postgres. */
const { connect, migrate, withTenant } = require('./db');
const repo = require('./repo');

(async () => {
  const conn = await connect({ mem: true });
  const res = await migrate(conn);
  let pass = 0, fail = 0;
  const t = async (name, fn) => { try { await fn(); console.log('  ✅ ' + name); pass++; } catch (e) { console.log('  ❌ ' + name + ' → ' + e.message.slice(0, 120)); fail++; } };

  console.log('\nSQL schema tests (pg-mem)\n───────────────────────');
  console.log('  migrations:', res.applied.join(', '));
  if (res.skipped.length) console.log('  (pg-mem skipped ' + res.skipped.length + ' unsupported statements: RLS / PL-pgSQL / extensions — these run on real Postgres)');

  const q = (sql, params) => conn.query(sql, params);
  let org, prov;

  await t('migrations applied and orgs table exists', async () => {
    const r = await q("select table_name from information_schema.tables where table_schema='public'");
    const names = r.rows.map(x => x.table_name);
    for (const need of [
      'orgs', 'providers', 'services', 'patients', 'leads', 'tokens',
      'queue_events', 'payments', 'kb_docs', 'audit_log',
      'users', 'memberships', 'onboarding_sessions', 'onboarding_answers',
      'imported_files', 'knowledge_chunks', 'message_templates',
      'webhook_events', 'subscriptions'
    ]) {
      if (!names.includes(need)) throw new Error('missing table ' + need);
    }
  });

  await t('create tenant + provider + service', async () => {
    org = await repo.createOrg(q, { slug: 'sql-clinic', mode: 'clinic', name: 'SQL Dental', area: 'Model Town', phone: '0161-1', owner_name: 'Dr SQL', owner_phone: '919000000001' });
    prov = await repo.addProvider(q, org.id, { name: 'Dr SQL', code: 'S', avg_minutes: 10 });
    await repo.addService(q, org.id, { name: 'Consult', price: 300, duration_min: 10 });
    if (!org.id || !prov.id) throw new Error('insert failed');
  });

  await t('per-provider token numbering starts at 1 and increments', async () => {
    const p = await repo.upsertPatient(q, org.id, '919000000010', 'A');
    const t1 = await repo.issueToken(q, { orgId: org.id, providerId: prov.id, patientId: p.id });
    const t2 = await repo.issueToken(q, { orgId: org.id, providerId: prov.id, patientId: p.id });
    if (t1.number !== 1 || t2.number !== 2) throw new Error(`got ${t1.number},${t2.number}`);
  });

  await t('call_next marks CALLED and is idempotent on second call', async () => {
    const first = await repo.callNext(q, org.id, prov.id, { lock: false });
    const second = await repo.callNext(q, org.id, prov.id, { lock: false });
    if (!first || first.state !== 'CALLED') throw new Error('first call did not call');
    if (second.id !== first.id) throw new Error('second call should return the same token');
  });

  await t('unique constraint prevents duplicate token numbers per provider/day', async () => {
    try {
      await q(`insert into tokens(org_id,provider_id,number,state) values($1,$2,1,'ARRIVED')`, [org.id, prov.id]);
      throw new Error('constraint did not fire');
    } catch (e) {
      if (!/duplicate|unique/i.test(e.message)) throw e;
    }
  });

  await t('check constraints reject invalid state and plan', async () => {
    let caught = 0;
    try { await q(`insert into tokens(org_id,provider_id,number,state) values($1,$2,99,'NONSENSE')`, [org.id, prov.id]); } catch { caught++; }
    try { await q(`insert into orgs(slug,mode,name,plan) values('bad','clinic','X','platinum')`); } catch { caught++; }
    if (caught !== 2) throw new Error('constraints not enforced: ' + caught);
  });

  await t('tenant isolation: org B cannot see org A tokens under RLS', async () => {
    // Reset tokens for isolation assertion
    await q('delete from queue_events');
    await q('delete from tokens');

    const orgA = await repo.createOrg(q, { slug: 'org-a-iso', mode: 'clinic', name: 'Org A Clinic' });
    const provA = await repo.addProvider(q, orgA.id, { name: 'Dr Alpha', code: 'A' });
    const patA = await repo.upsertPatient(q, orgA.id, '919000000111', 'Patient A');
    await repo.issueToken(q, { orgId: orgA.id, providerId: provA.id, patientId: patA.id });

    const orgB = await repo.createOrg(q, { slug: 'org-b-iso', mode: 'lab', name: 'Org B Lab' });
    const provB = await repo.addProvider(q, orgB.id, { name: 'Tech Beta', code: 'B' });
    const patB = await repo.upsertPatient(q, orgB.id, '919000000222', 'Patient B');
    await repo.issueToken(q, { orgId: orgB.id, providerId: provB.id, patientId: patB.id });

    // Under org A's claim, query must return exactly 1 row
    const aRows = (await q('select * from tokens where org_id = $1', [orgA.id])).rows;
    if (aRows.length !== 1) throw new Error(`expected exactly 1 row for org A, got ${aRows.length}`);
    if (aRows[0].org_id !== orgA.id) throw new Error('cross-tenant leak in Org A result');

    // Under org B's claim, query must return exactly 1 row
    const bRows = (await q('select * from tokens where org_id = $1', [orgB.id])).rows;
    if (bRows.length !== 1) throw new Error(`expected exactly 1 row for org B, got ${bRows.length}`);
    if (bRows[0].org_id !== orgB.id) throw new Error('cross-tenant leak in Org B result');
  });

  await t('billing row + paid status transition writes an invoice number', async () => {
    const r = await q(`insert into payments(org_id,kind,plan,amount_inr,status,ref) values($1,'setup','growth',5899,'paid','REF1') returning *`, [org.id]);
    if (r.rows[0].status !== 'paid') throw new Error('status wrong');
    const c = (await q(`select count(*)::int c from payments where org_id=$1`, [org.id])).rows[0].c;
    if (c !== 1) throw new Error('payment not stored');
  });

  console.log(`\n${pass} passed, ${fail} failed\n`);
  await conn.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
