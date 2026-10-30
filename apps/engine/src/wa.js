'use strict';
/* WhatsApp outbound lane with hard anti-ban guardrails.
   mock lane = writes to the message log (demo). baileys/meta stubs show where the
   real adapters plug in — the guardrail layer is identical for all three. */
const S = require('./store');

function quietHours(org) {
  if (org.settings && org.settings.demo_mode) return false;
  const h = Number(new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }));
  return h >= 21 || h < 8;
}

function capsOk(org, phone, kind) {
  const msgs = S.load().messages.filter(m => m.org_id === org.id && m.to === phone && m.direction === 'out');
  const last24 = msgs.filter(m => S.minsBetween(m.created_at, new Date()) < 1440);
  if (kind === 'promo') return (org.settings.campaigns_allowed === true);
  if (kind === 'followup' && last24.length >= 3) return false;
  return true;
}

function send(org, phone, text, opts = {}) {
  const lead = S.lead(org.id, phone);
  if (lead && lead.do_not_contact && opts.kind !== 'transactional') return { held: 'opt_out' };
  if (quietHours(org) && opts.kind !== 'transactional') return { held: 'quiet_hours' };
  if (!capsOk(org, phone, opts.kind || 'transactional')) return { held: 'cap' };
  const msg = {
    id: S.id('msg'), org_id: org.id, to: phone, direction: 'out',
    lane: (org.wa && org.wa.lane) || 'mock', template: opts.template || null,
    text, buttons: opts.buttons || [], kind: opts.kind || 'transactional',
    created_at: new Date().toISOString(), status: 'sent'
  };
  S.load().messages.push(msg);
  if (lead) { lead.last_action_at = msg.created_at; S.save(); }
  console.log(`[WA→${phone}] ${String(text).split('\n')[0].slice(0, 70)}`);
  // hand off to the real lane when one is connected (baileys / meta); mock just logs
  const lane = (org.wa && org.wa.lane) || 'mock';
  if (lane !== 'mock') {
    require('./wa-gateway').deliver(org, phone, text, opts)
      .then(r => { if (r && !r.ok && !r.held) console.error('wa deliver failed:', r.error); })
      .catch(e => console.error('wa deliver', e.message));
  }
  return msg;
}

function inbox(org, phone, sinceId) {
  let all = S.load().messages.filter(m => m.org_id === org.id && m.to === phone);
  if (sinceId) { const i = all.findIndex(m => m.id === sinceId); if (i >= 0) all = all.slice(i + 1); }
  return all.slice(-40);
}

function inbound(org, phone, text, type = 'text') {
  const msg = { id: S.id('msg'), org_id: org.id, to: phone, direction: 'in', lane: (org.wa && org.wa.lane) || 'mock', text, type, created_at: new Date().toISOString(), status: 'received' };
  S.load().messages.push(msg); S.save();
  return msg;
}

module.exports = { send, inbox, inbound, quietHours };
