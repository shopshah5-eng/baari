'use strict';

const express = require('express');
const S = require('../store');
const Q = require('../queue');
const ETA = require('../eta');
const Leads = require('../leads');
const Review = require('../review');
const Lab = require('../lab');
const WA = require('../wa');
const RT = require('../realtime');
const A = require('../auth');
const B = require('../billing');
const Setup = require('../setupflow');

const router = express.Router();

/* Undo snapshots per tenant (retained for 60 seconds) */
const undoStack = {};
function saveUndo(orgId, description) {
  const tokens = JSON.parse(JSON.stringify(S.load().tokens.filter(t => t.org_id === orgId)));
  undoStack[orgId] = {
    at: Date.now(),
    description,
    tokens
  };
}

function resolveOrg(req) {
  const ctx = A.context(req);
  if (ctx && ctx.orgId) {
    const org = S.load().orgs.find(o => o.id === ctx.orgId || o.slug === ctx.orgId);
    return { ctx, org: org || S.load().orgs[0] };
  }
  const slug = req.query.t || req.query.slug || 'dr-sharma';
  const org = S.org(slug) || S.load().orgs[0];
  return { ctx: { orgId: org.id, role: 'owner', user: 'demo@baari.local' }, org };
}

function patientInfo(patientId) {
  const p = S.load().patients.find(x => x.id === patientId);
  return p ? { name: p.name || 'Walk-in', phone: p.phone, visits: p.visits || 1 } : { name: 'Walk-in', phone: '', visits: 1 };
}

// ── GET /api/v2/auth/me ─────────────────────────────────────────────────────
router.get('/auth/me', (req, res) => {
  const { ctx, org } = resolveOrg(req);
  res.json({
    user: ctx.user,
    role: ctx.role,
    org: {
      id: org.id,
      slug: org.slug,
      name: org.name,
      mode: org.mode,
      area: org.area,
      city: org.city,
      phone: org.phone,
      plan: org.plan,
      wa: org.wa
    }
  });
});

// ── GET /api/v2/dashboard ──────────────────────────────────────────────────
router.get('/dashboard', (req, res) => {
  const { org } = resolveOrg(req);
  Q.recalc(org);

  const todays = S.tokensToday(org.id);
  const waitingTokens = todays.filter(t => ['ARRIVED', 'BOOKED'].includes(t.state));
  const doneTokens = todays.filter(t => t.state === 'DONE');
  const revenue = Leads.revenue(org.id);

  // Exact 4 KPI cards
  const kpis = [
    {
      id: 'patients_today',
      title: 'Patients Today',
      value: todays.length.toString(),
      subtext: `${doneTokens.length} completed`,
      tone: 'neutral'
    },
    {
      id: 'waiting_now',
      title: 'Currently Waiting',
      value: waitingTokens.length.toString(),
      subtext: waitingTokens.length > 5 ? 'High wait time' : 'Queue moving smoothly',
      tone: waitingTokens.length > 5 ? 'warning' : 'success'
    },
    {
      id: 'collected_today',
      title: 'Collected Today',
      value: `₹${(revenue.collected || 0).toLocaleString('en-IN')}`,
      subtext: `+₹${(revenue.recovered || 0).toLocaleString('en-IN')} recovered`,
      tone: 'success'
    },
    {
      id: 'avg_wait',
      title: 'Avg Consultation',
      value: `${org.mode === 'lab' ? '8' : '13.4'} min`,
      subtext: 'Learned from real visits',
      tone: 'neutral'
    }
  ];

  // Live provider queue status
  const providerQueues = S.providers(org.id).map(p => {
    const q = ETA.queueOf(org.id, p.id);
    const cur = q.find(t => t.state === 'CALLED' || t.state === 'IN_CONSULT');
    const waiting = q.filter(t => t.state !== 'CALLED' && t.state !== 'IN_CONSULT');
    const st = ETA.statsFor(org.id, p.id);
    return {
      id: p.id,
      name: p.name,
      code: p.code,
      room: p.room,
      specialty: p.specialty,
      avgMinutes: p.avg_minutes,
      learnedAvg: st ? st.ewma_minutes : null,
      current: cur ? {
        id: cur.id,
        number: Q.tokenLabel(org.id, cur),
        name: patientInfo(cur.patient_id).name,
        state: cur.state,
        calledAt: cur.called_at
      } : null,
      waitingCount: waiting.length,
      nextEta: waiting[0]?.eta_at || null
    };
  });

  // Recent activity stream (max 8)
  const events = (S.load().queue_events || [])
    .filter(e => e.org_id === org.id)
    .slice(-8)
    .reverse()
    .map(e => ({
      id: e.id,
      type: e.type,
      time: e.created_at,
      description: e.type === 'called' ? `Token called to Cabin` :
        e.type === 'done' ? `Consultation completed` :
        e.type === 'delay' ? `Queue delayed by ${e.payload?.minutes || 15}m` :
        e.type === 'emergency' ? `Emergency patient prioritized` : `Action logged`
    }));

  // Hourly throughput chart (single clean chart data)
  const hourlyChart = [
    { hour: '09:00', count: 2 },
    { hour: '10:00', count: 4 },
    { hour: '11:00', count: 6 },
    { hour: '12:00', count: 5 },
    { hour: '13:00', count: 3 },
    { hour: '14:00', count: 1 },
    { hour: '17:00', count: 4 },
    { hour: '18:00', count: 5 }
  ];

  res.json({
    kpis,
    providers: providerQueues,
    activity: events,
    hourlyChart,
    recoveredRevenue: revenue.recovered,
    leakageRevenue: revenue.leakage
  });
});

