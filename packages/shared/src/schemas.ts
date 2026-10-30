import { z } from 'zod';

export const PhoneRegex = /^\+?[1-9]\d{9,14}$/;
export const SlugRegex = /^[a-z0-9][a-z0-9-]{2,40}$/;

// ── Auth Schemas ─────────────────────────────────────────────────────────────
export const SignupSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  businessEmail: z.string().email('Invalid email address'),
  phone: z.string().regex(PhoneRegex, 'Enter valid phone number with country code'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  businessName: z.string().min(2, 'Business name must be at least 2 characters'),
  mode: z.enum(['clinic', 'lab', 'salon', 'spa', 'other']).default('clinic')
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password required')
});

export const DeskPinSchema = z.object({
  orgId: z.string().uuid(),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4 to 6 digits')
});

// ── Queue & Desk Schemas ─────────────────────────────────────────────────────
export const WalkInSchema = z.object({
  providerId: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  phone: z.string().regex(PhoneRegex, 'Enter valid phone number with country code'),
  serviceId: z.string().uuid().optional(),
  priority: z.number().int().min(0).max(100).default(100),
  reason: z.string().optional()
});

export const CallNextSchema = z.object({
  providerId: z.string().uuid(),
  idempotencyKey: z.string().optional()
});

export const DelayQueueSchema = z.object({
  providerId: z.string().uuid(),
  minutes: z.number().int().min(5).max(180).default(15),
  reason: z.string().optional()
});

export const EmergencyQueueSchema = z.object({
  providerId: z.string().uuid(),
  name: z.string().min(1, 'Patient name is required'),
  phone: z.string().regex(PhoneRegex, 'Enter valid phone number with country code'),
  reason: z.string().default('Emergency case')
});

export const UndoActionSchema = z.object({
  eventId: z.string().or(z.number()),
  token: z.string().uuid().optional()
});

export const MarkDoneSchema = z.object({
  tokenId: z.string().uuid(),
  actualDurationMin: z.number().int().min(1).max(300).optional()
});

// ── Onboarding Schemas ───────────────────────────────────────────────────────
export const OnboardingStepAnswerSchema = z.object({
  questionKey: z.string(),
  rawAnswer: z.string().optional(),
  parsed: z.record(z.any()).default({})
});

export const OnboardingModeSelectSchema = z.object({
  mode: z.enum(['clinic', 'lab', 'salon', 'spa', 'other'])
});

export const BusinessBasicsSchema = z.object({
  name: z.string().min(2),
  city: z.string().min(2),
  area: z.string().min(2),
  address: z.string().optional(),
  phone: z.string().regex(PhoneRegex)
});

export const ProviderConfigSchema = z.object({
  name: z.string().min(2),
  specialty: z.string().optional(),
  avgMinutes: z.number().int().min(2).max(180).default(10),
  code: z.string().min(1).max(4)
});

export const ServiceConfigSchema = z.object({
  name: z.string().min(2),
  price: z.number().min(0),
  durationMin: z.number().int().min(2).max(480).default(15)
});

// ── WhatsApp & Webhook Schemas ──────────────────────────────────────────────
export const MetaExchangeTokenSchema = z.object({
  code: z.string().min(5)
});

export const WhatsAppOutboundMessageSchema = z.object({
  to: z.string().regex(PhoneRegex),
  type: z.enum(['text', 'template', 'media', 'interactive']).default('text'),
  body: z.string().optional(),
  templateName: z.string().optional(),
  templateParams: z.array(z.string()).optional(),
  kind: z.enum(['transactional', 'utility', 'marketing']).default('transactional')
});

// ── Review & Feedback Schemas ────────────────────────────────────────────────
export const SubmitFeedbackSchema = z.object({
  tokenId: z.string().uuid().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional()
});

