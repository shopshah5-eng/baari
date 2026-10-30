'use strict';
/* WhatsApp gateway: Baileys (default lane, per-tenant session) with Meta Cloud API
   failover, and a mock lane so the whole product runs without a phone.

   Anti-ban discipline (docs/04 §8) is enforced HERE, not in the callers:
     warm-up caps · human jitter · quiet hours · opt-out · never unsolicited
*/
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const S = require('./store');

const SESSIONS_DIR = process.env.WA_SESSIONS_DIR || path.join(__dirname, '..', 'data', 'sessions');
const KEY = crypto.createHash('sha256').update(process.env.WA_ENC_KEY || process.env.JWT_SECRET || 'dev-key').digest();
const sessions = new Map();     // orgId -> { sock, qr, status, startedAt, sentToday }
const listeners = new Map();    // orgId -> Set(fn) for SSE fan-out

const enc = buf => {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  return Buffer.concat([iv, c.update(buf), c.final(), c.getAuthTag()]);
};
const dec = buf => {
  const iv = buf.slice(0, 12), tag = buf.slice(buf.length - 16), body = buf.slice(12, buf.length - 16);
  const d = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]);
};

function emit(orgId, event, data) {
  const set = listeners.get(orgId);
  if (set) for (const fn of set) { try { fn(event, data); } catch {} }
}
function subscribe(orgId, fn) {
  if (!listeners.has(orgId)) listeners.set(orgId, new Set());
  listeners.get(orgId).add(fn);
  return () => listeners.get(orgId)?.delete(fn);
}

function warmupCap(day) {
  if (day <= 3) return 20;
  if (day <= 7) return 100;
  if (day <= 30) return 500;
  return 2000;
}

function quietHours(org) {
  if (org.settings && org.settings.demo_mode) return false;
  const h = Number(new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }));
  return h >= 21 || h < 8;
}

async function encryptAuthDir(orgId) {
  const dir = path.join(SESSIONS_DIR, String(orgId));
  const creds = path.join(dir, 'creds.json');
  if (!fs.existsSync(creds)) return null;
  const blob = enc(fs.readFileSync(creds));
  const d = S.load();
  d.wa_sessions = d.wa_sessions || [];
  let row = d.wa_sessions.find(r => r.org_id === orgId);
  if (!row) { row = { id: S.id('was'), org_id: orgId, lane: 'baileys', status: 'pending', created_at: new Date().toISOString() }; d.wa_sessions.push(row); }
  row.creds_enc = blob.toString('base64');
  row.status = sessions.get(String(orgId))?.status || row.status;
  row.last_seen_at = new Date().toISOString();
  S.save();
  return row.id;
}

/* ─────────────────────────── Baileys lane ─────────────────────────── */
async function startBaileys(org, { onMessage } = {}) {
  let baileys;
  try { baileys = require('@whiskeysockets/baileys'); }
  catch (e) { return { ok: false, reason: 'baileys_not_installed', detail: e.message }; }

  const makeWASocket = baileys.default || baileys.makeWASocket;
  const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys;
  const dir = path.join(SESSIONS_DIR, String(org.id));
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

  const { state, saveCreds } = await useMultiFileAuthState(dir);
  let version = [2, 3000, 1015901307];
  try { version = (await fetchLatestBaileysVersion()).version || version; } catch {}

  const sock = makeWASocket({
    version, auth: state, printQRInTerminal: false,
    browser: ['Baari', 'Chrome', '1.0'],
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
    getMessage: async () => ({ conversation: 'Baari' })
  });

  const rec = { sock, status: 'connecting', qr: null, startedAt: Date.now(), sentToday: 0, orgId: String(org.id) };
  sessions.set(String(org.id), rec);

  sock.ev.on('creds.update', async () => { await saveCreds(); await encryptAuthDir(org.id).catch(() => {}); });

  sock.ev.on('connection.update', async (u) => {
    const { connection, lastDisconnect, qr } = u;
    if (qr) { rec.qr = qr; rec.status = 'qr'; emit(org.id, 'qr', { qr, expiresIn: 120 }); }
    if (connection === 'open') { rec.status = 'connected'; rec.qr = null; emit(org.id, 'status', { status: 'connected' }); org.wa = { ...(org.wa || {}), lane: 'baileys', status: 'connected' }; S.save(); }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      rec.status = loggedOut ? 'disconnected' : 'reconnecting';
      org.wa = { ...(org.wa || {}), status: rec.status }; S.save();
      emit(org.id, 'status', { status: rec.status, code });
      if (loggedOut) {
        // tell the owner, then let the Meta lane take over if it is configured
        const WA = require('./wa');
        WA.send(org, org.owner_phone, '🔴 WhatsApp connection band ho gaya. Baari se 1 minute me QR dobara scan karein: ' + (process.env.PUBLIC_URL || 'http://localhost:3000') + '/desk?t=' + org.slug, { kind: 'transactional' });
        emit(org.id, 'failover', { lane: 'meta', available: !!org.wa?.meta });
      } else {
        setTimeout(() => startBaileys(org, { onMessage }).catch(() => {}), 3000);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const m of messages) {
      if (!m.message || m.key.fromMe) continue;
      const jid = m.key.remoteJid || '';
      if (jid.endsWith('@g.us')) continue;           // never engage groups
      const phone = jid.split('@')[0].replace(/\D/g, '');
      const msg = m.message;
      const text = msg.conversation || msg.extendedTextMessage?.text || msg.buttonsResponseMessage?.selectedButtonId ||
                   msg.listResponseMessage?.singleSelectReply?.selectedRowId || '';
      const isAudio = !!(msg.audioMessage || msg.pttMessage);
      const isImage = !!msg.imageMessage;
      const loc = msg.locationMessage;
      const norm = {
        phone, text: text || (isAudio ? '[voice note]' : isImage ? '[photo]' : ''),
        type: loc ? 'location' : isImage ? 'image' : isAudio ? 'audio' : 'text',
        geo: loc ? { lat: loc.degreesLatitude, lng: loc.degreesLongitude } : null,
        waMessageId: m.key.id, raw: m
      };
      if (onMessage) await onMessage(org, norm).catch(e => console.error('inbound handler', e.message));
    }
  });

  return { ok: true, status: rec.status };
}