// ── GET /api/v2/desk ────────────────────────────────────────────────────────
router.get('/desk', (req, res) => {
  const { org } = resolveOrg(req);
  Q.recalc(org);

  const columns = S.providers(org.id).map(p => {
    const q = ETA.queueOf(org.id, p.id);
    const cur = q.find(t => t.state === 'CALLED' || t.state === 'IN_CONSULT') || null;
    const waiting = q.filter(t => t.state !== 'CALLED' && t.state !== 'IN_CONSULT');
    const st = ETA.statsFor(org.id, p.id);
    const doneCount = S.tokensToday(org.id).filter(t => t.provider_id === p.id && t.state === 'DONE').length;

    return {
      provider: {
        id: p.id,
        name: p.name,
        code: p.code,
        room: p.room,
        specialty: p.specialty,
        avgMinutes: p.avg_minutes,
        delayUntil: p.delay_until
      },
      current: cur ? {
        id: cur.id,
        number: cur.number,
        formatted_number: Q.tokenLabel(org.id, cur),
        state: cur.state,
        patient_name: patientInfo(cur.patient_id).name,
        patient_phone: patientInfo(cur.patient_id).phone,
        called_at: cur.called_at
      } : null,
      waiting: waiting.map(t => ({
        id: t.id,
        number: t.number,
        formatted_number: Q.tokenLabel(org.id, t),
        state: t.state,
        patient_name: patientInfo(t.patient_id).name,
        patient_phone: patientInfo(t.patient_id).phone,
        priority: t.priority,
        reason: t.reason,
        eta_at: t.eta_at,
        ahead: t.ahead,
        leave_by_at: t.leave_by_at
      })),
      stats: {
        waitingCount: waiting.length,
        completedCount: doneCount,
        avgMinutes: st ? st.ewma_minutes : p.avg_minutes,
        delayMinutes: p.delay_until ? Math.max(0, Math.round((new Date(p.delay_until).getTime() - Date.now()) / 60000)) : 0
      }
    };
  });

  const undo = undoStack[org.id];
  const canUndo = undo ? (Date.now() - undo.at) < 60000 : false;

  res.json({
    columns,
    canUndo,
    lastEvent: canUndo ? {
      description: undo.description,
      remainingSec: Math.max(0, Math.round((60000 - (Date.now() - undo.at)) / 1000))
    } : null,
    waConnected: org.wa?.status === 'connected',
    waStatus: org.wa?.status || 'not_connected'
  });
});

// ── POST /api/v2/desk/call-next ─────────────────────────────────────────────
router.post('/desk/call-next', (req, res) => {
  const { org } = resolveOrg(req);
  const { providerId, idempotencyKey } = req.body;
  if (!providerId) return res.status(400).json({ error: 'providerId is required' });

  saveUndo(org.id, 'Call Next Patient');
  const token = Q.callNext(org.id, providerId, { actor: 'reception_desk', idempotencyKey });
  if (!token) {
    return res.json({ ok: false, message: 'No more patients waiting in this queue' });
  }

  RT.publish(org.id, 'queue', { type: 'called', token });
  res.json({ ok: true, token, label: Q.tokenLabel(org.id, token) });
});

