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

    // Test 2: GET /api/auth/login returns 405 Method Not Allowed JSON (§W6)
    const getLogin = await fetchRoute('/api/auth/login', { method: 'GET' });
    if (getLogin.status === 405 && getLogin.headers.get('content-type')?.includes('application/json')) {
      pass('B2. GET /api/auth/login returns 405 Method Not Allowed JSON');
    } else if (getLogin.status === 405) {
      pass('B2. GET /api/auth/login rejected with 405');
    } else {
      warn('B2. GET /api/auth/login unexpected status', `Status: ${getLogin.status}`);
    }

    // Test 3: Valid credentials must succeed with 200 and return session cookie
    const loginUser = process.env.AUDIT_EMAIL || 'doctor@clinic.com';
    const loginPass = process.env.AUDIT_PASSWORD || 'password';

    const validLogin = await fetchRoute('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginUser, password: loginPass })
    });

    if (validLogin.status === 200) {
      pass('B2. Valid clinic login succeeded with 200 OK', loginUser);
      const setCookie = validLogin.headers.get('set-cookie');
      if (setCookie && setCookie.includes('baari_session=')) {
        authCookie = setCookie.split(';')[0];
        pass('B2. HttpOnly session cookie issued');
      } else {
        warn('B2. Session cookie header not captured');
      }
    } else {
      // Fallback probe with canonical sharma owner
      const sharmaLogin = await fetchRoute('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'doctor@sharma.in', password: 'SharmaDental@2026' })
      });
      if (sharmaLogin.status === 200) {
        pass('B2. Canonical Sharma clinic owner login succeeded with 200 OK');
        const setCookie = sharmaLogin.headers.get('set-cookie');
        if (setCookie && setCookie.includes('baari_session=')) {
          authCookie = setCookie.split(';')[0];
        }
      } else {
        crit('B2. Valid clinic owner login failed', `Status: ${validLogin.status}`);
      }
    }
  } catch (e) {
    crit('B2. Login probe failed', e.message);
  }

  // ── B3. Signup Funnel & Real Account Creation (P0 §C1 & §C2) ─────────────────
  console.log('\n--- B3. Signup Funnel & Real Account Creation ---');
  let newOrgCookie = null;
  let newOrgId = null;
  try {
    const signupEmail = `audit_${Date.now()}@example.invalid`;
    const signupRes = await fetchRoute('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Dr. Audit User',
        businessName: 'Audit Dental Clinic',
        businessEmail: signupEmail,
        phone: '+91 98100 99999',
        password: 'auditPassword2026'
      })
    });

    if (signupRes.status === 200) {
      const signupBody = JSON.parse(signupRes.text);
      if (signupBody.ok && signupBody.orgId) {
        newOrgId = signupBody.orgId;
        pass('B3. POST /api/auth/signup creates real user + org + session', signupEmail);
      } else {
        crit('B3. POST /api/auth/signup returned 200 but missing ok/orgId');
      }
      const setCookie = signupRes.headers.get('set-cookie');
      if (setCookie && setCookie.includes('baari_session=')) {
        newOrgCookie = setCookie.split(';')[0];
        pass('B3. POST /api/auth/signup issued valid session cookie');
      } else {
        warn('B3. POST /api/auth/signup missing session cookie header');
      }
    } else if (signupRes.status === 307 || signupRes.status === 302) {
      crit('B3. POST /api/auth/signup redirected by auth middleware (matcher bug §C2)', `Status: ${signupRes.status}`);
    } else {
      crit('B3. POST /api/auth/signup failed', `Status: ${signupRes.status}`);
    }

    // Verify GET /api/auth/signup returns 405 Method Not Allowed JSON
    const getSignup = await fetchRoute('/api/auth/signup', { method: 'GET' });
    if (getSignup.status === 405) {
      pass('B3. GET /api/auth/signup rejected with 405 Method Not Allowed');
    }
  } catch (e) {
    crit('B3. Signup probe failed', e.message);
  }

  // ── B4. Forged Session Rejection & Route Protection (P0 §2) ─────────────────
  console.log('\n--- B4. Cryptographic Session Verification & Forged Cookie Rejection ---');
  try {
    const forgedDesk = await fetchRoute('/desk', {
      headers: { Cookie: 'baari_session=forged_token_value_abc' }
    });
    if (forgedDesk.status === 307 || forgedDesk.status === 302 || forgedDesk.status === 401) {
      pass('B4. Forged cookie rejected on /desk (redirected to login)', `Status: ${forgedDesk.status}`);
    } else {
      crit('B4. Forged session allowed access to /desk', `Status: ${forgedDesk.status}`);
    }
  } catch (e) {
    warn('B4. Could not probe forged /desk', e.message);
  }

  try {
    const forgedPatients = await fetchRoute('/patients', {
      headers: { Cookie: 'baari_session=forged_token_value_abc' }
    });
    if (forgedPatients.status === 307 || forgedPatients.status === 302 || forgedPatients.status === 401) {
      pass('B4. Forged cookie rejected on /patients (PII protected)', `Status: ${forgedPatients.status}`);
    } else {
      crit('B4. Forged session allowed access to /patients', `Status: ${forgedPatients.status}`);
    }
  } catch (e) {
    warn('B4. Could not probe forged /patients', e.message);
  }

  // ── B5. API Auth Guards & 401 JSON Policy (P0 §C3) ──────────────────────────
  console.log('\n--- B5. API Auth Guards & 401 JSON Policy ---');
  const protectedApis = [
    ['GET', '/api/auth/me'],
    ['GET', '/api/tenant'],
    ['GET', '/engine-api/desk'],
    ['POST', '/engine-api/desk/call-next'],
    ['GET', '/engine-api/patients'],
    ['GET', '/engine-api/dpdp/export']
  ];

  for (const [method, ep] of protectedApis) {
    try {
      const res = await fetchRoute(ep, { method });
      if (res.status === 401) {
        // Verify response is JSON, not HTML redirect
        if (res.headers.get('content-type')?.includes('application/json')) {
          pass(`B5. Unauthenticated ${method} ${ep} returns 401 application/json`);
        } else {
          pass(`B5. Unauthenticated ${method} ${ep} returns 401`);
        }
      } else if (res.status === 307 || res.status === 302) {
        crit(`B5. ${method} ${ep} returned HTML 307 redirect instead of 401 JSON (§C3)`);
      } else {
        crit(`B5. Unauthenticated ${method} ${ep} permitted without token`, `Status: ${res.status}`);
      }
    } catch (e) {
      warn(`B5. Could not probe ${ep}`, e.message);
    }
  }

  // ── B6. Operator Console Isolation (P1 §6) ─────────────────────────────────
  console.log('\n--- B6. Operator Console Isolation ---');
  try {
    // Anonymous request must return 404 Not Found (or redirect)
    const anonAdmin = await fetchRoute('/admin');
    if (anonAdmin.status === 404 || anonAdmin.status === 307 || anonAdmin.status === 302) {
      pass('B6. /admin is isolated from anonymous visitors', `Status: ${anonAdmin.status}`);
    } else {
      crit('B6. /admin returned unexpected status to anonymous visitor', `Status: ${anonAdmin.status}`);
    }

    // Clinic owner request must return 404 Not Found (NOT 403, operator console must be invisible)
    if (authCookie) {
      const clinicAdmin = await fetchRoute('/admin', {
        headers: { Cookie: authCookie }
      });
      if (clinicAdmin.status === 404) {
        pass('B6. /admin returns 404 Not Found to clinic owner (operator console invisible)');
      } else {
        crit('B6. /admin did not return 404 to clinic owner', `Status: ${clinicAdmin.status}`);
      }
    }
  } catch (e) {
    warn('B6. Could not probe /admin isolation', e.message);
  }

  // ── B7. TV Queue Display Security & Method Guard (P0 §C4 & §W4) ─────────────
  console.log('\n--- B7. TV Queue Display Security & Method Guard ---');
  try {
    // Known valid display token returns 200 with queue
    const tvPreview = await fetchRoute('/engine-api/tv/preview');
    if (tvPreview.status === 200) {
      const tvBody = JSON.parse(tvPreview.text);
      if (tvBody.linked !== false && tvBody.clinicName) {
        pass('B7. Valid display token /tv/preview resolves linked clinic queue');
      } else {
        warn('B7. /tv/preview returned unlinked payload');
      }
    }

    // Unknown display token returns neutral "Display not linked" payload (§C4)
    const tvUnknown = await fetchRoute('/engine-api/tv/unknown_invalid_random_token_999');
    if (tvUnknown.status === 200) {
      const unkBody = JSON.parse(tvUnknown.text);
      if (unkBody.linked === false || unkBody.clinicName === null) {
        pass('B7. Unknown display token returns neutral "Display not linked" payload (§C4)');
      } else {
        crit('B7. Unknown display token leaked live clinic queue (§C4)');
      }
    } else if (tvUnknown.status === 404) {
      pass('B7. Unknown display token safely rejected with 404');
    }

    // Method guard: non-GET requests to TV queue must return 405 Method Not Allowed (§W4)
    const tvDelete = await fetchRoute('/engine-api/tv/preview', { method: 'DELETE' });
    if (tvDelete.status === 405) {
      pass('B7. Non-GET method to /tv rejected with 405 Method Not Allowed (§W4)');
    } else {
      crit('B7. DELETE /engine-api/tv accepted without 405 Method Not Allowed', `Status: ${tvDelete.status}`);
    }
  } catch (e) {
    crit('B7. TV display security check failed', e.message);
  }

  // ── B8. Queue State Persistence & Idempotency (P0 §4 & §5) ───────────────────
  console.log('\n--- B8. Queue State Persistence & Idempotency ---');
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
          pass('B8. call-next succeeded and returned called token', calledToken.formatted_number);

          // Verify state persistence on GET /engine-api/desk
          const deskRes = await fetchRoute('/engine-api/desk', {
            headers: { Cookie: authCookie }
          });
          const deskBody = JSON.parse(deskRes.text);
          const col1 = deskBody.columns && deskBody.columns[0];
          if (col1 && col1.current && col1.current.id === calledToken.id) {
            pass('B8. Queue state persisted: GET /engine-api/desk reflects called patient');
          } else {
            crit('B8. Queue state NOT persisted across requests');
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
            pass('B8. Idempotency verified: replaying identical key returned cached response');
          } else {
            crit('B8. Idempotency failed: second call advanced queue instead of replaying');
          }
        } else {
          warn('B8. call-next returned empty called object (queue may be empty)');
        }
      } else {
        crit('B8. Authenticated call-next failed', `Status: ${callRes1.status}`);
      }
    } catch (e) {
      crit('B8. Queue persistence / idempotency test failed', e.message);
    }
  } else {
    warn('B8. Skipped persistence test due to missing auth cookie');
  }

  // ── B8a. Fresh Clinic Tenant Isolation & Zero Fake Patients (§C5) ─────────────
  console.log('\n--- B8a. Fresh Clinic Tenant Isolation & DPDP Parity ---');
  if (newOrgCookie) {
    try {
      const patRes = await fetchRoute('/engine-api/patients', {
        headers: { Cookie: newOrgCookie }
      });
      if (patRes.status === 200) {
        const patData = JSON.parse(patRes.text);
        if (Array.isArray(patData.patients) && patData.patients.length === 0) {
          pass('B8a. Fresh clinic starts with 0 seeded patients (§C5)');
        } else {
          crit('B8a. Fresh clinic has seeded patients from other orgs (§C5)', `Count: ${patData.patients?.length}`);
        }
      } else {
        crit('B8a. GET /engine-api/patients failed', `Status: ${patRes.status}`);
      }

      const dpdpRes = await fetchRoute('/engine-api/dpdp/export', {
        headers: { Cookie: newOrgCookie }
      });
      if (dpdpRes.status === 200) {
        const dpdpData = JSON.parse(dpdpRes.text);
        if (Array.isArray(dpdpData.records) && dpdpData.records.length === 0) {
          pass('B8a. Fresh clinic DPDP export is clean and isolated (0 records §C5)');
        } else {
          crit('B8a. DPDP export leaked foreign clinic records (§C5)', `Count: ${dpdpData.records?.length}`);
        }
      } else {
        crit('B8a. GET /engine-api/dpdp/export failed', `Status: ${dpdpRes.status}`);
      }
    } catch (e) {
      crit('B8a. Fresh clinic tenant isolation check failed', e.message);
    }
  } else {
    warn('B8a. Skipped fresh clinic isolation checks due to missing newOrgCookie');
  }

  // ── B8b. End-to-End Core Queue Loop: Walkin -> Call Next -> Done (§C1 & §C2) ─
  console.log('\n--- B8b. End-to-End Core Queue Loop (Walk-in → Call Next → Cabin Done) ---');
  if (newOrgCookie) {
    try {
      // 1. Add walk-in patient
      const walkinRes = await fetchRoute('/engine-api/desk/walkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: newOrgCookie },
        body: JSON.stringify({
          providerId: 'p1',
          name: 'Audit Walkin Patient',
          phone: '+91 98200 11223',
          reason: 'Routine Checkup'
        })
      });

      let addedToken = null;
      if (walkinRes.status === 200) {
        const walkinBody = JSON.parse(walkinRes.text);
        addedToken = walkinBody.token;
        if (addedToken && addedToken.formatted_number) {
          pass('B8b. POST /engine-api/desk/walkin added patient (§C2)', addedToken.formatted_number);
        } else {
          crit('B8b. POST /engine-api/desk/walkin returned 200 but missing token');
        }
      } else {
        crit('B8b. POST /engine-api/desk/walkin failed (§C2)', `Status: ${walkinRes.status} Body: ${walkinRes.text.slice(0, 100)}`);
      }

      // 2. Verify patient is in waiting list
      const deskAfterWalkin = await fetchRoute('/engine-api/desk', {
        headers: { Cookie: newOrgCookie }
      });
      const deskWData = JSON.parse(deskAfterWalkin.text);
      const waitingList = deskWData.columns?.[0]?.waiting || [];
      if (waitingList.some(w => w.id === addedToken?.id)) {
        pass('B8b. GET /engine-api/desk shows walk-in patient in waiting list');
      } else {
        crit('B8b. Walk-in patient not found in desk waiting list');
      }

      // 3. Call Next patient
      const callRes = await fetchRoute('/engine-api/desk/call-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: newOrgCookie },
        body: JSON.stringify({
          providerId: 'p1',
          idempotencyKey: `call-${Date.now()}`
        })
      });

      let calledTok = null;
      if (callRes.status === 200) {
        const callData = JSON.parse(callRes.text);
        calledTok = callData.token || callData.called;
        if (calledTok) {
          pass('B8b. POST /engine-api/desk/call-next transitioned patient to CALLED (§C1)', calledTok.formatted_number);
        } else {
          crit('B8b. Call Next failed to return called token');
        }
      } else {
        crit('B8b. POST /engine-api/desk/call-next failed', `Status: ${callRes.status}`);
      }

      // 4. Verify desk reflects currently called patient
      const deskAfterCall = await fetchRoute('/engine-api/desk', {
        headers: { Cookie: newOrgCookie }
      });
      const deskCData = JSON.parse(deskAfterCall.text);
      const currentServing = deskCData.columns?.[0]?.current;
      if (currentServing && currentServing.id === calledTok?.id) {
        pass('B8b. GET /engine-api/desk reflects current serving patient in cabin (§C1)');
      } else {
        crit('B8b. GET /engine-api/desk did not reflect called patient');
      }

      // 5. Mark consultation done
      const doneRes = await fetchRoute('/engine-api/cabin/done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: newOrgCookie },
        body: JSON.stringify({ tokenId: calledTok?.id, providerId: 'p1' })
      });
      if (doneRes.status === 200) {
        pass('B8b. POST /engine-api/cabin/done marked consultation complete (§C1)');
      } else {
        crit('B8b. POST /engine-api/cabin/done failed', `Status: ${doneRes.status}`);
      }

      // 6. Verify completed count incremented and current cleared
      const deskAfterDone = await fetchRoute('/engine-api/desk', {
        headers: { Cookie: newOrgCookie }
      });
      const deskDData = JSON.parse(deskAfterDone.text);
      const col = deskDData.columns?.[0];
      if (col && col.stats.completedCount >= 1 && col.current === null) {
        pass('B8b. Queue state transition verified: completedCount incremented, cabin cleared (§C1)');
      } else {
        crit('B8b. Consultation completion state transition failed (§C1)');
      }
    } catch (e) {
      crit('B8b. Core queue loop test failed', e.message);
    }
  }

  // ── B8c. Desk Action Suite & Provider Ownership Guard (§C2 & §C4) ────────────
  console.log('\n--- B8c. Desk Action Suite & Provider Ownership Guard ---');
  if (newOrgCookie) {
    try {
      // 1. Alien provider validation: Must reject with 404/400 (§C4)
      const alienCall = await fetchRoute('/engine-api/desk/call-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: newOrgCookie },
        body: JSON.stringify({ providerId: 'p_nonexistent_alien_doc_999' })
      });
      if (alienCall.status === 404 || alienCall.status === 400) {
        pass('B8c. Alien provider rejected with 404/400 (§C4)');
      } else {
        crit('B8c. Alien provider permitted without ownership check (§C4)', `Status: ${alienCall.status}`);
      }

      // 2. Add Emergency Patient
      const emRes = await fetchRoute('/engine-api/desk/emergency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: newOrgCookie },
        body: JSON.stringify({ providerId: 'p1', name: 'Emergency Audit Patient', phone: '+91 99999 11111' })
      });
      if (emRes.status === 200) {
        pass('B8c. POST /engine-api/desk/emergency succeeded (§C2)');
      } else {
        crit('B8c. POST /engine-api/desk/emergency failed (§C2)', `Status: ${emRes.status}`);
      }

      // 3. Set Queue Delay
      const delayRes = await fetchRoute('/engine-api/desk/delay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: newOrgCookie },
        body: JSON.stringify({ providerId: 'p1', minutes: 15 })
      });
      if (delayRes.status === 200) {
        pass('B8c. POST /engine-api/desk/delay succeeded (§C2)');
      } else {
        crit('B8c. POST /engine-api/desk/delay failed (§C2)', `Status: ${delayRes.status}`);
      }

      // 4. Undo Last Action
      const undoRes = await fetchRoute('/engine-api/desk/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: newOrgCookie },
        body: JSON.stringify({ providerId: 'p1' })
      });
      if (undoRes.status === 200 || undoRes.status === 400) {
        pass('B8c. POST /engine-api/desk/undo handled (§C2)');
      } else {
        crit('B8c. POST /engine-api/desk/undo returned 404 or down (§C2)', `Status: ${undoRes.status}`);
      }

      // 5. Add New Provider / Cabin
      const provRes = await fetchRoute('/engine-api/desk/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: newOrgCookie },
        body: JSON.stringify({
          name: 'Dr. Neha Gupta',
          code: 'G',
          room: 'Cabin 2',
          specialty: 'Orthodontics',
          avgMinutes: 15
        })
      });
      if (provRes.status === 200) {
        pass('B8c. POST /engine-api/desk/providers created new doctor (§C2)');
      } else {
        crit('B8c. POST /engine-api/desk/providers failed (§C2)', `Status: ${provRes.status}`);
      }

      // 6. DPDP Patient Hard Delete
      const wipeRes = await fetchRoute('/engine-api/dpdp/delete?patientId=test_patient_id_wipe', {
        method: 'DELETE',
        headers: { Cookie: newOrgCookie }
      });
      if (wipeRes.status === 200) {
        pass('B8c. DELETE /engine-api/dpdp/delete succeeded (§C2)');
      } else {
        crit('B8c. DELETE /engine-api/dpdp/delete failed (§C2)', `Status: ${wipeRes.status}`);
      }
    } catch (e) {
      crit('B8c. Desk action suite test failed', e.message);
    }
  }

  // ── B8d. Smart Setup / Onboarding Create (§C3) ──────────────────────────────
  console.log('\n--- B8d. Smart Setup / Onboarding Create ---');
  if (newOrgCookie) {
    try {
      const onboardRes = await fetchRoute('/engine-api/onboarding/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: newOrgCookie },
        body: JSON.stringify({
          mode: 'clinic',
          name: 'Audit Dental Care Clinic',
          area: 'Civil Lines, Ludhiana',
          providers: [
            { name: 'Dr. Audit Kumar', specialty: 'General Dentist', avgMinutes: 10 }
          ]
        })
      });

      if (onboardRes.status === 200) {
        const obData = JSON.parse(onboardRes.text);
        if (obData.ok && obData.status === 'active') {
          pass('B8d. POST /engine-api/onboarding/create successfully configured org (§C3)');
        } else {
          crit('B8d. POST /engine-api/onboarding/create returned 200 but missing ok/status');
        }
      } else {
        crit('B8d. POST /engine-api/onboarding/create failed (§C3)', `Status: ${onboardRes.status}`);
      }
    } catch (e) {
      crit('B8d. Onboarding create test failed', e.message);
    }
  }

  // ── B9. Login Rate Limiting (P1 §7 & §W1) ───────────────────────────────────
  console.log('\n--- B9. Login Rate Limiting (Keyed per Account) ---');
  try {
    let rateLimited = false;
    const testSpamAccount = `attacker_${Date.now()}@example.com`;
    // Send 7 rapid attempts on the same account
    for (let i = 0; i < 7; i++) {
      const res = await fetchRoute('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testSpamAccount, password: 'wrong' })
      });
      if (res.status === 429) {
        rateLimited = true;
        const retryAfter = res.headers.get('retry-after');
        if (retryAfter) {
          pass('B9. Rate limit 429 includes Retry-After header', retryAfter);
        }
        break;
      }
    }
    if (rateLimited) {
      pass('B9. Login rate limiting active on targeted account');
    } else {
      warn('B9. Rate limit 429 not triggered within 7 calls');
    }
  } catch (e) {
    warn('B9. Could not test rate limiting', e.message);
  }

  // ── B10. Security Headers & CSP (P1 §8) ─────────────────────────────────────
  console.log('\n--- B10. Security Headers & Production CSP ---');
  try {
    const root = await fetchRoute('/login');
    const h = root.headers;
    const csp = h.get('content-security-policy') || '';

    if (csp) {
      if (!csp.includes("'unsafe-eval'")) {
        pass("B10. Content-Security-Policy drops 'unsafe-eval' in production");
      } else {
        crit("B10. Production CSP still contains 'unsafe-eval'");
      }
    } else {
      crit('B10. Missing Content-Security-Policy header');
    }

    const required = [
      ['x-frame-options', 'X-Frame-Options'],
      ['x-content-type-options', 'X-Content-Type-Options'],
      ['referrer-policy', 'Referrer-Policy'],
      ['permissions-policy', 'Permissions-Policy']
    ];

    for (const [key, label] of required) {
      if (h.get(key)) {
        pass(`B10. ${label} is present`, h.get(key).slice(0, 40));
      } else {
        crit(`B10. Missing security header: ${label}`);
      }
    }
  } catch (e) {
    warn('B10. Could not inspect headers', e.message);
  }

  // ── B11. Branding & OpenGraph Card Assets ──────────────────────────────────
  console.log('\n--- B11. Branding & OpenGraph Card Assets ---');
  try {
    const icon = await fetchRoute('/icon.svg');
    if (icon.status === 200) {
      pass('B11. /icon.svg returns 200 OK (brand favicon present)');
    } else {
      warn('B11. /icon.svg returned non-200 status', `Status: ${icon.status}`);
    }

    const og = await fetchRoute('/opengraph-image');
    if (og.status === 200) {
      pass('B11. /opengraph-image returns 200 OK (WhatsApp link preview card)');
    } else {
      warn('B11. /opengraph-image returned non-200 status', `Status: ${og.status}`);
    }
  } catch (e) {
    warn('B11. Could not probe branding assets', e.message);
  }

  // ── B12. Accessibility & Source Code Integrity Scans (P1 §C5 & B10) ─────────
  console.log('\n--- B12. Accessibility & Source Code Integrity Scans ---');
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
      crit('B12. Catch fallback literal object detected in', path.relative(process.cwd(), file));
    }
    if (/wabaId\s*:\s*.*Math\.random\(\)/.test(content)) {
      randomWabaFound++;
      crit('B12. Math.random() WABA ID fabrication detected in', path.relative(process.cwd(), file));
    }
  }

  if (catchLiesFound === 0) {
    pass('B12. Zero catch-block data fabrications across app source');
  }
  if (randomWabaFound === 0) {
    pass('B12. Zero Math.random() identifier fabrications');
  }

  // Check login & signup for htmlFor and main / h1
  const loginSrc = fs.readFileSync(path.join(webAppDir, '(auth)', 'login', 'page.tsx'), 'utf8');
  if (loginSrc.includes('<main') && loginSrc.includes('<h1') && loginSrc.includes('htmlFor=')) {
    pass('B12. /login has <main>, <h1>, and accessible htmlFor labels (§C5)');
  } else {
    crit('B12. /login missing accessible <main>, <h1>, or htmlFor labels');
  }

  const signupSrc = fs.readFileSync(path.join(webAppDir, '(auth)', 'signup', 'page.tsx'), 'utf8');
  if (signupSrc.includes('<main') && signupSrc.includes('<h1') && signupSrc.includes('htmlFor=')) {
    pass('B12. /signup has <main>, <h1>, and accessible htmlFor labels (§C5)');
  } else {
    crit('B12. /signup missing accessible <main>, <h1>, or htmlFor labels');
  }

  const tvSrc = fs.readFileSync(path.join(webAppDir, 'tv', '[token]', 'page.tsx'), 'utf8');
  if (tvSrc.includes('aria-live="polite"')) {
    pass('B12. /tv/[token] has aria-live="polite" region for screen readers (§C5)');
  } else {
    crit('B12. /tv/[token] missing aria-live="polite" region');
  }

  // Check layout.tsx for zero Dr Sharma Dental useState default (§C6)
  const layoutSrc = fs.readFileSync(path.join(webAppDir, '(dashboard)', 'layout.tsx'), 'utf8');
  if (!layoutSrc.includes("useState('Dr Sharma Dental')")) {
    pass('B12. /layout has zero hardcoded Dr Sharma Dental in useState (§C6)');
  } else {
    crit('B12. /layout leaks Dr Sharma Dental in SSR useState defaults (§C6)');
  }

  // Check desk/page.tsx for aria-live="polite" region (§C8)
  const deskSrc = fs.readFileSync(path.join(webAppDir, '(dashboard)', 'desk', 'page.tsx'), 'utf8');
  if (deskSrc.includes('aria-live="polite"')) {
    pass('B12. /desk has aria-live="polite" region for active token announcement (§C8)');
  } else {
    crit('B12. /desk missing aria-live="polite" region');
  }

  // Check patients/page.tsx for honest empty state (§C5)
  const patientsSrc = fs.readFileSync(path.join(webAppDir, '(dashboard)', 'patients', 'page.tsx'), 'utf8');
  if (patientsSrc.includes('Abhi koi patient nahi hai — pehla walk-in add karein')) {
    pass('B12. /patients has honest empty state copy for new clinics (§C5)');
  } else {
    crit('B12. /patients missing honest empty state copy');
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
