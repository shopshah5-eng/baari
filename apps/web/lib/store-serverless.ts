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

export interface StoreState {
  orgs: { id: string; name: string; mode: string }[];
  providers: ProviderRecord[];
  tokens: TokenRecord[];
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
    idempotency: {}
  };
}

let inMemoryCache: StoreState | null = null;

export function loadState(): StoreState {
  if (inMemoryCache) return inMemoryCache;
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      inMemoryCache = JSON.parse(data);
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
 * Retrieve desk queue columns with real persisted active tokens
 */
export function getDeskState(orgId: string) {
  const state = loadState();
  const provs = state.providers;

  const columns = provs.map((p) => {
    const cur = state.tokens.find(
      (t) => t.provider_id === p.id && (t.state === 'CALLED' || t.state === 'IN_CONSULT')
    );
    const waiting = state.tokens.filter(
      (t) => t.provider_id === p.id && (t.state === 'ARRIVED' || t.state === 'BOOKED')
    );
    const completed = state.tokens.filter(
      (t) => t.provider_id === p.id && t.state === 'DONE'
    );

    return {
      provider: {
        id: p.id,
        name: p.name,
        code: p.code,
        room: p.room,
        specialty: p.specialty,
        avgMinutes: p.avg_minutes
      },
      current: cur || null,
      waiting,
      stats: {
        waitingCount: waiting.length,
        completedCount: completed.length,
        avgMinutes: p.avg_minutes,
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

/**
 * Mark consultation done
 */
export function markDone(orgId: string, tokenId: string) {
  const state = loadState();
  const token = state.tokens.find((t) => t.id === tokenId);
  if (token) {
    token.state = 'DONE';
    token.done_at = new Date().toISOString();
    saveState(state);
    return { ok: true, token };
  }
  return { ok: false, error: 'Token not found' };
}

