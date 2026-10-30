const JWT_SECRET = process.env.JWT_SECRET || 'baari_secure_jwt_secret_production_2026_key_982347';

export interface SessionPayload {
  userId: string;
  email: string;
  orgId: string;
  role: 'owner' | 'receptionist' | 'doctor' | 'operator';
  scopes: string[];
  exp: number;
  iat: number;
}

// Canonical pilot accounts with pre-computed SHA-256 hashes
export const AUTHORIZED_USERS = [
  {
    email: 'doctor@sharma.in',
    passwordHash: 'bb627ea105fcda6a1c5ae2057b98dbdb27034de10e6f142c2f6a5eb62ad2f7b7', // SharmaDental@2026
    userId: 'usr_sharma_owner',
    orgId: 'dr-sharma',
    role: 'owner' as const,
    scopes: ['*']
  },
  {
    email: 'doctor@clinic.com',
    passwordHash: 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', // password123
    userId: 'usr_pilot_clinic',
    orgId: 'dr-sharma',
    role: 'owner' as const,
    scopes: ['*']
  },
  {
    email: 'operator@baari.in',
    passwordHash: '74e9aafdd956ecdd5262818d6bf4378151ae75812b0b6a8b21b424c7954a5efb', // BaariOperator@2026
    userId: 'usr_platform_operator',
    orgId: 'baari-platform',
    role: 'operator' as const,
    scopes: ['admin', 'operator', '*']
  }
];

function base64UrlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) {
    b64 += '=';
  }
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlToBytes(str: string): Uint8Array {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) {
    b64 += '=';
  }
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

/**
 * Sign an HMAC-SHA256 JWT session token using standard Web Crypto API
 */
export async function signSession(
  payload: Omit<SessionPayload, 'iat' | 'exp'>,
  expiresInSec: number = 60 * 60 * 24 * 7
): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: SessionPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInSec
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const data = `${encodedHeader}.${encodedPayload}`;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sigBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const signature = bytesToBase64Url(new Uint8Array(sigBuffer));

  return `${data}.${signature}`;
}

/**
 * Cryptographically verify an HMAC-SHA256 JWT session token using standard Web Crypto API
 */
export async function verifySession(token: string | null | undefined): Promise<SessionPayload | null> {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const data = `${encodedHeader}.${encodedPayload}`;

  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBytes = base64UrlToBytes(signature);
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes as unknown as BufferSource,
      enc.encode(data) as unknown as BufferSource
    );
    if (!isValid) {
      return null;
    }

    const payload: SessionPayload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Validate credentials against canonical user accounts
 */
export async function validateCredentials(email: string, password: string) {
  if (!email || !password) return null;

  const enc = new TextEncoder();
  const digestBuf = await crypto.subtle.digest('SHA-256', enc.encode(password));
  const hex = Array.from(new Uint8Array(digestBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const user = AUTHORIZED_USERS.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
  if (!user || user.passwordHash !== hex) {
    return null;
  }

  return user;
}
