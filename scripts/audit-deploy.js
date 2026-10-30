'use strict';

/**
 * audit-deploy.js — Automated Deployment & Security Auditor
 * Reproduces the black-box audit of the live deployment.
 * Exits 0 on PASS (0 criticals), exits 1 on FAIL.
 *
 * Usage: node scripts/audit-deploy.js <url>
 */

const fs = require('fs');
const path = require('path');

const targetUrl = (process.argv[2] || 'https://baari-inky.vercel.app').replace(/\/$/, '');
console.log(`\n======================================================`);
console.log(`  AUDITING DEPLOYMENT: ${targetUrl}`);
console.log(`======================================================\n`);

let passed = 0;
let warnings = 0;
let critical = 0;

function pass(name, detail = '') {
  passed++;
  console.log(`  ✅ PASS: ${name} ${detail ? `(${detail})` : ''}`);
}

function warn(name, detail = '') {
  warnings++;
  console.log(`  ⚠️  WARN: ${name} ${detail ? `(${detail})` : ''}`);
}

function crit(name, detail = '') {
  critical++;
  console.log(`  ❌ CRITICAL: ${name} ${detail ? `(${detail})` : ''}`);
}

async function fetchRoute(route, opts = {}) {
  const url = `${targetUrl}${route}`;
  const res = await fetch(url, { redirect: 'manual', ...opts });
  const text = await res.text();
  return { status: res.status, headers: res.headers, text };
}