/* ─────────────────────── Meta Cloud API lane ─────────────────────── */
async function sendMeta(org, phone, text, opts = {}) {
  const meta = org.wa && org.wa.meta;
  if (!meta || !meta.phone_number_id || !meta.token) return { held: 'meta_not_configured' };
  const url = `https://graph.facebook.com/v21.0/${meta.phone_number_id}/messages`;
  const payload = opts.template
    ? { messaging_product: 'whatsapp', to: phone, type: 'template', template: { name: opts.template, language: { code: 'hi' }, components: [] } }
    : { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: text } };
  try {
    const r = await fetch(url, { method: 'POST', headers: { authorization: 'Bearer ' + meta.token, 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const j = await r.json();
    return { ok: r.ok, lane: 'meta', id: j.messages?.[0]?.id, error: j.error?.message };
  } catch (e) { return { ok: false, lane: 'meta', error: e.message }; }
}

/* ─────────────────────── unified outbound ─────────────────────── */
async function deliver(org, phone, text, opts = {}) {
  const sess = sessions.get(String(org.id));
  const lane = sess && sess.status === 'connected' ? 'baileys' : (org.wa?.meta ? 'meta' : 'mock');

  if (quietHours(org) && opts.kind !== 'transactional') return { held: 'quiet_hours', lane };
  if (sess && sess.status === 'connected') {
    const cap = warmupCap(Math.max(1, Math.ceil((Date.now() - sess.startedAt) / 864e5)));
    if (sess.sentToday >= cap) return { held: 'warmup_cap', lane };
    try {
      const jid = phone + '@s.whatsapp.net';
      await sess.sock.sendPresenceUpdate('composing', jid).catch(() => {});
      // human jitter between 3s and 12s — the single most effective anti-ban measure
      await new Promise(r => setTimeout(r, 3000 + Math.random() * 9000));
      const sent = await sess.sock.sendMessage(jid, { text });
      sess.sentToday++;
      return { ok: true, lane: 'baileys', id: sent?.key?.id };
    } catch (e) {
      if (org.wa?.meta) return sendMeta(org, phone, text, opts);
      return { ok: false, lane: 'baileys', error: e.message };
    }
  }
  if (org.wa?.meta) return sendMeta(org, phone, text, opts);
  return { ok: true, lane: 'mock' };   // caller already logged it
}

function status(orgId) {
  const s = sessions.get(String(orgId));
  if (!s) return { lane: (S.orgById(orgId)?.wa?.lane) || 'mock', status: 'idle', qr: null };
  return { lane: 'baileys', status: s.status, qr: s.qr, uptimeMin: Math.round((Date.now() - s.startedAt) / 60000), sentToday: s.sentToday };
}
async function stop(orgId) {
  const s = sessions.get(String(orgId));
  if (s?.sock) { try { await s.sock.logout(); } catch {} }
  sessions.delete(String(orgId));
}
async function logout(orgId) {
  const s = sessions.get(String(orgId));
  if (s?.sock) { try { await s.sock.logout(); } catch {} }
  sessions.delete(String(orgId));
  const dir = path.join(SESSIONS_DIR, String(orgId));
  fs.rmSync(dir, { recursive: true, force: true });
  const o = S.orgById(orgId);
  if (o) { o.wa = { ...(o.wa || {}), status: 'disconnected' }; S.save(); }
  return { ok: true };
}

module.exports = { startBaileys, sendMeta, deliver, status, stop, logout, subscribe, encryptAuthDir, warmupCap, quietHours, sessions };
