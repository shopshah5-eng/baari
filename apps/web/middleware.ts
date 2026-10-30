import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public paths that do not require authentication
  const isPublicPath =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/tv') ||
    pathname.startsWith('/status') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/engine-api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/robots.txt') ||
    pathname.startsWith('/sitemap.xml');

  if (isPublicPath) {
    return NextResponse.next();
  }

  // Check for authentication cookie
  const sessionToken = request.cookies.get('baari_session')?.value;
  const userRole = request.cookies.get('baari_role')?.value;

  // If visiting /admin, enforce platform_admin role
  if (pathname.startsWith('/admin')) {
    if (!sessionToken || userRole !== 'platform_admin') {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('error', 'unauthorized_admin');
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // If visiting any other protected route and no session exists, redirect to /login
  if (!sessionToken) {
    // Check if DEMO mode is explicitly enabled
    if (process.env.NEXT_PUBLIC_DEMO === '1') {
      return NextResponse.next();
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

