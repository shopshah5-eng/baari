import { ServiceJwtPayload } from '@baari/shared';

const ENGINE_URL = process.env.ENGINE_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';

// Base64Url helper
function b64url(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str).toString('base64url');
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Creates a short-lived service JWT (15 minutes) carrying tenant context
 */
export function createServiceToken(payload: Partial<ServiceJwtPayload> & { org_id: string }): string {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 900; // 15 minutes
  const fullPayload: ServiceJwtPayload = {
    role: 'owner',
    user_id: 'web-service',
    ...payload,
    iat,
    exp
  };

  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(fullPayload));

  // In Node environment, use crypto to sign
  if (typeof window === 'undefined') {
    const crypto = require('crypto');
    const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${signature}`;
  }

  // Fallback for mock/browser
  return `${header}.${body}.mock-signature`;
}

/**
 * Standard fetcher for engine calls from web server or server actions
 */
export async function engineFetch<T = any>(
  endpoint: string,
  options: RequestInit & { orgId?: string; role?: string } = {}
): Promise<T> {
  const orgId = options.orgId || 'dr-sharma';
  const token = createServiceToken({ org_id: orgId, role: (options.role as any) || 'owner' });

  const url = typeof window === 'undefined'
    ? `${ENGINE_URL}/api/v2${endpoint}`
    : `/engine-api${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown engine error' }));
    throw new Error(err.error || `Engine error HTTP ${res.status}`);
  }

  return res.json();
}

