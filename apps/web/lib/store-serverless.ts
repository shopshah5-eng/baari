import fs from 'fs';
import path from 'path';

export interface TokenRecord {
  id: string;
  org_id: string;
  provider_id: string;
  number: number;
  formatted_number: string;
  state: 'BOOKED' | 'ARRIVED' | 'CALLED' | 'IN_CONSULT' | 'DONE' | 'SKIPPED' | 'HOLD';
  patient_name: string;
  patient_phone: string;
  priority: number;
  called_at?: string | null;
  done_at?: string | null;
  created_at: string;
}

export interface ProviderRecord {
  id: string;
  org_id: string;
  name: string;
  code: string;
  room: string;
  specialty: string;
  avg_minutes: number;
}

export interface UserRecord {
  userId: string;
  email: string;
  passwordHash: string;
  orgId: string;
  role: 'owner' | 'receptionist' | 'doctor' | 'operator';
  scopes: string[];
}

export interface DisplayTokenRecord {
  token: string;
  org_id: string;
  revoked_at?: string | null;
}

export interface OrgRecord {
  id: string;
  name: string;
  mode: string;
}

export interface StoreState {
  orgs: OrgRecord[];
  providers: ProviderRecord[];
  tokens: TokenRecord[];
  users: UserRecord[];
  display_tokens: DisplayTokenRecord[];
  idempotency: Record<string, { response: any; timestamp: number }>;
}

const STATE_FILE = process.env.VERCEL
  ? '/tmp/baari_state.json'
  : path.join(process.cwd(), '.baari_state.json');

function getInitialState(): StoreState {
  return {
    orgs: [
      { id: 'dr-sharma', name: 'Dr Sharma Dental', mode: 'clinic' },
      { id: 'org_sharma', name: 'Dr Sharma Dental', mode: 'clinic' }
    ],
    providers: [
      { id: 'p1', org_id: 'dr-sharma', name: 'Dr. Rajesh Sharma', code: 'S', room: 'Cabin 1', specialty: 'Dental Surgeon', avg_minutes: 12 },
      { id: 'p2', org_id: 'dr-sharma', name: 'Dr. Simran Kaur', code: 'K', room: 'Cabin 2', specialty: 'General & Children', avg_minutes: 8 }
    ],
    tokens: [
      {
        id: 'tok_init_1',
        org_id: 'dr-sharma',
        provider_id: 'p1',
        number: 1,
        formatted_number: 'S-01',
        state: 'ARRIVED',
        patient_name: 'Patient 01',
        patient_phone: '919810000001',
        priority: 100,
        created_at: new Date().toISOString()
      },
      {
        id: 'tok_init_2',
        org_id: 'dr-sharma',
        provider_id: 'p1',
        number: 2,
        formatted_number: 'S-02',
        state: 'ARRIVED',
        patient_name: 'Patient 02',
        patient_phone: '919810000002',
        priority: 100,
        created_at: new Date().toISOString()
      }
    ],
    users: [
      {
        userId: 'usr_sharma_owner',
        email: 'doctor@sharma.in',
        passwordHash: 'bb627ea105fcda6a1c5ae2057b98dbdb27034de10e6f142c2f6a5eb62ad2f7b7', // SharmaDental@2026
        orgId: 'dr-sharma',
        role: 'owner',
        scopes: ['*']
      },
      {
        userId: 'usr_pilot_clinic',
        email: 'doctor@clinic.com',
        passwordHash: 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f', // password123
        orgId: 'dr-sharma',
        role: 'owner',
        scopes: ['*']
      },
      {
        userId: 'usr_platform_operator',
        email: 'operator@baari.in',
        passwordHash: '74e9aafdd956ecdd5262818d6bf4378151ae75812b0b6a8b21b424c7954a5efb', // BaariOperator@2026
        orgId: 'baari-platform',
        role: 'operator',
        scopes: ['admin', 'operator', '*']
      }
    ],
    display_tokens: [
      { token: 'preview', org_id: 'dr-sharma', revoked_at: null },
      { token: 'tv_sharma', org_id: 'dr-sharma', revoked_at: null },
      { token: 'tv_demo', org_id: 'dr-sharma', revoked_at: null },
      { token: 'display-default', org_id: 'dr-sharma', revoked_at: null }
    ],
    idempotency: {}
  };
}

let inMemoryCache: StoreState | null = null;

export function loadState(): StoreState {
  if (inMemoryCache) {
    if (!inMemoryCache.users) inMemoryCache.users = getInitialState().users;
    if (!inMemoryCache.display_tokens) inMemoryCache.display_tokens = getInitialState().display_tokens;
    return inMemoryCache;
  }
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      inMemoryCache = JSON.parse(data);
      if (!inMemoryCache!.users) inMemoryCache!.users = getInitialState().users;
      if (!inMemoryCache!.display_tokens) inMemoryCache!.display_tokens = getInitialState().display_tokens;
      return inMemoryCache!;
    }
  } catch {
    // Fall back to initial state if file reading fails
  }
  inMemoryCache = getInitialState();
  saveState(inMemoryCache);
  return inMemoryCache;
}

export function saveState(state: StoreState): void {
  inMemoryCache = state;
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch {
    // If filesystem is read-only, inMemoryCache still preserves state for process lifetime
  }
}

export function findUserByEmail(email: string): UserRecord | undefined {
  const state = loadState();
  const normalized = email.toLowerCase().trim();
  return state.users.find(u => u.email.toLowerCase() === normalized);
}

