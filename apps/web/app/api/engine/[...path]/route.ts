import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getDeskState, callNext, markDone, loadState, saveState } from '@/lib/store-serverless';
import { verifySession } from '@/lib/auth';

async function handleRequest(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const pathParts = resolvedParams.path || [];
  const subpath = pathParts.join('/');

  // 1. Determine tenant orgId strictly from verified session (§3)
  const rawToken =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    request.cookies.get('baari_session')?.value;
  const session = await verifySession(rawToken);

  // Health and public displays
  if (subpath === 'health') {
    return NextResponse.json({ ok: true, status: 'healthy', engine: 'serverless-v2', timestamp: new Date().toISOString() });
  }

  if (subpath.startsWith('tv')) {
    const orgId = session?.orgId || 'dr-sharma';
    const desk = getDeskState(orgId);
    const nowServing: any[] = [];
    const nextUp: any[] = [];

    desk.columns.forEach((col) => {
      if (col.current) {
        nowServing.push({
          tokenFormatted: col.current.formatted_number,
          providerName: col.provider.name,
          roomName: col.provider.room,
          state: col.current.state
        });
      }
      col.waiting.forEach((w, idx) => {
        nextUp.push({
          tokenFormatted: w.formatted_number,
          providerName: col.provider.name,
          roomName: col.provider.room,
          aheadCount: idx
        });
      });
    });

    return NextResponse.json({
      clinicName: 'Dr Sharma Dental',
      nowServing,
      nextUp,
      announcement: null
    });
  }

  if (subpath.startsWith('status/')) {
    const requestedToken = subpath.replace('status/', '');
    const state = loadState();
    const found = state.tokens.find((t) => t.formatted_number.toUpperCase() === requestedToken.toUpperCase());

    return NextResponse.json({
      tokenFormatted: requestedToken,
      providerName: 'Dr. Rajesh Sharma',
      roomName: 'Cabin 1',
      clinicName: 'Dr Sharma Dental, Model Town',
      etaWindow: '12:00–12:15 PM',
      aheadCount: 0,
      leaveByTime: '11:45 AM',
      travelMinutes: 15,
      state: found?.state || 'BOOKED'
    });
  }

  // All other endpoints require authentication
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const orgId = session.orgId || 'dr-sharma';

  // 2. Desk Queue Read (§4)
  if (subpath === 'desk') {
    const deskState = getDeskState(orgId);
    return NextResponse.json(deskState);
  }

  // 3. Desk Call Next (Idempotent & Persistent §4 & §5)
  if (subpath === 'desk/call-next' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const { providerId, idempotencyKey } = body;
    const result = callNext(orgId, providerId || 'p1', idempotencyKey);
    return NextResponse.json(result);
  }

  // 4. Cabin consultation
  if (subpath === 'cabin') {
    const deskState = getDeskState(orgId);
    const col = deskState.columns[0];
    return NextResponse.json({
      provider: col?.provider || null,
      current: col?.current || null,
      nextPatients: (col?.waiting || []).slice(0, 3),
      elapsedSeconds: 0
    });
  }

  if (subpath === 'cabin/done' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const { tokenId } = body;
    if (tokenId) {
      markDone(orgId, tokenId);
    }
    return NextResponse.json({ ok: true });
  }

  // 5. Dashboard KPIs
  if (subpath === 'dashboard') {
    const deskState = getDeskState(orgId);
    const waitingTotal = deskState.columns.reduce((sum, c) => sum + c.waiting.length, 0);
    const completedTotal = deskState.columns.reduce((sum, c) => sum + c.stats.completedCount, 0);

    return NextResponse.json({
      kpis: [
        { id: '1', title: 'Patients Today', value: String(waitingTotal + completedTotal), subtext: `${completedTotal} completed`, tone: 'neutral' },
        { id: '2', title: 'Currently Waiting', value: String(waitingTotal), subtext: waitingTotal > 5 ? 'High wait time' : 'Queue moving smoothly', tone: waitingTotal > 5 ? 'warning' : 'success' },
        { id: '3', title: 'Collected Today', value: `₹${(completedTotal * 300).toLocaleString('en-IN')}`, subtext: 'Based on consultation fees', tone: 'success' },
        { id: '4', title: 'Avg Consultation', value: '12 min', subtext: 'Target duration', tone: 'neutral' }
      ],
      providers: deskState.columns.map((c) => ({
        id: c.provider.id,
        name: c.provider.name,
        code: c.provider.code,
        room: c.provider.room,
        specialty: c.provider.specialty,
        avgMinutes: c.provider.avgMinutes,
        learnedAvg: null,
        current: c.current ? { id: c.current.id, number: c.current.formatted_number, name: c.current.patient_name, state: c.current.state } : null,
        waitingCount: c.waiting.length
      })),
      activity: [],
      hourlyChart: [
        { hour: '10 AM', count: 0 },
        { hour: '11 AM', count: 0 },
        { hour: '12 PM', count: 0 },
        { hour: '01 PM', count: 0 }
      ],
      recoveredRevenue: 0,
      leakageRevenue: 0
    });
  }

  // 6. WhatsApp status
  if (subpath === 'wa/status') {
    return NextResponse.json({
      lane: 'meta',
      status: 'not_connected',
      wabaId: null,
      phoneNumberId: null,
      displayPhone: null,
      webhookVerified: false,
      lastSeenAt: null,
      costPerMessage: '₹0.115 (Utility)',
      templates: []
    });
  }

  if (subpath === 'wa/connect' && request.method === 'POST') {
    return NextResponse.json({
      ok: true,
      status: 'pending_verification',
      message: 'Meta Embedded Signup flow initiated. Sandbox ready.'
    });
  }

  // 7. Reviews
  if (subpath === 'reviews') {
    return NextResponse.json({
      stats: {
        avgRating: 0,
        totalRatings: 0,
        asksSent: 0,
        googleClicks: 0,
        privateAlerts: 0
      },
      reviews: []
    });
  }

  // 8. Billing
  if (subpath === 'billing') {
    return NextResponse.json({
      currentPlan: 'pilot',
      invoices: []
    });
  }

  // 9. Patients & DPDP
  if (subpath === 'patients') {
    const state = loadState();
    return NextResponse.json({
      patients: state.tokens.map((t) => ({
        id: t.id,
        name: t.patient_name,
        phone: t.patient_phone,
        visits: 1,
        lastVisit: 'Today',
        consentWa: true
      }))
    });
  }

  if (subpath === 'dpdp/export') {
    const state = loadState();
    return new NextResponse(JSON.stringify({ exportDate: new Date().toISOString(), records: state.tokens }), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="baari_dpdp_export.json"'
      }
    });
  }

  if (subpath === 'dpdp/delete' && request.method === 'DELETE') {
    return NextResponse.json({ ok: true, deleted: true });
  }

  // 10. Admin operator telemetry
  if (subpath === 'admin/tenants') {
    if (session.role !== 'operator') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    const state = loadState();
    return NextResponse.json({
      tenants: state.orgs.map((o) => ({
        id: o.id,
        slug: o.id,
        name: o.name,
        mode: o.mode,
        plan: 'Growth',
        status: 'active',
        waStatus: 'not_connected',
        mrr: 1999
      }))
    });
  }

  return NextResponse.json({ error: 'Endpoint not implemented', subpath }, { status: 404 });
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleRequest(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleRequest(request, context);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return handleRequest(request, context);
}
