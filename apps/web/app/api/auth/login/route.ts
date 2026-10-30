import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, pin, authMode } = body;

    // Check credentials
    let role = 'receptionist';
    let userEmail = email || 'desk@clinic.local';

    if (authMode === 'pin') {
      if (!pin || pin.length < 4) {
        return NextResponse.json({ error: 'PIN must be at least 4 digits' }, { status: 400 });
      }
      // Valid pilot PINs
      if (pin !== '1234' && pin !== '1111' && pin !== '9999') {
        return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 });
      }
      role = 'receptionist';
    } else {
      if (!email || !password) {
        return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
      }
      if (password.length < 6) {
        return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 401 });
      }
      if (email.includes('admin@baari.in')) {
        role = 'platform_admin';
      } else {
        role = 'owner';
      }
    }

    const response = NextResponse.json({
      ok: true,
      user: {
        email: userEmail,
        role,
        tenantId: 'dr-sharma'
      }
    });

    const isProd = process.env.NODE_ENV === 'production';
    const token = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Set secure session cookies
    response.cookies.set('baari_session', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    response.cookies.set('baari_role', role, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Authentication failed' }, { status: 500 });
  }
}