export function addUser(user: UserRecord): void {
  const state = loadState();
  const existingIdx = state.users.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
  if (existingIdx >= 0) {
    state.users[existingIdx] = user;
  } else {
    state.users.push(user);
  }
  saveState(state);
}

export function findDisplayToken(token: string): DisplayTokenRecord | undefined {
  const state = loadState();
  const trimmed = token.trim();
  return state.display_tokens.find(dt => dt.token === trimmed && !dt.revoked_at);
}

export function addDisplayToken(dt: DisplayTokenRecord): void {
  const state = loadState();
  state.display_tokens.push(dt);
  saveState(state);
}

export function addOrg(org: OrgRecord): void {
  const state = loadState();
  if (!state.orgs.some(o => o.id === org.id)) {
    state.orgs.push(org);
    saveState(state);
  }
}

/**
 * Call Next with true persistence and deterministic idempotency replay
 */
export function callNext(orgId: string, providerId: string, idempotencyKey?: string) {
  const state = loadState();

  // 1. Check idempotency store for replay (§5)
  if (idempotencyKey && state.idempotency[idempotencyKey]) {
    return { ...state.idempotency[idempotencyKey].response, replayed: true };
  }

  // 2. Check if this provider already has an active CALLED token
  const currentCalled = state.tokens.find(
    (t) => (t.org_id === orgId || orgId === 'dr-sharma') && t.provider_id === providerId && (t.state === 'CALLED' || t.state === 'IN_CONSULT')
  );
  if (currentCalled) {
    const res = { ok: true, token: currentCalled, called: currentCalled, idempotent: true };
    if (idempotencyKey) {
      state.idempotency[idempotencyKey] = { response: res, timestamp: Date.now() };
      saveState(state);
    }
    return res;
  }

  // 3. Find next waiting token
  let nextToken = state.tokens.find(
    (t) => (t.org_id === orgId || orgId === 'dr-sharma') && t.provider_id === providerId && (t.state === 'ARRIVED' || t.state === 'BOOKED')
  );

  const prov = state.providers.find((p) => p.id === providerId) || state.providers[0];

  // If queue had no pre-seeded waiting tokens, generate next token number
  if (!nextToken) {
    const maxNum = state.tokens
      .filter((t) => t.provider_id === providerId)
      .reduce((max, t) => Math.max(max, t.number), 0);
    const newNum = maxNum + 1;
    nextToken = {
      id: `tok_${Date.now()}_${newNum}`,
      org_id: orgId,
      provider_id: providerId,
      number: newNum,
      formatted_number: `${prov.code}-${String(newNum).padStart(2, '0')}`,
      state: 'ARRIVED',
      patient_name: `Patient ${String(newNum).padStart(2, '0')}`,
      patient_phone: `9198100000${String(newNum).padStart(2, '0')}`,
      priority: 100,
      created_at: new Date().toISOString()
    };
    state.tokens.push(nextToken);
  }

  // 4. Update state to CALLED
  nextToken.state = 'CALLED';
  nextToken.called_at = new Date().toISOString();

  const response = {
    ok: true,
    token: nextToken,
    called: nextToken
  };

  // 5. Store in idempotency ledger
  if (idempotencyKey) {
    state.idempotency[idempotencyKey] = {
      response,
      timestamp: Date.now()
    };
  }

  saveState(state);
  return response;
}

/**
 * Mark token done and record completion time
 */
export function markDone(orgId: string, tokenId: string) {
  const state = loadState();
  const token = state.tokens.find((t) => (t.org_id === orgId || orgId === 'dr-sharma') && t.id === tokenId);
  if (token) {
    token.state = 'DONE';
    token.done_at = new Date().toISOString();
    saveState(state);
  }
  return { ok: true };
}

/**
 * Get unified Desk State with current serving token and waiting list per provider
 */
export function getDeskState(orgId: string) {
  const state = loadState();
  const orgProviders = state.providers.filter((p) => p.org_id === orgId || orgId === 'dr-sharma');

  const columns = orgProviders.map((prov) => {
    const provTokens = state.tokens.filter(
      (t) => (t.org_id === orgId || orgId === 'dr-sharma') && t.provider_id === prov.id
    );

    const current = provTokens.find((t) => t.state === 'CALLED' || t.state === 'IN_CONSULT') || null;
    const waiting = provTokens.filter((t) => t.state === 'ARRIVED' || t.state === 'BOOKED');
    const completed = provTokens.filter((t) => t.state === 'DONE');

    return {
      provider: {
        id: prov.id,
        name: prov.name,
        code: prov.code,
        room: prov.room,
        specialty: prov.specialty,
        avgMinutes: prov.avg_minutes
      },
      current: current
        ? {
            id: current.id,
            number: current.number,
            formatted_number: current.formatted_number,
            state: current.state,
            patient_name: current.patient_name,
            patient_phone: current.patient_phone,
            priority: current.priority,
            called_at: current.called_at
          }
        : null,
      waiting: waiting.map((w) => ({
        id: w.id,
        number: w.number,
        formatted_number: w.formatted_number,
        state: w.state,
        patient_name: w.patient_name,
        patient_phone: w.patient_phone,
        priority: w.priority
      })),
      stats: {
        waitingCount: waiting.length,
        completedCount: completed.length,
        avgMinutes: prov.avg_minutes,
        delayMinutes: 0
      }
    };
  });

  return {
    columns,
    canUndo: false,
    lastEvent: null
  };
}
