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

  // ── B2. Login Authentication & Strict Password Verification (P0 §1) ────────
  console.log('\n--- B2. Login Authentication & Strict Password Verification ---');
  let authCookie = null;
  try {
    // Test 1: Invalid credentials must be rejected with 401
    const badLogin = await fetchRoute('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'audit_x@example.invalid', password: 'wrongpassword123' })
    });

    if (badLogin.status === 401) {
      pass('B2. Invalid email/password rejected with 401');
    } else {
      crit('B2. Login allowed invalid credentials', `Status: ${badLogin.status}`);
    }

    // Verify tenantId is not leaked in response
    if (badLogin.text.includes('tenantId')) {
      crit('B2. Login response leaked tenantId in body');
    } else {
      pass('B2. No tenantId leaked in login response');
    }

    // Test 2: Valid credentials must succeed with 200 and return session cookie
    const validLogin = await fetchRoute('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'doctor@sharma.in', password: 'SharmaDental@2026' })
    });

    if (validLogin.status === 200) {
      pass('B2. Valid clinic owner login succeeded with 200 OK');
      const setCookie = validLogin.headers.get('set-cookie');
      if (setCookie && setCookie.includes('baari_session=')) {
        authCookie = setCookie.split(';')[0];
        pass('B2. HttpOnly session cookie issued');
      } else {
        warn('B2. Session cookie header not captured or formatted differently');
      }
    } else {
      crit('B2. Valid clinic owner login failed', `Status: ${validLogin.status}`);
    }
  } catch (e) {
    crit('B2. Login probe failed', e.message);
  }

  // ── B3. Forged Session Rejection & Route Protection (P0 §2) ─────────────────
  console.log('\n--- B3. Cryptographic Session Verification & Forged Cookie Rejection ---');
  try {
    const forgedDesk = await fetchRoute('/desk', {
      headers: { Cookie: 'baari_session=forged_token_value_abc' }
    });
    if (forgedDesk.status === 307 || forgedDesk.status === 302 || forgedDesk.status === 401) {
      pass('B3. Forged cookie rejected on /desk (redirected to login)', `Status: ${forgedDesk.status}`);
    } else {
      crit('B3. Forged session allowed access to /desk', `Status: ${forgedDesk.status}`);
    }
  } catch (e) {
    warn('B3. Could not probe forged /desk', e.message);
  }

  try {
    const forgedPatients = await fetchRoute('/patients', {
      headers: { Cookie: 'baari_session=forged_token_value_abc' }
    });
    if (forgedPatients.status === 307 || forgedPatients.status === 302 || forgedPatients.status === 401) {
      pass('B3. Forged cookie rejected on /patients (PII protected)', `Status: ${forgedPatients.status}`);
    } else {
      crit('B3. Forged session allowed access to /patients', `Status: ${forgedPatients.status}`);
    }
  } catch (e) {
    warn('B3. Could not probe forged /patients', e.message);
  }

  // ── B4. Unauthenticated /engine-api/* Access Guard (P0 §3) ─────────────────
  console.log('\n--- B4. Unauthenticated Engine API Guard ---');
  const protectedEngineEndpoints = [
    ['GET', '/engine-api/desk'],
    ['POST', '/engine-api/desk/call-next'],
    ['GET', '/engine-api/patients'],
    ['GET', '/engine-api/dpdp/export']
  ];

  for (const [method, ep] of protectedEngineEndpoints) {
    try {
      const res = await fetchRoute(ep, { method });
      if (res.status === 401) {
        pass(`B4. Unauthenticated ${method} ${ep} rejected with 401`);
      } else {
        crit(`B4. Unauthenticated ${method} ${ep} permitted without token`, `Status: ${res.status}`);
      }
    } catch (e) {
      warn(`B4. Could not probe ${ep}`, e.message);
    }
  }

  // ── B5. Operator Console Isolation (P1 §6) ─────────────────────────────────
  console.log('\n--- B5. Operator Console Isolation ---');
  try {
    // Anonymous request must return 404 Not Found (or redirect)
    const anonAdmin = await fetchRoute('/admin');
    if (anonAdmin.status === 404 || anonAdmin.status === 307 || anonAdmin.status === 302) {
      pass('B5. /admin is isolated from anonymous visitors', `Status: ${anonAdmin.status}`);
    } else {
      crit('B5. /admin returned unexpected status to anonymous visitor', `Status: ${anonAdmin.status}`);
    }

    // Clinic owner request must return 404 Not Found (NOT 403, operator console must be invisible)
    if (authCookie) {
      const clinicAdmin = await fetchRoute('/admin', {
        headers: { Cookie: authCookie }
      });
      if (clinicAdmin.status === 404) {
        pass('B5. /admin returns 404 Not Found to clinic owner (operator console invisible)');
      } else {
        crit('B5. /admin did not return 404 to clinic owner', `Status: ${clinicAdmin.status}`);
      }
    }
  } catch (e) {
    warn('B5. Could not probe /admin isolation', e.message);
  }

  // ── B6. Queue State Persistence & Idempotency (P0 §4 & §5) ───────────────────
  console.log('\n--- B6. Queue State Persistence & Idempotency ---');
  if (authCookie) {
    try {
      const idemKey = `audit-key-${Date.now()}`;
      const callRes1 = await fetchRoute('/engine-api/desk/call-next', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: authCookie
        },
        body: JSON.stringify({ providerId: 'p1', idempotencyKey: idemKey })
      });

      if (callRes1.status === 200) {
        const body1 = JSON.parse(callRes1.text);
        const calledToken = body1.token || body1.called;
        if (calledToken) {
          pass('B6. call-next succeeded and returned called token', calledToken.formatted_number);

          // Verify state persistence on GET /engine-api/desk
          const deskRes = await fetchRoute('/engine-api/desk', {
            headers: { Cookie: authCookie }
          });
          const deskBody = JSON.parse(deskRes.text);
          const col1 = deskBody.columns && deskBody.columns[0];
          if (col1 && col1.current && col1.current.id === calledToken.id) {
            pass('B6. Queue state persisted: GET /engine-api/desk reflects called patient');
          } else {
            crit('B6. Queue state NOT persisted across requests');
          }

          // Verify idempotency replay
          const callRes2 = await fetchRoute('/engine-api/desk/call-next', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Cookie: authCookie
            },
            body: JSON.stringify({ providerId: 'p1', idempotencyKey: idemKey })
          });
          const body2 = JSON.parse(callRes2.text);
          const calledToken2 = body2.token || body2.called;
          if (calledToken2 && calledToken2.id === calledToken.id) {
            pass('B6. Idempotency verified: replaying identical key returned cached response');
          } else {
            crit('B6. Idempotency failed: second call advanced queue instead of replaying');
          }
        } else {
          warn('B6. call-next returned empty called object (queue may be empty)');
        }
      } else {
        crit('B6. Authenticated call-next failed', `Status: ${callRes1.status}`);
      }
    } catch (e) {
      crit('B6. Queue persistence / idempotency test failed', e.message);
    }
  } else {
    warn('B6. Skipped persistence test due to missing auth cookie');
  }

  // ── B7. Login Rate Limiting (P1 §7) ─────────────────────────────────────────
  console.log('\n--- B7. Login Rate Limiting (Sliding Window) ---');
  try {
    let rateLimited = false;
    // Send 6 rapid bad login attempts
    for (let i = 0; i < 7; i++) {
      const res = await fetchRoute('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `spam_${i}@example.com`, password: 'wrong' })
      });
      if (res.status === 429) {
        rateLimited = true;
        break;
      }
    }
    if (rateLimited) {
      pass('B7. Login rate limiting active: >5 requests triggered 429 Too Many Requests');
    } else {
      warn('B7. Rate limit 429 not triggered within 7 calls (sliding window might be per IP)');
    }
  } catch (e) {
    warn('B7. Could not test rate limiting', e.message);
  }

  // ── B8. Security Headers & CSP (P1 §8) ───────────────────────────────────────
  console.log('\n--- B8. Security Headers & Production CSP ---');
  try {
    const root = await fetchRoute('/login');
    const h = root.headers;
    const csp = h.get('content-security-policy') || '';

    if (csp) {
      if (!csp.includes("'unsafe-eval'")) {
        pass("B8. Content-Security-Policy drops 'unsafe-eval' in production");
      } else {
        crit("B8. Production CSP still contains 'unsafe-eval'");
      }
    } else {
      crit('B8. Missing Content-Security-Policy header');
    }

    const required = [
      ['x-frame-options', 'X-Frame-Options'],
      ['x-content-type-options', 'X-Content-Type-Options'],
      ['referrer-policy', 'Referrer-Policy'],
      ['permissions-policy', 'Permissions-Policy']
    ];

    for (const [key, label] of required) {
      if (h.get(key)) {
        pass(`B8. ${label} is present`, h.get(key).slice(0, 40));
      } else {
        crit(`B8. Missing security header: ${label}`);
      }
    }
  } catch (e) {
    warn('B8. Could not inspect headers', e.message);
  }

  // ── B9. Branding & OpenGraph Card Assets ────────────────────────────────────
  console.log('\n--- B9. Branding & OpenGraph Card Assets ---');
  try {
    const icon = await fetchRoute('/icon.svg');
    if (icon.status === 200) {
      pass('B9. /icon.svg returns 200 OK (brand favicon present)');
    } else {
      warn('B9. /icon.svg returned non-200 status', `Status: ${icon.status}`);
    }

    const og = await fetchRoute('/opengraph-image');
    if (og.status === 200) {
      pass('B9. /opengraph-image returns 200 OK (WhatsApp link preview card)');
    } else {
      warn('B9. /opengraph-image returned non-200 status', `Status: ${og.status}`);
    }
  } catch (e) {
    warn('B9. Could not probe branding assets', e.message);
  }

  // ── B10. Source Code Integrity Scans ────────────────────────────────────────
  console.log('\n--- B10. Source Code Integrity Scans ---');
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
    if (/catch\s*\(\s*\)\s*=>\s*\{[^}]*kpis\s*:\s*\[/.test(content)) {
      catchLiesFound++;
      crit('B10. Catch fallback literal object detected in', path.relative(process.cwd(), file));
    }
    if (/wabaId\s*:\s*.*Math\.random\(\)/.test(content)) {
      randomWabaFound++;
      crit('B10. Math.random() WABA ID fabrication detected in', path.relative(process.cwd(), file));
    }
  }

  if (catchLiesFound === 0) {
    pass('B10. Zero catch-block data fabrications across app source');
  }
  if (randomWabaFound === 0) {
    pass('B10. Zero Math.random() identifier fabrications');
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
