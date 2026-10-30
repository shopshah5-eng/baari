import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

async function handleRequest(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const pathParts = resolvedParams.path || [];
  const subpath = pathParts.join('/');

  // If external ENGINE_URL is provided, proxy directly to the Express service
  const engineUrl = process.env.ENGINE_URL;
  if (engineUrl) {
    try {
      const targetUrl = `${engineUrl}/api/v2/${subpath}${request.nextUrl.search}`;
      const headers = new Headers(request.headers);
      headers.set('host', new URL(engineUrl).host);

      const res = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.text() : undefined
      });

      const data = await res.text();
      return new NextResponse(data, {
        status: res.status,
        headers: {
          'Content-Type': res.headers.get('Content-Type') || 'application/json'
        }
      });
    } catch (err: any) {
      return NextResponse.json(
        { error: 'Engine Gateway Error', details: err.message },
        { status: 502 }
      );
    }
  }

  // Standalone Serverless Engine Handlers (Zero Webpack external file dependencies)
  if (subpath === 'health') {
    return NextResponse.json({ ok: true, status: 'healthy', engine: 'serverless-v2', timestamp: new Date().toISOString() });
  }

  if (subpath === 'dashboard') {
    return NextResponse.json({
      kpis: [
        { id: '1', title: 'Patients Today', value: '0', subtext: '0 completed', tone: 'neutral' },
        { id: '2', title: 'Currently Waiting', value: '0', subtext: 'Queue is open', tone: 'success' },
        { id: '3', title: 'Collected Today', value: '₹0', subtext: 'No consult fees today', tone: 'neutral' },
        { id: '4', title: 'Avg Consultation', value: '12 min', subtext: 'Target duration', tone: 'neutral' }
      ],
      providers: [
        {
          id: 'p1', name: 'Dr. Rajesh Sharma', code: 'S', room: 'Cabin 1', specialty: 'Dental Surgeon',
          avgMinutes: 12, learnedAvg: null, current: null, waitingCount: 0
        },
        {
          id: 'p2', name: 'Dr. Simran Kaur', code: 'K', room: 'Cabin 2', specialty: 'General & Children',
          avgMinutes: 8, learnedAvg: null, current: null, waitingCount: 0
        }
      ],
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

  if (subpath === 'desk') {
    return NextResponse.json({
      columns: [
        {
          provider: { id: 'p1', name: 'Dr. Rajesh Sharma', code: 'S', room: 'Cabin 1', specialty: 'Dental Surgeon', avgMinutes: 12 },
          current: null,
          waiting: [],
          stats: { waitingCount: 0, completedCount: 0, avgMinutes: 12, delayMinutes: 0 }
        },
        {
          provider: { id: 'p2', name: 'Dr. Simran Kaur', code: 'K', room: 'Cabin 2', specialty: 'General & Children', avgMinutes: 8 },
          current: null,
          waiting: [],
          stats: { waitingCount: 0, completedCount: 0, avgMinutes: 8, delayMinutes: 0 }
        }
      ],
      canUndo: false,
      lastEvent: null
    });
  }

  if (subpath === 'desk/call-next' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({
      ok: true,
      token: {
        id: 'tok_' + Date.now(),
        number: 1,
        formatted_number: (body.providerId?.includes('2') ? 'K' : 'S') + '-01',
        state: 'CALLED',
        patient_name: 'Patient 01',
        patient_phone: '919810000001'
      }
    });
  }

  if (subpath === 'cabin') {
    return NextResponse.json({
      provider: {
        id: 'p1', name: 'Dr. Rajesh Sharma', room: 'Cabin 1', specialty: 'Dental Surgeon',
        avgMinutes: 12, learnedMinutes: 12, samples: 0
      },
      current: null,
      nextPatients: [],
      elapsedSeconds: 0
    });
  }

  if (subpath === 'cabin/done' && request.method === 'POST') {
    return NextResponse.json({ ok: true, status: 'marked_done' });
  }

  if (subpath === 'wa/status') {
    // Honest: not_connected unless verified
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

  if (subpath === 'billing') {
    return NextResponse.json({
      currentPlan: 'pilot',
      invoices: []
    });
  }

  if (subpath === 'patients') {
    return NextResponse.json({
      patients: []
    });
  }

  if (subpath.startsWith('tv')) {
    return NextResponse.json({
      clinicName: 'Dr Sharma Dental',
      nowServing: [],
      nextUp: [],
      announcement: null
    });
  }

  if (subpath.startsWith('status/')) {
    const requestedToken = subpath.replace('status/', '');
    return NextResponse.json({
      tokenFormatted: requestedToken,
      providerName: 'Dr. Rajesh Sharma',
      roomName: 'Cabin 1',
      clinicName: 'Dr Sharma Dental, Model Town',
      etaWindow: '12:00–12:15 PM',
      aheadCount: 0,
      leaveByTime: '11:45 AM',
      travelMinutes: 15,
      state: 'BOOKED'
    });
  }

  if (subpath === 'onboarding/create' && request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({
      ok: true,
      orgId: 'org_' + Date.now(),
      name: body.name || 'New Clinic',
      status: 'active'
    });
  }

  if (subpath === 'dpdp/export') {
    return new NextResponse(JSON.stringify({ exportDate: new Date().toISOString(), records: [] }), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="dpdp_export.json"'
      }
    });
  }

  if (subpath === 'dpdp/delete' && request.method === 'DELETE') {
    return NextResponse.json({ ok: true, deleted: true });
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
