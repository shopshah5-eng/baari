'use strict';
/* Zero-dependency JSON store. In production this file is replaced by
   Postgres/Supabase (see docs/05-build-plan.md for the schema + RLS).
   Every function here has a 1:1 SQL equivalent named in the comment. */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'db.json');
let db = null;
let saveTimer = null;

const EMPTY = {
  orgs: [], providers: [], services: [], patients: [], leads: [], tokens: [],
  queue_events: [], provider_stats: [], feedback: [], review_asks: [],
  messages: [], kb_docs: [], pending: [], counter: { token: 0, seq: 1 }
};

function load() {
  if (db) return db;
  try {
    db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    db = JSON.parse(JSON.stringify(EMPTY));
  }
  for (const k of Object.keys(EMPTY)) if (!db[k]) db[k] = Array.isArray(EMPTY[k]) ? [] : { ...EMPTY[k] };
  return db;
}

function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify(db, null, 0));
    } catch (e) { console.error('save failed', e.message); }
  }, 120);
}

function saveNow() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db, null, 0));
}

const id = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9);
const istDay = (d = new Date()) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const istTime = (d = new Date()) => new Date(d).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
const minsBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 60000);
const addMin = (d, m) => new Date(new Date(d).getTime() + m * 60000);

function org(slug) { return load().orgs.find(o => o.slug === slug) || null; }
function orgById(i) { return load().orgs.find(o => o.id === i) || null; }
function providers(orgId) { return load().providers.filter(p => p.org_id === orgId && p.active !== false); }
function services(orgId) { return load().services.filter(s => s.org_id === orgId && s.active !== false); }
function patients(orgId) { return load().patients.filter(p => p.org_id === orgId); }
function path_lead(orgId, phone) { return load().leads.find(l => l.org_id === orgId && l.phone === phone); }
function patient(orgId, phone) { return load().patients.find(p => p.org_id === orgId && p.phone === phone); }
function tokensToday(orgId, day = istDay()) { return load().tokens.filter(t => t.org_id === orgId && t.day === day); }
function event(orgId, type, payload = {}, actor = null) {
  const d = load();
  d.queue_events.push({ id: d.counter.seq++, org_id: orgId, type, payload, actor, at: new Date().toISOString() });
  save();
}

module.exports = {
  load, save, saveNow, id, istDay, istTime, minsBetween, addMin,
  org, orgById, providers, services, patients, patient, lead: path_lead, tokensToday, event
};
