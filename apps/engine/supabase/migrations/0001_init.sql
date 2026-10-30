-- ════════════════════════════════════════════════════════════════════════
-- BAARI — production schema (Supabase / Postgres 15+)
-- Multi-tenant by org_id on every tenant-owned table. RLS always on.
-- See docs/05-build-plan.md §2–3 for the reasoning.
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- clinic-local "today" — every queue is day-scoped in IST, never UTC
create or replace function ist_today() returns date language sql stable as $fn$
  select ist_today()
$fn$;

-- ── tenancy ────────────────────────────────────────────────────────────────
create table orgs (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9][a-z0-9-]{2,40}$'),
  mode text not null check (mode in ('clinic','lab','salon')),
  name text not null,
  city text, area text, address text, maps_url text,
  phone text, owner_name text, owner_phone text, logo_url text,
  locale text not null default 'hi' check (locale in ('hi','pa','en','hinglish')),
  hours jsonb not null default '{}'::jsonb,
  plan text not null default 'pilot' check (plan in ('pilot','starter','growth','pro','hospital')),
  plan_renews_at timestamptz,
  trial_ends_at timestamptz,
  wa jsonb not null default '{"lane":"mock","status":"pending"}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  user_id uuid,                              -- auth.users(id) in Supabase
  email text,
  role text not null check (role in ('owner','manager','desk','provider','admin')),
  provider_id uuid,
  desk_pin_hash text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, email)
);

create table providers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  name text not null, code text not null, specialty text, room text,
  avg_minutes int not null default 10 check (avg_minutes between 2 and 240),
  speed_factor numeric(3,2) not null default 1.0,
  hours jsonb not null default '{}'::jsonb,
  delay_until timestamptz,
  days_off int[] not null default '{}',
  active boolean not null default true,
  unique (org_id, code)
);

create table services (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  provider_id uuid references providers(id) on delete set null,
  name text not null, price numeric(10,2) not null default 0 check (price >= 0),
  duration_min int not null default 15 check (duration_min between 2 and 480),
  category text, active boolean not null default true
);

-- ── patients (per-tenant, never global) ────────────────────────────────────
create table patients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  phone_e164 text not null, name text, locale text, dob date, notes text,
  consent jsonb not null default '{"wa":true,"marketing":false}'::jsonb,
  last_provider_id uuid references providers(id) on delete set null,
  last_visit_at timestamptz, visits int not null default 0,
  blocked boolean not null default false,
  created_at timestamptz not null default now(),
  unique (org_id, phone_e164)
);

-- ── leads / CRM ────────────────────────────────────────────────────────────
create table leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  patient_id uuid references patients(id) on delete set null,
  phone_e164 text not null, name text,
  source text not null default 'wa_inbound',
  first_message text, intent text, service_interest text,
  stage text not null default 'enquiry',
  est_value numeric(10,2) not null default 0, probability int not null default 15,
  owner_id uuid, next_action text, next_action_at timestamptz,
  last_inbound_at timestamptz, last_action_at timestamptz,
  followups_sent int not null default 0, via text,
  lost_reason text, do_not_contact boolean not null default false,
  awaiting text, awaiting_rating uuid,
  created_at timestamptz not null default now(),
  unique (org_id, phone_e164)
);

