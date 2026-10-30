import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession } from './lib/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Fully public assets & static paths
  const isStaticAsset =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/robots.txt') ||
    pathname.startsWith('/sitemap.xml') ||
    pathname.startsWith('/icon') ||
    pathname.startsWith('/apple-icon') ||
    pathname.startsWith('/opengraph-image');

  if (isStaticAsset) {
    return NextResponse.next();
  }

  // 2. Public web app pages
  const isPublicPage =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/tv') ||
    pathname.startsWith('/status') ||
    pathname.startsWith('/onboarding') ||
    pathname === '/api/auth/login' ||
    pathname === '/api/auth/logout' ||
    pathname === '/api/health';

  // 3. Engine API endpoints - check public vs protected (§3)
  const isEngineApi = pathname.startsWith('/engine-api') || pathname.startsWith('/api/engine');
  if (isEngineApi) {
    // Only health, tv, and status endpoints are public
    const isPublicEngine =
      pathname.includes('/health') ||
      pathname.includes('/tv/') ||
      pathname.includes('/status/');

    if (isPublicEngine) {
      return NextResponse.next();
    }

    // All other engine reads & writes require cryptographic session verification (§3)
    const rawToken =
      request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
      request.cookies.get('baari_session')?.value;

    const session = await verifySession(rawToken);
    if (!session) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // Attach verified session claims
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-baari-org-id', session.orgId);
    requestHeaders.set('x-baari-user-id', session.userId);
    requestHeaders.set('x-baari-role', session.role);

    return NextResponse.next({
      request: {
        headers: requestHeaders
      }
    });
  }

  if (isPublicPage) {
    return NextResponse.next();
  }

  // 4. Cryptographic session verification for all dashboard routes (§2)
  const rawSession = request.cookies.get('baari_session')?.value;
  const session = await verifySession(rawSession);

  // Operator console isolation: return 404 Not Found if non-operator (§2 & §15)
  if (pathname.startsWith('/admin')) {
    if (!session || session.role !== 'operator') {
      return new NextResponse('Not found', { status: 404 });
    }
  }

  // If no verified cryptographic session, redirect unauthenticated visitors
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    const response = NextResponse.redirect(loginUrl);
    // Delete any invalid or forged cookie
    if (rawSession) {
      response.cookies.delete('baari_session');
    }
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
