'use strict';
/* Auth: Google OAuth + hand-rolled HS256 JWT (no dep) + desk PIN (scrypt).
   Hard rule: org_id comes from the verified token, NEVER from the URL. */
const crypto = require('crypto');
const S = require('./store');

const SECRET = process.env.JWT_SECRET || 'dev-only-change-me';
const GOOGLE_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const TTL = 60 * 60 * 12; // 12h

const b64u = b => Buffer.from(b).toString('base64url');
const sign = (payload, ttl = TTL) => {
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + ttl }));
  const sig = crypto.createHmac('sha256', SECRET).update(header + '.' + body).digest('base64url');
  return `${header}.${body}.${sig}`;
};
const verify = (token) => {
  if (!token || token.split('.').length !== 3) return null;
  const [h, b, s] = token.split('.');
  const expect = crypto.createHmac('sha256', SECRET).update(h + '.' + b).digest('base64url');
  const a = Buffer.from(s), e = Buffer.from(expect);
  if (a.length !== e.length || !crypto.timingSafeEqual(a, e)) return null;
  const claims = JSON.parse(Buffer.from(b, 'base64url').toString());
  if (claims.exp && claims.exp < Math.floor(Date.now() / 1000)) return null;
  return claims;
};

/* ---- desk PIN ---- */
const hashPin = pin => {
  const salt = crypto.randomBytes(16);
  const k = crypto.scryptSync(String(pin), salt, 32);
  return salt.toString('hex') + ':' + k.toString('hex');
};
const checkPin = (pin, stored) => {
  if (!stored || !stored.includes(':')) return false;
  const [saltHex, keyHex] = stored.split(':');
  const k = crypto.scryptSync(String(pin), Buffer.from(saltHex, 'hex'), 32);
  const a = Buffer.from(keyHex, 'hex');
  return a.length === k.length && crypto.timingSafeEqual(a, k);
};

/* ---- Google OAuth ---- */
function googleAuthUrl(redirectUri, state) {
  const p = new URLSearchParams({
    client_id: GOOGLE_ID, redirect_uri: redirectUri, response_type: 'code',
    scope: 'openid email profile', access_type: 'offline', prompt: 'consent', state
  });
  return 'https://accounts.google.com/o/oauth2/v2/auth?' + p;
}
async function googleExchange(code, redirectUri) {
  if (!GOOGLE_ID) throw new Error('GOOGLE_CLIENT_ID not configured');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: GOOGLE_ID, client_secret: GOOGLE_SECRET, redirect_uri: redirectUri, grant_type: 'authorization_code' })
  });
  const tok = await r.json();
  if (!tok.id_token) throw new Error('google token exchange failed');
  const claims = JSON.parse(Buffer.from(tok.id_token.split('.')[1], 'base64url').toString());
  return { email: claims.email, name: claims.name, picture: claims.picture, sub: claims.sub };
}

/* ---- middleware ---- */
const AUTH_REQUIRED = process.env.AUTH_REQUIRED === 'true';

function bearer(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7);
  const c = req.headers.cookie || '';
  const m = c.match(/baari_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/* resolves tenant + role; in demo mode falls back to the ?t= slug so the
   preview stays clickable without a login wall */
function context(req) {
  const claims = verify(bearer(req));
  if (claims) {
    const orgId = claims.org || claims.org_id;
    const role = claims.role || 'owner';
    const user = claims.email || claims.user_id || 'user';
    const providerId = claims.provider || claims.provider_id || null;
    return { orgId, role, user, via: 'jwt', providerId, claims };
  }
  if (AUTH_REQUIRED) return null;
  const slug = req.params.slug || req.query.t || req.query.tenant;
  const o = slug ? S.org(slug) : S.load().orgs[0];
  if (!o) return null;
  return { orgId: o.id, role: 'owner', user: 'demo@baari.local', via: 'demo' };
}

function requireAuth(req, res, next) {
  const ctx = context(req);
  if (!ctx) return res.status(401).json({ error: 'login required', login: '/login' });
  req.ctx = ctx;
  next();
}
function requireRole(...roles) {
  return (req, res, next) => {
    const ctx = req.ctx || context(req);
    if (!ctx) return res.status(401).json({ error: 'login required' });
    if (!roles.includes(ctx.role)) return res.status(403).json({ error: 'forbidden', need: roles });
    req.ctx = ctx; next();
  };
}

/* the desk token is structurally incapable of reading money or history */
function deskToken(org, providerId) {
  return sign({ org: org.id, role: 'desk', scope: ['queue'], provider: providerId || null });
}
function ownerToken(org, email) {
  return sign({ org: org.id, role: 'owner', email });
}

module.exports = {
  sign, verify, hashPin, checkPin, googleAuthUrl, googleExchange,
  context, requireAuth, requireRole, deskToken, ownerToken, bearer, AUTH_REQUIRED, TTL
};