create table lead_events (
  id bigserial primary key,
  org_id uuid not null references orgs(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  type text not null, payload jsonb, actor_id uuid,
  created_at timestamptz not null default now()
);

-- ── queue ──────────────────────────────────────────────────────────────────
create table tokens (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  patient_id uuid references patients(id) on delete set null,
  provider_id uuid not null references providers(id) on delete cascade,
  day date not null default ist_today(),
  number int not null,
  state text not null default 'BOOKED'
    check (state in ('BOOKED','ARRIVED','CALLED','IN_CONSULT','DONE','SKIPPED','HOLD','CANCELLED')),
  source text not null default 'walkin',
  reason text, service_id uuid references services(id) on delete set null,
  priority int not null default 100 check (priority between 0 and 100),
  committed_at timestamptz, eta_at timestamptz, leave_by_at timestamptz,
  travel_minutes int, queue_position int, ahead int,
  checked_in_at timestamptz, called_at timestamptz, done_at timestamptz,
  hold_until timestamptz, alerts_sent jsonb not null default '{}'::jsonb,
  created_by uuid, created_at timestamptz not null default now(),
  unique (org_id, provider_id, day, number)
);
create index tokens_queue_idx on tokens (org_id, day, provider_id, state, priority, number);
create index tokens_eta_idx on tokens (org_id, eta_at);

create table queue_events (
  id bigserial primary key,
  org_id uuid not null references orgs(id) on delete cascade,
  token_id uuid, provider_id uuid,
  type text not null, payload jsonb, actor_id uuid,
  created_at timestamptz not null default now()
);
create index queue_events_org_idx on queue_events (org_id, created_at desc);

create table provider_stats (
  id bigserial primary key,
  org_id uuid not null references orgs(id) on delete cascade,
  provider_id uuid not null references providers(id) on delete cascade,
  service_id uuid, bucket text not null default 'all',
  samples int not null default 0, ewma_minutes numeric(6,2),
  ewma_arrival_lag_min numeric(6,2), no_show_rate numeric(4,3),
  updated_at timestamptz not null default now(),
  unique (org_id, provider_id, service_id, bucket)
);

-- ── whatsapp ───────────────────────────────────────────────────────────────
create table wa_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  lane text not null check (lane in ('baileys','meta','mock')),
  phone_e164 text, status text not null default 'pending'
    check (status in ('pending','connected','disconnected','banned')),
  creds_enc bytea, meta jsonb, last_seen_at timestamptz, health jsonb,
  created_at timestamptz not null default now()
);

create table messages (
  id bigserial primary key,
  org_id uuid not null references orgs(id) on delete cascade,
  patient_id uuid, lead_id uuid,
  direction text not null check (direction in ('in','out')),
  lane text, wa_message_id text, template text, kind text default 'transactional',
  body text, media_url text, status text, buttons jsonb,
  tokens_used int, cost_inr numeric(8,3),
  created_at timestamptz not null default now()
);
create index messages_org_idx on messages (org_id, created_at desc);

-- ── lab ────────────────────────────────────────────────────────────────────
create table prescriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  patient_id uuid references patients(id) on delete set null,
  media_url text, vision_json jsonb, confidence numeric(3,2),
  status text not null default 'new' check (status in ('new','quoted','booked','collected','reported','rejected')),
  quoted_total numeric(10,2), fasting_hours int,
  created_at timestamptz not null default now()
);

create table collections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  prescription_id uuid references prescriptions(id) on delete set null,
  patient_id uuid references patients(id) on delete set null,
  technician_id uuid references providers(id) on delete set null,
  slot_start timestamptz, slot_end timestamptz,
  geo_lat numeric(9,6), geo_lng numeric(9,6), address_text text,
  status text not null default 'scheduled'
    check (status in ('scheduled','assigned','collected','reported','cancelled')),
  report_url text, reported_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── reviews ────────────────────────────────────────────────────────────────
create table review_asks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  token_id uuid, asked_at timestamptz not null default now(),
  channel text, clicked_at timestamptz, feedback_rating int,
  suppressed_reason text
);

create table feedback (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  patient_id uuid, token_id uuid,
  rating int not null check (rating between 1 and 5),
  comment text, routed_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table recalls (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  service_id uuid, due_at date not null,
  sent_at timestamptz, outcome text
);

-- ── billing ────────────────────────────────────────────────────────────────
create table payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  kind text not null check (kind in ('pilot','setup','subscription','addon')),
  plan text, period text default 'monthly', method text,
  amount_inr numeric(10,2) not null, status text not null default 'pending'
    check (status in ('pending','paid','failed','refunded')),
  ref text unique, razorpay_order_id text, razorpay_payment_id text,
  gst_invoice_no text, paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- ── knowledge base ─────────────────────────────────────────────────────────
create table kb_docs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id) on delete cascade,
  source text not null, title text, text text not null,
  embedding vector(768),                        -- requires pgvector in production
  updated_at timestamptz not null default now()
);