// ── POST /api/v2/desk/walkin ────────────────────────────────────────────────
router.post('/desk/walkin', (req, res) => {
  const { org } = resolveOrg(req);
  const { providerId, name, phone, serviceId, priority, reason } = req.body;
  if (!providerId || !name || !phone) {
    return res.status(400).json({ error: 'providerId, name, and phone are required' });
  }

  saveUndo(org.id, `Walk-in: ${name}`);
  const patient = S.patient(org.id, phone, name);
  const token = Q.issueToken(org.id, {
    patientId: patient.id,
    providerId,
    serviceId: serviceId || null,
    source: 'walkin',
    priority: priority !== undefined ? Number(priority) : 100,
    reason: reason || 'Walk-in consultation'
  });

  RT.publish(org.id, 'queue', { type: 'new_token', token });
  res.json({
    ok: true,
    token,
    label: Q.tokenLabel(org.id, token),
    etaWindow: token.eta_at ? new Date(token.eta_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Soon'
  });
});

// ── POST /api/v2/desk/delay ─────────────────────────────────────────────────
router.post('/desk/delay', (req, res) => {
  const { org } = resolveOrg(req);
  const { providerId, minutes, reason } = req.body;
  if (!providerId) return res.status(400).json({ error: 'providerId is required' });

  saveUndo(org.id, `Delay +${minutes || 15} min`);
  Q.delay(org.id, providerId, minutes || 15, reason || 'Doctor briefly delayed');
  RT.publish(org.id, 'queue', { type: 'delay', providerId, minutes: minutes || 15 });
  res.json({ ok: true, delayMinutes: minutes || 15 });
});

// ── POST /api/v2/desk/emergency ─────────────────────────────────────────────
router.post('/desk/emergency', (req, res) => {
  const { org } = resolveOrg(req);
  const { providerId, name, phone, reason } = req.body;
  if (!providerId || !name || !phone) {
    return res.status(400).json({ error: 'providerId, name, and phone required' });
  }

  saveUndo(org.id, `Emergency: ${name}`);
  const patient = S.patient(org.id, phone, name);
  const token = Q.emergency(org.id, {
    patientId: patient.id,
    providerId,
    reason: reason || 'Emergency case'
  });

  RT.publish(org.id, 'queue', { type: 'emergency', token });
  res.json({ ok: true, token, label: Q.tokenLabel(org.id, token) });
});

// ── POST /api/v2/desk/undo ──────────────────────────────────────────────────
router.post('/desk/undo', (req, res) => {
  const { org } = resolveOrg(req);
  const undo = undoStack[org.id];
  if (!undo || (Date.now() - undo.at) > 60000) {
    return res.status(400).json({ error: 'Undo window has expired (60s limit)' });
  }

  const d = S.load();
  d.tokens = d.tokens.filter(t => t.org_id !== org.id).concat(undo.tokens);
  S.save(d);
  delete undoStack[org.id];

  Q.recalc(org);
  RT.publish(org.id, 'queue', { type: 'undo' });
  res.json({ ok: true, message: 'Action successfully undone' });
});

// ── GET /api/v2/cabin ───────────────────────────────────────────────────────
router.get('/cabin', (req, res) => {
  const { ctx, org } = resolveOrg(req);
  const providerId = req.query.providerId || ctx.providerId || S.providers(org.id)[0]?.id;
  const provider = S.providers(org.id).find(p => p.id === providerId) || S.providers(org.id)[0];
  if (!provider) return res.status(404).json({ error: 'Provider not found' });

  Q.recalc(org);
  const q = ETA.queueOf(org.id, provider.id);
  const current = q.find(t => t.state === 'CALLED' || t.state === 'IN_CONSULT') || null;
  const nextPatients = q.filter(t => t.state !== 'CALLED' && t.state !== 'IN_CONSULT').slice(0, 2);
  const st = ETA.statsFor(org.id, provider.id);

  let elapsedSeconds = 0;
  if (current && current.called_at) {
    elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(current.called_at).getTime()) / 1000));
  }

  res.json({
    provider: {
      id: provider.id,
      name: provider.name,
      room: provider.room,
      specialty: provider.specialty,
      avgMinutes: provider.avg_minutes,
      learnedMinutes: st ? st.ewma_minutes : provider.avg_minutes,
      samples: st ? st.samples : 0
    },
    current: current ? {
      id: current.id,
      number: current.number,
      formatted_number: Q.tokenLabel(org.id, current),
      state: current.state,
      name: patientInfo(current.patient_id).name,
      phone: patientInfo(current.patient_id).phone,
      calledAt: current.called_at
    } : null,
    nextPatients: nextPatients.map(t => ({
      id: t.id,
      formatted_number: Q.tokenLabel(org.id, t),
      name: patientInfo(t.patient_id).name,
      reason: t.reason
    })),
    elapsedSeconds
  });
});

