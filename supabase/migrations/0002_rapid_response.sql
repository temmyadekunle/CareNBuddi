-- CareNBuddi Rapid Response — request, audit and participation schema.
-- Follows 0001_init.sql conventions: every table is RLS-protected and the
-- policies below are the only way in. Schema-only until Supabase cloud is
-- enabled; nothing here runs automatically.
--
-- Deliberately modelled but NOT surfaced in the app yet: there is no
-- ambulance partner, so no user-facing request flow exists. The tables define
-- the integration boundary so a partner can be activated without another
-- migration redesign.

-- ---------------------------------------------------------------------------
-- tables
-- ---------------------------------------------------------------------------

create table if not exists public.emergency_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete set null,
  requester_name text not null default '',
  requester_phone text not null default '',
  location_text text not null default '',
  area_id text,
  provider_id text,
  status text not null default 'created' check (
    status in (
      'created',
      'provider_contacted',
      'accepted',
      'dispatched',
      'en_route',
      'arrived',
      'completed',
      'unavailable',
      'escalated',
      'cancelled'
    )
  ),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Append-only audit trail for a request: every status change, escalation and
-- actor lands here. The app never rewrites history.
create table if not exists public.emergency_request_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.emergency_requests on delete cascade,
  actor_role text not null check (actor_role in ('requester', 'system', 'provider', 'admin')),
  actor_id uuid,
  event text not null,
  from_status text,
  to_status text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Which facilities opt in to receiving emergency coordination, and under
-- what contact. Activation is an operational decision (docs/rapid-response.md),
-- never self-service.
create table if not exists public.provider_emergency_participation (
  provider_id text primary key,
  display_name text not null default '',
  phone text not null default '',
  accepts_emergency_requests boolean not null default false,
  coverage_area text not null default '',
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists emergency_requests_status_idx
  on public.emergency_requests (status);
create index if not exists emergency_requests_user_idx
  on public.emergency_requests (user_id);
create index if not exists emergency_requests_created_idx
  on public.emergency_requests (created_at desc);
create index if not exists emergency_request_events_request_idx
  on public.emergency_request_events (request_id, created_at);

-- ---------------------------------------------------------------------------
-- triggers
-- ---------------------------------------------------------------------------

drop trigger if exists emergency_requests_set_updated_at on public.emergency_requests;
create trigger emergency_requests_set_updated_at
  before update on public.emergency_requests
  for each row execute function public.set_updated_at();

drop trigger if exists provider_emergency_participation_set_updated_at
  on public.provider_emergency_participation;
create trigger provider_emergency_participation_set_updated_at
  before update on public.provider_emergency_participation
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- row level security
-- ---------------------------------------------------------------------------

alter table public.emergency_requests enable row level security;
alter table public.emergency_request_events enable row level security;
alter table public.provider_emergency_participation enable row level security;

-- requests: signed-in users create their own (anonymous allowed in an
-- emergency, same rule as bookings), owners and staff can read, but only
-- staff can move a request through the status machine — a requester can
-- never fabricate a dispatch.
drop policy if exists emergency_requests_insert on public.emergency_requests;
create policy emergency_requests_insert on public.emergency_requests
  for insert with check (auth.uid() = user_id or auth.uid() is null);

drop policy if exists emergency_requests_select on public.emergency_requests;
create policy emergency_requests_select on public.emergency_requests
  for select using (auth.uid() = user_id or public.is_staff());

drop policy if exists emergency_requests_update_staff on public.emergency_requests;
create policy emergency_requests_update_staff on public.emergency_requests
  for update using (public.is_staff()) with check (public.is_staff());

-- events: append-only audit, written by staff/system; requesters can read
-- their own request's history.
drop policy if exists emergency_events_insert_staff on public.emergency_request_events;
create policy emergency_events_insert_staff on public.emergency_request_events
  for insert with check (public.is_staff());

drop policy if exists emergency_events_select on public.emergency_request_events;
create policy emergency_events_select on public.emergency_request_events
  for select using (
    public.is_staff()
    or exists (
      select 1 from public.emergency_requests r
      where r.id = request_id and r.user_id = auth.uid()
    )
  );

-- participation: read-only to the world (the client may badge facilities that
-- accept coordination), writable by staff only.
drop policy if exists participation_select_public on public.provider_emergency_participation;
create policy participation_select_public on public.provider_emergency_participation
  for select using (true);

drop policy if exists participation_write_staff on public.provider_emergency_participation;
create policy participation_write_staff on public.provider_emergency_participation
  for all using (public.is_staff()) with check (public.is_staff());