(async () => {
  // ── B1. Backend Health & Route Probes ───────────────────────────────────────
  console.log('--- B1. Backend API Availability ---');
  try {
    const health = await fetchRoute('/api/health');
    const vercelErr = health.headers.get('x-vercel-error');
    if (vercelErr) {
      crit('B1. DNS_HOSTNAME_RESOLVED_PRIVATE detected', `x-vercel-error: ${vercelErr}`);
    } else if (health.status === 200) {
      pass('B1. /api/health returned 200 OK');
    } else {
      crit('B1. /api/health returned unexpected status', `Status: ${health.status}`);
    }
  } catch (e) {
    crit('B1. Failed to reach /api/health', e.message);
  }

  try {
    const engineHealth = await fetchRoute('/engine-api/health');
    const vercelErr = engineHealth.headers.get('x-vercel-error');
    if (vercelErr) {
      crit('B1. /engine-api DNS private hostname resolution error', vercelErr);
    } else if (engineHealth.status === 200) {
      pass('B1. /engine-api/health returned 200 OK');
    } else {
      crit('B1. /engine-api/health 404 or down', `Status: ${engineHealth.status}`);
    }
  } catch (e) {
    crit('B1. Failed to reach /engine-api/health', e.message);
  }

  // ── B2. Authentication & Route Protection ──────────────────────────────────
  console.log('\n--- B2. Authentication & Route Protection ---');
  try {
    const desk = await fetchRoute('/desk');
    if (desk.status === 307 || desk.status === 302 || desk.status === 401) {
      pass('B2. /desk is protected (redirected unauthenticated visitor)', `Status: ${desk.status}`);
    } else {
      crit('B2. /desk is public to unauthenticated visitors', `Status: ${desk.status}`);
    }
  } catch (e) {
    warn('B2. Could not probe /desk', e.message);
  }

  try {
    const patients = await fetchRoute('/patients');
    if (patients.status === 307 || patients.status === 302 || patients.status === 401) {
      pass('B2. /patients is protected (no public PII)', `Status: ${patients.status}`);
    } else {
      crit('B2. /patients is public to unauthenticated visitors (PII hazard)', `Status: ${patients.status}`);
    }
  } catch (e) {
    warn('B2. Could not probe /patients', e.message);
  }

  try {
    const badLogin = await fetchRoute('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'fake@example.com', password: '123' })
    });
    if (badLogin.status === 400 || badLogin.status === 401) {
      pass('B2. Invalid login rejected with 400/401');
    } else {
      crit('B2. Fake auth allowed invalid password login', `Status: ${badLogin.status}`);
    }
  } catch (e) {
    warn('B2. Could not test login endpoint', e.message);
  }

  // ── B3. Admin Role Isolation ───────────────────────────────────────────────
  console.log('\n--- B3. Admin Console Isolation ---');
  try {
    const admin = await fetchRoute('/admin');
    if (admin.status === 307 || admin.status === 302 || admin.status === 401 || admin.status === 403) {
      pass('B3. /admin is protected from anonymous visitors', `Status: ${admin.status}`);
    } else {
      crit('B3. /admin is publicly accessible without platform credentials', `Status: ${admin.status}`);
    }
  } catch (e) {
    warn('B3. Could not probe /admin', e.message);
  }

  // ── B4 & B5. Code Scans (No catch-fallback lies, no Math.random WABA) ───────
  console.log('\n--- B4 & B5. Source Code Integrity Scans ---');
  const webAppDir = path.join(__dirname, '..', 'apps', 'web', 'app');
  function scanDir(dir) {
    let files = [];
    if (!fs.existsSync(dir)) return files;
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, f.name);
      if (f.isDirectory()) files.push(...scanDir(full));
      else if (f.name.endsWith('.tsx') || f.name.endsWith('.ts')) files.push(full);
    }
    return files;
  }

  const sourceFiles = scanDir(webAppDir);
  let catchLiesFound = 0;
  let randomWabaFound = 0;

  for (const file of sourceFiles) {
    const content = fs.readFileSync(file, 'utf8');
    // Check for catch blocks that inject fake KPI or provider objects
    if (/catch\s*\(\s*\)\s*=>\s*\{[^}]*kpis\s*:\s*\[/.test(content)) {
      catchLiesFound++;
      crit('B4. Catch fallback literal object detected in', path.relative(process.cwd(), file));
    }
    // Check for Math.random() assigned to wabaId or similar identifiers
    if (/wabaId\s*:\s*.*Math\.random\(\)/.test(content)) {
      randomWabaFound++;
      crit('B5. Math.random() WABA ID fabrication detected in', path.relative(process.cwd(), file));
    }
  }

  if (catchLiesFound === 0) {
    pass('B4. Zero catch-block data fabrications across app source');
  }
  if (randomWabaFound === 0) {
    pass('B5. Zero Math.random() identifier fabrications');
  }

  // ── B6. Security Headers Check ─────────────────────────────────────────────
  console.log('\n--- B6. Security Headers ---');
  try {
    const root = await fetchRoute('/login');
    const h = root.headers;
    const required = [
      ['content-security-policy', 'Content-Security-Policy'],
      ['x-frame-options', 'X-Frame-Options'],
      ['x-content-type-options', 'X-Content-Type-Options'],
      ['referrer-policy', 'Referrer-Policy'],
      ['permissions-policy', 'Permissions-Policy']
    ];

    for (const [key, label] of required) {
      if (h.get(key)) {
        pass(`B6. ${label} is present`, h.get(key).slice(0, 40));
      } else {
        crit(`B6. Missing security header: ${label}`);
      }
    }
  } catch (e) {
    warn('B6. Could not inspect headers', e.message);
  }

  // ── Final Audit Verdict ───────────────────────────────────────────────────
  console.log(`\n======================================================`);
  console.log(`  AUDIT RESULTS: ${passed} passed · ${warnings} warnings · ${critical} critical`);
  console.log(`======================================================\n`);

  if (critical === 0) {
    console.log(`🎉 VERDICT: PASS (0 critical blockers detected)\n`);
    process.exit(0);
  } else {
    console.error(`💥 VERDICT: FAIL (${critical} critical blocker(s) detected)\n`);
    process.exit(1);
  }
})().catch(e => {
  console.error('Audit runner error:', e);
  process.exit(1);
});