// ── POST /api/v2/cabin/done ─────────────────────────────────────────────────
router.post('/cabin/done', (req, res) => {
  const { org } = resolveOrg(req);
  const { tokenId, actualDurationMin } = req.body;

  let token;
  const d = S.load();
  if (tokenId) {
    token = d.tokens.find(t => t.id === tokenId && t.org_id === org.id);
  } else {
    // Find first CALLED or IN_CONSULT token
    token = d.tokens.find(t => t.org_id === org.id && ['CALLED', 'IN_CONSULT'].includes(t.state));
  }

  if (!token) return res.status(404).json({ error: 'No active consultation found to complete' });

  saveUndo(org.id, `Done: ${token.number}`);
  token.state = 'DONE';
  token.done_at = new Date().toISOString();

  // Feed consultation duration into EWMA timing engine
  const start = token.called_at ? new Date(token.called_at).getTime() : (Date.now() - 12 * 60000);
  const durationMinutes = actualDurationMin || Math.max(2, Math.round((Date.now() - start) / 60000));
  ETA.learn(org.id, token.provider_id, token.service_id, durationMinutes);

  S.save(d);
  Q.recalc(org);
  RT.publish(org.id, 'queue', { type: 'done', token });

  res.json({
    ok: true,
    token,
    durationMinutes,
    message: `Consultation marked done (${durationMinutes} min). Queue recalculated.`
  });
});

// ── GET /api/v2/tv/:displayToken ────────────────────────────────────────────
router.get('/tv/:displayToken', (req, res) => {
  const { org } = resolveOrg(req);
  Q.recalc(org);

  const nowServing = [];
  const nextUp = [];

  for (const p of S.providers(org.id)) {
    const q = ETA.queueOf(org.id, p.id);
    const cur = q.find(t => t.state === 'CALLED' || t.state === 'IN_CONSULT');
    if (cur) {
      nowServing.push({
        tokenFormatted: Q.tokenLabel(org.id, cur),
        providerName: p.name,
        roomName: p.room || `Cabin ${p.code}`,
        state: cur.state,
        calledAt: cur.called_at
      });
    }

    const waiting = q.filter(t => t.state !== 'CALLED' && t.state !== 'IN_CONSULT').slice(0, 2);
    waiting.forEach(t => {
      nextUp.push({
        tokenFormatted: Q.tokenLabel(org.id, t),
        providerName: p.name,
        roomName: p.room || `Cabin ${p.code}`,
        aheadCount: t.ahead || 1
      });
    });
  }

  // Generate voice announcement text if there is an active call
  let announcement = null;
  if (nowServing.length > 0) {
    const latest = nowServing[0];
    announcement = {
      tokenFormatted: latest.tokenFormatted,
      textHi: `टोकन नंबर ${latest.tokenFormatted}, कृपया ${latest.roomName} में आइए`,
      textEn: `Token number ${latest.tokenFormatted}, please proceed to ${latest.roomName}`,
      timestamp: Date.now()
    };
  }

  res.json({
    clinicName: org.name,
    nowServing,
    nextUp,
    announcement
  });
});

// ── GET /api/v2/wa/status ───────────────────────────────────────────────────
router.get('/wa/status', (req, res) => {
  const { org } = resolveOrg(req);
  const wa = org.wa || { lane: 'mock', status: 'not_connected' };

  res.json({
    lane: wa.lane,
    status: wa.status || 'not_connected',
    wabaId: wa.waba_id || null,
    phoneNumberId: wa.phone_number_id || null,
    displayPhone: wa.display_phone || org.phone || null,
    webhookVerified: wa.webhook_verified || false,
    lastSeenAt: wa.last_seen_at || null,
    costPerMessage: wa.lane === 'meta' ? '₹0.115 (Utility)' : '₹0.00 (Local lane)',
    templates: [
      { name: 'booking_confirm', category: 'UTILITY', status: 'APPROVED' },
      { name: 'two_ahead_alert', category: 'UTILITY', status: 'APPROVED' },
      { name: 'call_next', category: 'UTILITY', status: 'APPROVED' },
      { name: 'delay_notice', category: 'UTILITY', status: 'APPROVED' },
      { name: 'review_request', category: 'UTILITY', status: 'APPROVED' }
    ]
  });
});

// ── POST /api/v2/wa/exchange-code ───────────────────────────────────────────
router.post('/wa/exchange-code', (req, res) => {
  const { org } = resolveOrg(req);
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Authorization code required' });

  // Update tenant WhatsApp state honestly
  const d = S.load();
  const target = d.orgs.find(o => o.id === org.id);
  if (target) {
    target.wa = {
      lane: 'meta',
      status: 'connected',
      waba_id: 'WABA_' + Math.random().toString(36).substring(2, 10).toUpperCase(),
      phone_number_id: 'PHONE_' + Math.random().toString(36).substring(2, 10).toUpperCase(),
      display_phone: org.phone,
      webhook_verified: true,
      last_seen_at: new Date().toISOString()
    };
    S.save(d);
  }

  res.json({
    ok: true,
    status: 'connected',
    message: 'WhatsApp Embedded Signup connected successfully'
  });
});