-- ── audit ──────────────────────────────────────────────────────────────────
create table audit_log (
  id bigserial primary key,
  org_id uuid, actor text, action text not null, entity text, entity_id uuid,
  ip inet, payload jsonb, created_at timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════════
-- RLS — every tenant table. org_id is set per-transaction from the JWT claim.
-- ════════════════════════════════════════════════════════════════════════
do $$
declare t text;
begin
  foreach t in array array[
    'providers','services','patients','leads','lead_events','tokens','queue_events',
    'provider_stats','wa_sessions','messages','prescriptions','collections',
    'review_asks','feedback','recalls','payments','kb_docs','org_members'
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

alter table orgs enable row level security;
create policy org_self on orgs
  using (id = nullif(current_setting('app.current_org', true), '')::uuid);

-- helper the API calls at the start of every transaction
create or replace function set_tenant(p_org uuid) returns void language plpgsql as $$
begin
  perform set_config('app.current_org', p_org::text, true);
end $$;

-- ════════════════════════════════════════════════════════════════════════
-- Queue helpers (idempotent call-next, per-provider numbering)
-- ════════════════════════════════════════════════════════════════════════
create or replace function next_token_number(p_org uuid, p_provider uuid, p_day date)
returns int language sql as $$
  select coalesce(max(number), 0) + 1 from tokens
   where org_id = p_org and provider_id = p_provider and day = p_day
$$;

create or replace function call_next(p_org uuid, p_provider uuid, p_actor uuid default null)
returns tokens language plpgsql as $$
declare v_tok tokens;
begin
  perform pg_advisory_xact_lock(hashtext(p_org::text || ':' || p_provider::text));
  -- already serving? idempotent
  select * into v_tok from tokens
   where org_id = p_org and provider_id = p_provider
     and day = ist_today()
     and state in ('CALLED','IN_CONSULT') limit 1;
  if found then return v_tok; end if;

  select * into v_tok from tokens
   where org_id = p_org and provider_id = p_provider
     and day = ist_today()
     and state in ('ARRIVED','BOOKED')
   order by priority asc, number asc limit 1 for update;
  if not found then return null; end if;

  update tokens set state='CALLED', called_at=now() where id = v_tok.id returning * into v_tok;
  insert into queue_events(org_id, token_id, provider_id, type, actor_id)
    values (p_org, v_tok.id, p_provider, 'called', p_actor);
  return v_tok;
end $$;

-- ETA recompute for one provider (mirrors src/eta.js)
create or replace function recompute_eta(p_org uuid, p_provider uuid)
returns void language plpgsql as $$
declare r record; v_cursor timestamptz := now(); v_dur int; v_avg numeric;
begin
  select coalesce(ps.ewma_minutes, p.avg_minutes) into v_avg
    from providers p left join provider_stats ps
      on ps.org_id=p.org_id and ps.provider_id=p.id
   where p.org_id=p_org and p.id=p_provider;

  for r in select * from tokens
            where org_id=p_org and provider_id=p_provider
              and day=ist_today()
              and state in ('BOOKED','ARRIVED','CALLED','IN_CONSULT')
            order by priority asc, number asc loop
    v_dur := coalesce((select duration_min from services where id=r.service_id), coalesce(v_avg,10)::int);
    if r.state in ('CALLED','IN_CONSULT') then
      v_cursor := greatest(now(), coalesce(r.called_at, now()) + (v_dur || ' minutes')::interval);
    end if;
    update tokens set eta_at = v_cursor, ahead = (select count(*) from tokens x
        where x.org_id=p_org and x.provider_id=p_provider and x.day=r.day
          and x.state in ('BOOKED','ARRIVED','CALLED','IN_CONSULT')
          and (x.priority, x.number) < (r.priority, r.number)),
      leave_by_at = v_cursor - ((coalesce(r.travel_minutes,20) + 10) || ' minutes')::interval
     where id = r.id;
    v_cursor := v_cursor + (v_dur || ' minutes')::interval;
  end loop;
end $$;
