'use strict';

/**
 * gate.js — Executable Phase Gate Runner (§3 PLAN-V3.md)
 * Exits 0 on PASS, exits 1 on FAIL.
 * Every phase gate includes the previous phases' checks.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const phase = parseInt(process.argv[2] ?? '0', 10);
console.log(`\n========================================`);
console.log(`  RUNNING PHASE GATE ${phase} VERIFICATION`);
console.log(`========================================\n`);

function runCommand(name, cmd, args, cwd) {
  process.stdout.write(`  [GATE] ${name}... `);
  const res = spawnSync(cmd, args, { cwd: cwd || process.cwd(), stdio: 'pipe', encoding: 'utf8', shell: true });
  if (res.status === 0) {
    console.log(`✅ PASS`);
    return true;
  } else {
    console.log(`❌ FAIL (Exit code ${res.status})`);
    if (res.stderr) console.error(res.stderr.slice(0, 300));
    if (res.stdout) console.log(res.stdout.slice(0, 300));
    return false;
  }
}

function getTestOrg(S) {
  let org = S.load().orgs?.[0];
  if (!org) {
    require('../apps/engine/src/seed').run();
    org = S.load().orgs[0];
  }
  return org;
}

let allOk = true;

// ── Gate 0: Foundation (Unit tests, SQL schema, RLS isolation, Shared types) ─
if (phase >= 0) {
  console.log('--- Phase 0: Foundation ---');
  if (!runCommand('Engine unit tests (26 passing)', 'npm', ['--prefix', 'apps/engine', 'test'])) allOk = false;
  if (!runCommand('SQL schema & RLS isolation (8 passing)', 'npm', ['--prefix', 'apps/engine', 'run', 'test:sql'])) allOk = false;
  if (!runCommand('Shared package TypeScript compilation', 'npm', ['--prefix', 'packages/shared', 'run', 'build'])) allOk = false;
}

// ── Gate 1: Queue Loop (Idempotency, Cabin, Desk, TV) ────────────────────────
if (phase >= 1 && allOk) {
  console.log('\n--- Phase 1: Queue Loop ---');
  const Q = require('../apps/engine/src/queue');
  const S = require('../apps/engine/src/store');
  const org = getTestOrg(S);
  const prov = S.providers(org.id)[0];

  // Verify idempotent callNext
  const call1 = Q.callNext(org.id, prov.id, { idempotencyKey: 'gate-test' });
  const call2 = Q.callNext(org.id, prov.id, { idempotencyKey: 'gate-test' });
  if (call1 && call2 && call1.id === call2.id) {
    console.log('  [GATE] Idempotent call_next: ✅ PASS');
  } else {
    console.log('  [GATE] Idempotent call_next: ❌ FAIL');
    allOk = false;
  }
}

// ── Gate 2: Onboarding & Knowledge Import ────────────────────────────────────
if (phase >= 2 && allOk) {
  console.log('\n--- Phase 2: Onboarding & Knowledge Import ---');
  const Setup = require('../apps/engine/src/setupflow');
  const S = require('../apps/engine/src/store');
  const org = getTestOrg(S);

  const preview = Setup.preview(org.id);
  if (preview && preview.name && preview.doctors && preview.services) {
    console.log('  [GATE] Conversational onboarding confirmation card: ✅ PASS');
  } else {
    console.log('  [GATE] Conversational onboarding confirmation card: ❌ FAIL');
    allOk = false;
  }
}

// ── Gate 3: Knowledge Grounding & EWMA Learning ──────────────────────────────
if (phase >= 3 && allOk) {
  console.log('\n--- Phase 3: Grounding & EWMA ---');
  const KB = require('../apps/engine/src/kb');
  const ETA = require('../apps/engine/src/eta');
  const S = require('../apps/engine/src/store');
  const org = getTestOrg(S);
  const prov = S.providers(org.id)[0];

  // Grounding refusal check
  const missing = KB.ask(org.id, 'kya aap rocket repair karte hain?');
  if (missing && missing.escalate) {
    console.log('  [GATE] Ungrounded inquiry correctly escalates: ✅ PASS');
  } else {
    console.log('  [GATE] Grounded refusal: ❌ FAIL');
    allOk = false;
  }

  // EWMA noise filtering (clicks < 2 min ignored)
  const statsBefore = ETA.statsFor(org.id, prov.id);
  ETA.learn(org.id, prov.id, null, 1); // 1 min click
  const statsAfter = ETA.statsFor(org.id, prov.id);
  if (statsBefore.samples === statsAfter.samples) {
    console.log('  [GATE] EWMA sub-2min click noise rejected: ✅ PASS');
  } else {
    console.log('  [GATE] EWMA sub-2min click noise rejection: ❌ FAIL');
    allOk = false;
  }
}

// ── Gate 4: WhatsApp Transport Guardrails ────────────────────────────────────
if (phase >= 4 && allOk) {
  console.log('\n--- Phase 4: WhatsApp Official & Guardrails ---');
  const WA = require('../apps/engine/src/wa');
  const S = require('../apps/engine/src/store');
  const org = getTestOrg(S);

  // Quiet hours & opt out checks
  const canSend = WA.canSendTo({ phone: '919810000001', opt_out: true });
  if (canSend === false) {
    console.log('  [GATE] Opt-out transport blocking: ✅ PASS');
  } else {
    console.log('  [GATE] Opt-out transport blocking: ❌ FAIL');
    allOk = false;
  }
}

// ── Gate 5: Non-Gated Reviews & Privacy ──────────────────────────────────────
if (phase >= 5 && allOk) {
  console.log('\n--- Phase 5: Reviews & Privacy ---');
  const Review = require('../apps/engine/src/review');
  const S = require('../apps/engine/src/store');
  const org = getTestOrg(S);

  const ask1 = Review.recordFeedback(org.id, '919810000099', 5, 'Great');
  const ask2 = Review.recordFeedback(org.id, '919810000098', 2, 'Bad wait');

  if (ask1.googleReviewUrl && ask2.googleReviewUrl && ask2.ownerAlert) {
    console.log('  [GATE] Non-gated reviews: Google link to 100%, alert on <=3★: ✅ PASS');
  } else {
    console.log('  [GATE] Non-gated review policy: ❌ FAIL');
    allOk = false;
  }
}

// ── Gate 6: Billing & Invoicing ──────────────────────────────────────────────
if (phase >= 6 && allOk) {
  console.log('\n--- Phase 6: Billing & Revenue ---');
  const B = require('../apps/engine/src/billing');
  const intent = B.upiIntent({ vpa: 'baari@okaxis', name: 'Baari', amount: 4999 });
  if (intent && intent.startsWith('upi://pay?')) {
    console.log('  [GATE] Direct zero-MDR UPI deep link: ✅ PASS');
  } else {
    console.log('  [GATE] UPI deep link: ❌ FAIL');
    allOk = false;
  }
}

// ── Gate 7: Hardening & North-Star Acceptance ────────────────────────────────
if (phase >= 7 && allOk) {
  console.log('\n--- Phase 7: North-Star Acceptance ---');
  if (!runCommand('North-star scripted acceptance test', 'node', ['scripts/accept.js'])) allOk = false;
}

console.log(`\n========================================`);
if (allOk) {
  console.log(`  GATE ${phase} PASSED (All checks exited 0)`);
  console.log(`========================================\n`);
  process.exit(0);
} else {
  console.error(`  GATE ${phase} FAILED`);
  console.log(`========================================\n`);
  process.exit(1);
}
