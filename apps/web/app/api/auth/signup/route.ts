import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { hashPassword, signSession } from '@/lib/auth';
import { addUser, addOrg, addDisplayToken, findUserByEmail } from '@/lib/store-serverless';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = (body.businessEmail || body.email || '').trim().toLowerCase();
    const password = body.password || '';
    const fullName = (body.fullName || body.name || 'Clinic Owner').trim();
    const businessName = (body.businessName || body.clinicName || 'My Clinic').trim();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid business email is required' }, { status: 400 });
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // Check if user already exists
    const existing = findUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    const orgSlug = businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || `clinic-${Date.now()}`;
    const orgId = `org_${orgSlug}_${Math.floor(Math.random() * 899 + 100)}`;

    // 1. Create Organization
    addOrg({
      id: orgId,
      name: businessName,
      mode: 'clinic'
    });

    // 2. Create Display Token for TV Screen
    const tvToken = `tv_${orgSlug}`;
    addDisplayToken({
      token: tvToken,
      org_id: orgId,
      revoked_at: null
    });

    // 3. Hash Password & Create User
    const passwordHash = await hashPassword(password);
    const userId = `usr_${Date.now()}`;
    const newUser = {
      userId,
      email,
      passwordHash,
      orgId,
      role: 'owner' as const,
      scopes: ['*']
    };
    addUser(newUser);

    // 4. Sign Cryptographic JWT Session
    const token = await signSession({
      userId,
      email,
      orgId,
      role: 'owner',
      scopes: ['*']
    }, 60 * 60 * 24 * 7);

    // 5. Build Response & Set HttpOnly Session Cookie
    const response = NextResponse.json({
      ok: true,
      user: {
        email,
        role: 'owner'
      },
      orgId
    }, { status: 200 });

    const isProd = process.env.NODE_ENV === 'production';
    response.cookies.set('baari_session', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: 'Signup failed', details: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}

