-- ════════════════════════════════════════════════════════════════════════
-- BAARI — v2 surface schema extension
-- ════════════════════════════════════════════════════════════════════════

-- 1. users: mirrors auth.users (profile only, no credentials or secrets)
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  phone text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- 2. memberships: (org_id, user_id, role, provider_id, status)
create table if not exists memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  role text not null check (role in ('owner','manager','receptionist','desk','provider','platform_admin')),
  provider_id uuid references providers(id) on delete set null,
  status text not null default 'active' check (status in ('active','invited','suspended')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

-- 3. onboarding_sessions: (org_id, mode, current_step, answers jsonb, completed_at)
create table if not exists onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  mode text not null default 'clinic' check (mode in ('clinic','lab','salon','spa','other')),
  current_step text not null default 'mode',
  answers jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id)
);

-- 4. onboarding_answers: (session_id, question_key, raw_answer, parsed jsonb, confidence)
create table if not exists onboarding_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references onboarding_sessions(id) on delete cascade,
  org_id uuid not null references orgs(id) on delete cascade,
  question_key text not null,
  raw_answer text,
  parsed jsonb not null default '{}'::jsonb,
  confidence numeric(3,2) not null default 1.0,
  created_at timestamptz not null default now(),
  unique (session_id, question_key)
);

-- 5. imported_files: (org_id, kind, storage_path, mime, bytes, status, extraction jsonb)
create table if not exists imported_files (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  kind text not null check (kind in ('pdf','excel','csv','word','txt','image','website','gbp','manual')),
  storage_path text,
  mime text,
  bytes bigint,
  status text not null default 'uploaded' check (status in ('uploaded','parsing','extracted','approved','failed')),
  extraction jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 6. knowledge_chunks: (doc_id, org_id, chunk_text, embedding vector(768), category)
create table if not exists knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid references kb_docs(id) on delete set null,
  org_id uuid not null references orgs(id) on delete cascade,
  chunk_text text not null,
  embedding vector(768),
  category text not null default 'faq' check (category in (
    'business info','staff','services','pricing','hours','appointments',
    'policies','faq','location & parking','payment','diagnostics'
  )),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists knowledge_chunks_org_idx on knowledge_chunks (org_id, category);

-- 7. message_templates: (org_id, name, category, language, body, buttons jsonb, meta_status)
create table if not exists message_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null,
  category text not null check (category in ('UTILITY','MARKETING','AUTHENTICATION')),
  language text not null default 'hi',
  body text not null,
  buttons jsonb not null default '[]'::jsonb,
  meta_status text not null default 'PENDING' check (meta_status in ('APPROVED','PENDING','REJECTED','PAUSED')),
  created_at timestamptz not null default now(),
  unique (org_id, name, language)
);

-- 8. webhook_events: (org_id?, source, signature_ok, payload, processed_at) - replay guard
create table if not exists webhook_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references orgs(id) on delete cascade,
  source text not null,
  signature_ok boolean not null default false,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

-- 9. subscriptions: (org_id, plan, period, status, razorpay_sub_id, current_period_end)
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  plan text not null check (plan in ('starter','growth','pro','hospital')),
  period text not null default 'monthly' check (period in ('monthly','annual')),
  status text not null default 'active' check (status in ('active','past_due','suspended','cancelled')),
  razorpay_sub_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

-- 10. audit_logs view linking to existing audit_log
create or replace view audit_logs as
  select id, org_id, actor, action, entity, entity_id, ip, payload, created_at from audit_log;

-- ════════════════════════════════════════════════════════════════════════
-- RLS — every tenant table
-- ════════════════════════════════════════════════════════════════════════
do $$
declare t text;
begin
  foreach t in array array[
    'memberships','onboarding_sessions','onboarding_answers','imported_files',
    'knowledge_chunks','message_templates','subscriptions'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format($f$
      create policy tenant_isolation on %I
        using (org_id = nullif(current_setting('app.current_org', true), '')::uuid)
        with check (org_id = nullif(current_setting('app.current_org', true), '')::uuid)
    $f$, t);
  end loop;
end $$;

alter table webhook_events enable row level security;
create policy tenant_isolation on webhook_events
  using (org_id is null or org_id = nullif(current_setting('app.current_org', true), '')::uuid)
  with check (org_id is null or org_id = nullif(current_setting('app.current_org', true), '')::uuid);

