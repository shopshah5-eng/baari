import { OrgMode } from './labels';

export type UserRole = 'owner' | 'manager' | 'receptionist' | 'desk' | 'provider' | 'platform_admin';

export interface ServiceJwtPayload {
  org_id: string;
  role: UserRole;
  user_id: string;
  provider_id?: string;
  iat?: number;
  exp?: number;
}

export interface Org {
  id: string;
  slug: string;
  mode: OrgMode;
  name: string;
  city?: string;
  area?: string;
  address?: string;
  maps_url?: string;
  phone?: string;
  owner_name?: string;
  owner_phone?: string;
  logo_url?: string;
  locale: 'hi' | 'pa' | 'en' | 'hinglish';
  hours: Record<string, any>;
  plan: 'pilot' | 'starter' | 'growth' | 'pro' | 'hospital';
  plan_renews_at?: string;
  wa: {
    lane: 'meta' | 'baileys' | 'mock';
    status: 'not_connected' | 'authorizing' | 'pending_verification' | 'connected' | 'error';
    waba_id?: string;
    phone_number_id?: string;
    display_phone?: string;
    webhook_verified?: boolean;
    last_seen_at?: string;
    error_message?: string;
  };
  settings: Record<string, any>;
  created_at: string;
}

export interface Provider {
  id: string;
  org_id: string;
  name: string;
  code: string;
  specialty?: string;
  room?: string;
  avg_minutes: number;
  speed_factor: number;
  hours: Record<string, any>;
  delay_until?: string | null;
  active: boolean;
}

export interface Service {
  id: string;
  org_id: string;
  provider_id?: string | null;
  name: string;
  price: number;
  duration_min: number;
  category?: string;
  active: boolean;
}

export interface Patient {
  id: string;
  org_id: string;
  phone_e164: string;
  name?: string;
  locale?: string;
  notes?: string;
  visits: number;
  last_visit_at?: string;
  created_at: string;
}

export type TokenState = 'BOOKED' | 'ARRIVED' | 'CALLED' | 'IN_CONSULT' | 'DONE' | 'SKIPPED' | 'HOLD' | 'CANCELLED';

export interface Token {
  id: string;
  org_id: string;
  patient_id?: string;
  provider_id: string;
  day: string;
  number: number;
  formatted_number?: string; // e.g. "S-07"
  state: TokenState;
  source: 'walkin' | 'wa' | 'web' | 'phone';
  reason?: string;
  service_id?: string;
  priority: number;
  eta_at?: string;
  leave_by_at?: string;
  travel_minutes?: number;
  ahead?: number;
  checked_in_at?: string;
  called_at?: string;
  done_at?: string;
  hold_until?: string;
  patient_name?: string;
  patient_phone?: string;
  service_name?: string;
  provider_name?: string;
  provider_code?: string;
  provider_room?: string;
  created_at: string;
}

export interface ProviderQueueColumn {
  provider: Provider;
  current?: Token | null;
  waiting: Token[];
  stats: {
    waitingCount: number;
    completedCount: number;
    avgMinutes: number;
    delayMinutes: number;
  };
}

export interface DeskState {
  columns: ProviderQueueColumn[];
  canUndo: boolean;
  lastEvent?: {
    id: string | number;
    type: string;
    description: string;
    timestamp: number;
  } | null;
  waConnected: boolean;
  waStatus: string;
}

export interface CabinState {
  provider: Provider;
  current?: Token | null;
  nextPatients: Token[];
  elapsedSeconds: number;
  avgDurationMinutes: number;
}

export interface TVDisplayItem {
  tokenFormatted: string;
  providerName: string;
  roomName: string;
  state: 'CALLED' | 'IN_CONSULT';
  calledAt: string;
}

export interface TVDisplayState {
  clinicName: string;
  nowServing: TVDisplayItem[];
  nextUp: {
    tokenFormatted: string;
    roomName: string;
    aheadCount: number;
  }[];
  announcement?: {
    textHi: string;
    textEn: string;
    tokenFormatted: string;
    timestamp: number;
  } | null;
}

export interface OnboardingSession {
  id: string;
  org_id: string;
  mode: OrgMode;
  current_step: string;
  answers: Record<string, any>;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

