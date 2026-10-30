import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession } from '@/lib/auth';
import { loadState } from '@/lib/store-serverless';

export async function GET(request: NextRequest) {
  const rawToken =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    request.cookies.get('baari_session')?.value;

  const session = await verifySession(rawToken);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const state = loadState();
  const org = state.orgs.find(o => o.id === session.orgId) || state.orgs[0] || {
    id: session.orgId,
    name: 'My Clinic',
    mode: 'clinic'
  };

  return NextResponse.json({
    ok: true,
    tenant: {
      id: org.id,
      slug: org.id,
      name: org.name,
      mode: org.mode,
      area: 'Model Town',
      doctorsCount: 2,
      waStatus: 'not_connected'
    }
  });
}

export async function POST() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}
