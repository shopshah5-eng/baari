'use strict';

/**
 * Single source of truth for Baari packaging and pricing.
 * Synchronized with apps/engine/src/plans.js (docs/09 §2, docs/10 §B4).
 */

export interface PlanConfig {
  id: string;
  name: string;
  activation: number;
  monthly: number;
  annual: number;
  providers: number;
  tokens: number;
  tv: number;
  lab: boolean;
  campaigns: number;
  popular?: boolean;
  features: string[];
}

export const PLANS: Record<string, PlanConfig> = {
  pilot: {
    id: 'pilot',
    name: 'Pilot',
    activation: 1000,
    monthly: 0,
    annual: 0,
    providers: 2,
    tokens: 200,
    tv: 1,
    lab: false,
    campaigns: 0,
    features: ['2 Providers', '200 Tokens/mo', '1 Waiting TV Display', 'Pilot Sandbox']
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    activation: 2999,
    monthly: 999,
    annual: 9999,
    providers: 1,
    tokens: 500,
    tv: 1,
    lab: false,
    campaigns: 0,
    features: ['1 Provider / Doctor', 'Unlimited OPD Tokens', 'Live Waiting TV Display', 'Direct UPI QR']
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    popular: true,
    activation: 4999,
    monthly: 1999,
    annual: 19999,
    providers: 4,
    tokens: 2500,
    tv: 2,
    lab: false,
    campaigns: 500,
    features: [
      'Up to 4 Providers / Doctors',
      'Learned EWMA Timing Engine',
      'Official Meta WhatsApp Lane',
      'Lead CRM & Revenue Recovery',
      'Automated GST Invoicing'
    ]
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    activation: 9999,
    monthly: 3999,
    annual: 39999,
    providers: 99,
    tokens: 10000,
    tv: 5,
    lab: true,
    campaigns: 2500,
    features: [
      'Unlimited Providers / Cabins',
      'Diagnostic Lab Vision Module',
      'Home Collection Dispatch',
      'Custom SMS / Voice Failover',
      'Priority Phone Support'
    ]
  },
  hospital: {
    id: 'hospital',
    name: 'Hospital',
    activation: 19999,
    monthly: 8999,
    annual: 89999,
    providers: 99,
    tokens: 1000000,
    tv: 10,
    lab: true,
    campaigns: 10000,
    features: [
      'Unlimited Providers & Cabins',
      'Multi-Branch Consolidated TV',
      'Dedicated Technical Manager',
      'Custom HIS / EMR API Connector'
    ]
  }
};

export const GST_RATE = 0.18;

export function formatInr(amount: number): string {
  return Math.round(amount).toLocaleString('en-IN');
}