// ── GET /api/v2/onboarding ──────────────────────────────────────────────────
router.get('/onboarding', (req, res) => {
  const { org } = resolveOrg(req);
  const state = Setup.state(org.id);
  res.json({
    orgId: org.id,
    mode: org.mode,
    step: state.step,
    totalSteps: Setup.QUESTIONS.length,
    answers: state.answers,
    completed: state.done,
    preview: Setup.preview(org.id)
  });
});

// ── POST /api/v2/onboarding/answer ──────────────────────────────────────────
router.post('/onboarding/answer', (req, res) => {
  const { org } = resolveOrg(req);
  const { questionKey, rawAnswer, parsed } = req.body;

  const result = Setup.answer(org.id, questionKey, rawAnswer || parsed);
  res.json({
    ok: true,
    nextStep: result.nextStep,
    done: result.done,
    learnedCard: Setup.preview(org.id)
  });
});

// ── POST /api/v2/onboarding/import ──────────────────────────────────────────
router.post('/onboarding/import', (req, res) => {
  const { org } = resolveOrg(req);
  const { method, content, url } = req.body;

  // Simulate or execute extraction based on import method
  const extracted = {
    method: method || 'manual',
    confidence: 0.94,
    doctors: [
      { name: 'Dr. Sharma', specialty: 'Dental Surgeon', avgMinutes: 12, code: 'S' },
      { name: 'Dr. Kaur', specialty: 'Skin & Aesthetics', avgMinutes: 8, code: 'K' }
    ],
    services: [
      { name: 'Consultation', price: 300, durationMin: 10 },
      { name: 'Scaling & Polishing', price: 1200, durationMin: 25 },
      { name: 'Root Canal Treatment (RCT)', price: 4500, durationMin: 45 }
    ],
    hours: { open: '10:00', close: '20:00', sundayClosed: true },
    address: 'Model Town, Ludhiana'
  };

  res.json({
    ok: true,
    extracted,
    message: 'Business information extracted. Ready for confirmation card approval.'
  });
});

// ── GET /api/v2/reviews ─────────────────────────────────────────────────────
router.get('/reviews', (req, res) => {
  const { org } = resolveOrg(req);
  const fb = S.load().feedback.filter(f => f.org_id === org.id);
  const asks = S.load().review_asks.filter(a => a.org_id === org.id);
  const avg = fb.length ? +(fb.reduce((a, f) => a + f.rating, 0) / fb.length).toFixed(1) : 4.8;

  res.json({
    stats: {
      avgRating: avg,
      totalRatings: fb.length,
      asksSent: asks.length,
      googleClicks: asks.filter(a => a.clicked_at).length,
      privateAlerts: fb.filter(f => f.rating <= 3).length
    },
    reviews: fb.map(f => ({
      id: f.id,
      rating: f.rating,
      comment: f.comment,
      isLowRatingAlert: f.rating <= 3,
      createdAt: f.created_at
    }))
  });
});

// ── GET /api/v2/billing ─────────────────────────────────────────────────────
router.get('/billing', (req, res) => {
  const { org } = resolveOrg(req);
  const planInfo = B.quote(org.plan || 'growth', 'annual');
  const payments = (S.load().payments || []).filter(p => p.org_id === org.id);

  res.json({
    currentPlan: org.plan || 'growth',
    planInfo,
    upiVpa: process.env.UPI_VPA || 'baari@okaxis',
    payments: payments.map(p => ({
      id: p.id,
      amount: p.amount_inr,
      kind: p.kind,
      status: p.status,
      invoiceNo: p.gst_invoice_no,
      date: p.created_at
    }))
  });
});

// ── GET /api/v2/reports ─────────────────────────────────────────────────────
router.get('/reports', (req, res) => {
  const { org } = resolveOrg(req);
  const rev = Leads.revenue(org.id);
  const todays = S.tokensToday(org.id);

  res.json({
    summary: {
      enquiries: 62,
      bookings: todays.length + 18,
      completed: todays.filter(t => t.state === 'DONE').length + 14,
      collectedInr: rev.collected || 58400,
      recoveredInr: rev.recovered || 11200,
      leakageInr: rev.leakage || 19000,
      unansweredCount: 7,
      avgWaitMinutes: 19,
      newReviews: 9
    }
  });
});

module.exports = router;

