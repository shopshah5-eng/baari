'use strict';
/* Rate limiting, security headers, tiny validators. No dependencies. */
const buckets = new Map();

function rateLimit({ windowMs = 60000, max = 60, key } = {}) {
  return (req, res, next) => {
    const k = (key ? key(req) : (req.ip || 'x')) + ':' + req.path;
    const now = Date.now();
    let b = buckets.get(k);
    if (!b || now > b.reset) { b = { count: 0, reset: now + windowMs }; buckets.set(k, b); }
    b.count++;
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - b.count));
    if (b.count > max) { res.setHeader('Retry-After', Math.ceil((b.reset - now) / 1000)); return res.status(429).json({ error: 'too many requests' }); }
    next();
  };
}

function headers(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(self)');
  res.setHeader('X-Baari-Version', require('../package.json').version);
  next();
}

const isPhone = v => /^91\d{10}$/.test(String(v || '')) || /^\d{10}$/.test(String(v || ''));
const normPhone = v => { const d = String(v || '').replace(/\D/g, ''); return d.length === 10 ? '91' + d : d; };
const isSlug = v => /^[a-z0-9][a-z0-9-]{2,40}$/.test(String(v || ''));
const isMoney = v => Number.isFinite(Number(v)) && Number(v) >= 0 && Number(v) < 1e8;

/* idempotency for POSTs that must not double-fire */
const seen = new Map();
function idempotent(ttlMs = 5000) {
  return (req, res, next) => {
    const key = (req.headers['idempotency-key'] || '') + '|' + req.method + req.originalUrl;
    if (req.headers['idempotency-key']) {
      const hit = seen.get(key);
      if (hit && Date.now() - hit.at < ttlMs) return res.json({ ...hit.body, idempotent: true });
    }
    const json = res.json.bind(res);
    res.json = (body) => { if (req.headers['idempotency-key'] && res.statusCode < 400) seen.set(key, { at: Date.now(), body }); return json(body); };
    next();
  };
}

module.exports = { rateLimit, headers, isPhone, normPhone, isSlug, isMoney, idempotent };
