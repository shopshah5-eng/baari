import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const session = request.cookies.get('baari_session')?.value;
  if (!session && process.env.NEXT_PUBLIC_DEMO !== '1') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    tenant: {
      id: 'org_sharma',
      slug: 'dr-sharma',
      name: 'Dr Sharma Dental',
      mode: 'clinic',
      area: 'Model Town, Ludhiana',
      doctorsCount: 3,
      waStatus: 'not_connected'
    }
  });
}

