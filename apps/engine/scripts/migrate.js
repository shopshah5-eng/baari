'use strict';
/* Apply supabase/migrations/*.sql to DATABASE_URL.
   Usage: npm run migrate            (real Postgres / Supabase)
          npm run migrate -- --mem  (in-memory pg-mem, prints what would run) */
const { connect, migrate } = require('../src/sql/db');

(async () => {
  const mem = process.argv.includes('--mem') || !process.env.DATABASE_URL;
  if (!mem && !process.env.DATABASE_URL) { console.error('DATABASE_URL missing (use --mem to dry-run)'); process.exit(1); }
  const conn = await connect({ mem });
  console.log(`\nBaari migrate → ${conn.kind}`);
  const res = await migrate(conn, { verbose: true });
  console.log('\napplied:', res.applied.join(', '));
  if (res.skipped.length) console.log('skipped:', res.skipped.length, '(pg-mem only — these run on real Postgres)');
  await conn.close();
  console.log('done\n');
})();
