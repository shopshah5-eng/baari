import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validateCredentials, signSession, verifySession } from '@/lib/auth';

// In-memory sliding-window rate limiter (§7)
const loginAttempts: Record<string, { count: number; resetAt: number }> = {};

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const record = loginAttempts[key];
  if (!record || now > record.resetAt) {
    loginAttempts[key] = { count: 1, resetAt: now + 60000 };
    return false;
  }
  record.count += 1;
  return record.count > 5;
}

export async function POST(request: NextRequest) {
  const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';

  // Check rate limit
  if (isRateLimited(clientIp)) {
    return NextResponse.json(
      { error: 'Too many login attempts. Please wait 60 seconds.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  try {
    const body = await request.json();
    const { email, password, pin, authMode } = body;

    let sessionPayload: {
      userId: string;
      email: string;
      orgId: string;
      role: 'owner' | 'receptionist' | 'doctor' | 'operator';
      scopes: string[];
    };

    if (authMode === 'pin' || pin) {
      // Desk PIN verification (§1)
      if (pin !== '1234' && pin !== '9999') {
        return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
      }
      sessionPayload = {
        userId: 'usr_reception_desk',
        email: 'desk@sharma.in',
        orgId: 'dr-sharma',
        role: 'receptionist',
        scopes: ['desk:read', 'desk:write']
      };
    } else {
      if (!email || !password) {
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
      }

      // Check credentials against authorized account store (§1)
      const user = await validateCredentials(email, password);
      if (!user) {
        return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
      }

      sessionPayload = {
        userId: user.userId,
        email: user.email,
        orgId: user.orgId,
        role: user.role,
        scopes: user.scopes
      };
    }

    // Generate cryptographically signed JWT token (§2)
    const token = await signSession(sessionPayload, 60 * 60 * 24 * 7);

    // Never return tenantId directly in response body (§1)
    const response = NextResponse.json({
      ok: true,
      user: {
        email: sessionPayload.email,
        role: sessionPayload.role
      }
    });

    const isProd = process.env.NODE_ENV === 'production';

    // Set signed httpOnly cookie
    response.cookies.set('baari_session', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7 // 7 days
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }
}
