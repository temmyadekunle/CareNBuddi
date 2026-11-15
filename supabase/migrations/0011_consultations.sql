-- ============================================================================
-- 0011_consultations.sql
--
-- Server-authoritative telemedicine consultations.
--
-- A consultation is a scheduled private video session between exactly one
-- patient account and one verified provider account. This file owns the
-- entire lifecycle:
--
--   requested -> accepted -> in_progress -> completed
--        |           |
--        +-----------+--> declined / cancelled / expired
--
-- The browser never writes these tables. Every state change goes through a
-- SECURITY DEFINER function that checks the caller, the assignment and the
-- time window. Row level security gives participants (and administrators for
-- oversight) read access only; there is no INSERT/UPDATE/DELETE policy.
--
-- Video room names are generated here, server-side, and are never exposed by
-- a public URL. The Worker (/api/consultations/join) is the only caller that
-- turns a room name into a short-lived video token, and only after this
-- database confirms the caller is an assigned participant in an open window.
--
-- No seed consultations, demo sessions or room names are inserted.
--
-- Forward-only migration. Never rewrites historical migrations.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.consultations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,

  -- Snapshots written by the guard trigger. Profiles are not publicly
  -- readable, so the participant dashboards need a display name at rest.
  patient_name text not null default '',
  provider_name text not null default '',

  scheduled_for timestamptz not null,
  duration_minutes integer not null check (duration_minutes in (15, 30, 45)),

  status text not null default 'requested'
    check (status in (
      'requested', 'accepted', 'declined', 'cancelled',
      'in_progress', 'completed', 'expired'
    )),

  reason text not null default '' check (char_length(reason) <= 1000),
  patient_consent boolean not null default false,
  consented_at timestamptz,

  -- Unguessable, private room identifier. It is a database column, not a URL,
  -- and is returned only to an assigned participant inside the join window.
  room_name text not null unique
    check (room_name ~ '^cnb-[a-f0-9]{32}$'),

  started_at timestamptz,
  ended_at timestamptz,
  completion_note text not null default '' check (char_length(completion_note) <= 2000),
  decline_reason text not null default '' check (char_length(decline_reason) <= 500),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (patient_id <> provider_id)
);

-- Append-only lifecycle audit. There is deliberately no client write policy;
-- the RPCs below insert rows with the acting user and role.
create table if not exists public.consultation_events (
  id bigint generated always as identity primary key,
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text not null check (actor_role in ('patient', 'provider', 'admin', 'system')),
  event text not null check (event in (
    'requested', 'accepted', 'declined', 'cancelled',
    'started', 'completed', 'expired', 'joined'
  )),
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists consultations_patient_scheduled_idx
  on public.consultations (patient_id, scheduled_for desc);
create index if not exists consultations_provider_scheduled_idx
  on public.consultations (provider_id, scheduled_for desc);
create index if not exists consultations_status_idx
  on public.consultations (status);
-- One open booking per provider per start time. Declined, cancelled, expired
-- and completed rows free the slot again.
create unique index if not exists consultations_active_slot_idx
  on public.consultations (provider_id, scheduled_for)
  where status in ('requested', 'accepted', 'in_progress');
create index if not exists consultation_events_consultation_idx
  on public.consultation_events (consultation_id, created_at);

alter table public.consultations enable row level security;
alter table public.consultation_events enable row level security;

-- Defence in depth: RLS already denies writes, but no client role needs table
-- writes at all. Inserts/updates happen only inside SECURITY DEFINER RPCs.
revoke all on table public.consultations from anon, authenticated;
revoke all on table public.consultation_events from anon, authenticated;
grant select on table public.consultations to authenticated;
grant select on table public.consultation_events to authenticated;

-- ---------------------------------------------------------------------------
-- Integrity trigger
-- ---------------------------------------------------------------------------

-- Enforces the invariants even if a future migration accidentally grants a
-- write path: the patient is the caller, consent is explicit, the provider is
-- verified, the room name is server-generated, and status only moves along
-- the documented lifecycle.
create or replace function public.consultation_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and new.patient_id <> auth.uid() then
      raise exception 'consultation: patient must be the signed-in user';
    end if;
    if new.patient_id = new.provider_id then
      raise exception 'consultation: patient and provider must differ';
    end if;
    if new.patient_consent is not true then
      raise exception 'consultation: consent required';
    end if;
    if new.status <> 'requested' then
      raise exception 'consultation: a new consultation starts as requested';
    end if;
    if not public.is_verified_provider_user(new.provider_id) then
      raise exception 'consultation: provider is not verified';
    end if;

    select coalesce(nullif(btrim(p.full_name), ''), 'Patient')
      into v_name
      from public.profiles p
     where p.id = new.patient_id;
    if v_name is null then
      raise exception 'consultation: patient profile not found';
    end if;
    new.patient_name := left(v_name, 120);

    select coalesce(
             nullif(btrim(a.full_name), ''),
             nullif(btrim(p.full_name), ''),
             'Healthcare provider'
           )
      into v_name
      from public.provider_applications a
      join public.profiles p on p.id = a.user_id
     where a.user_id = new.provider_id;
    new.provider_name := left(coalesce(v_name, 'Healthcare provider'), 120);

    new.room_name := 'cnb-' || replace(gen_random_uuid()::text, '-', '');
    new.patient_consent := true;
    new.consented_at := now();
    new.started_at := null;
    new.ended_at := null;
    new.completion_note := '';
    new.decline_reason := '';
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  -- UPDATE. The scheduling terms are fixed once requested.
  if new.patient_id <> old.patient_id
     or new.provider_id <> old.provider_id
     or new.scheduled_for <> old.scheduled_for
     or new.duration_minutes <> old.duration_minutes
     or new.room_name <> old.room_name
     or new.reason <> old.reason then
    raise exception 'consultation: consultation terms are immutable';
  end if;

  if new.status <> old.status and auth.role() is distinct from 'service_role' then
    if not (
      (old.status = 'requested' and new.status in ('accepted', 'declined', 'cancelled', 'expired'))
      or (old.status = 'accepted' and new.status in ('cancelled', 'in_progress', 'expired'))
      or (old.status = 'in_progress' and new.status = 'completed')
    ) then
      raise exception 'consultation: invalid status transition';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists consultations_guard on public.consultations;
create trigger consultations_guard
  before insert or update on public.consultations
  for each row execute function public.consultation_guard();

drop trigger if exists consultations_updated on public.consultations;
create trigger consultations_updated
  before update on public.consultations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS policies: read-only for participants and administrators
-- ---------------------------------------------------------------------------

drop policy if exists consultations_select_participants on public.consultations;
create policy consultations_select_participants
  on public.consultations
  for select
  to authenticated
  using (
    patient_id = auth.uid()
    or provider_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists consultation_events_select_participants on public.consultation_events;
create policy consultation_events_select_participants
  on public.consultation_events
  for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.consultations c
       where c.id = consultation_id
         and (c.patient_id = auth.uid() or c.provider_id = auth.uid())
    )
  );

-- No INSERT/UPDATE/DELETE policies. All writes are in the RPCs below.

-- ---------------------------------------------------------------------------
-- Lifecycle RPCs
-- ---------------------------------------------------------------------------

-- Patient requests a consultation with a verified provider.
create or replace function public.request_consultation(
  p_provider uuid,
  p_scheduled_for timestamptz,
  p_duration_minutes integer,
  p_reason text,
  p_consent boolean
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient uuid := auth.uid();
  v_role text;
  v_reason text := left(btrim(coalesce(p_reason, '')), 1000);
  v_id uuid;
begin
  if v_patient is null then
    raise exception 'consultation: sign in required';
  end if;

  select role into v_role from public.profiles where id = v_patient;
  if v_role is distinct from 'consumer' then
    raise exception 'consultation: patient account required';
  end if;
  if p_provider is null or p_provider = v_patient then
    raise exception 'consultation: choose another provider';
  end if;
  if not public.is_verified_provider_user(p_provider) then
    raise exception 'consultation: provider is not verified';
  end if;
  if p_consent is not true then
    raise exception 'consultation: consent required';
  end if;
  if p_duration_minutes not in (15, 30, 45) then
    raise exception 'consultation: unsupported duration';
  end if;
  if p_scheduled_for is null
     or p_scheduled_for < now() + interval '10 minutes'
     or p_scheduled_for > now() + interval '30 days' then
    raise exception 'consultation: invalid schedule';
  end if;
  if extract(second from p_scheduled_for) <> 0
     or mod(extract(minute from p_scheduled_for)::int, 15) <> 0 then
    raise exception 'consultation: invalid schedule';
  end if;
  -- Default service window 08:00-18:00 Africa/Lagos (07:00-17:00 UTC).
  -- Provider-specific schedules are not stored yet, so this is the honest
  -- shared window used by provider_open_slots() as well.
  if extract(hour from (p_scheduled_for at time zone 'UTC')) < 7
     or extract(hour from (p_scheduled_for at time zone 'UTC')) >= 17 then
    raise exception 'consultation: outside service hours';
  end if;
  if char_length(v_reason) < 3 then
    raise exception 'consultation: describe what you need';
  end if;
  if exists (
    select 1 from public.consultations
     where provider_id = p_provider
       and scheduled_for = p_scheduled_for
       and status in ('requested', 'accepted', 'in_progress')
  ) then
    raise exception 'consultation: time no longer available';
  end if;

  insert into public.consultations
    (patient_id, provider_id, scheduled_for, duration_minutes, reason, patient_consent)
  values
    (v_patient, p_provider, p_scheduled_for, p_duration_minutes, v_reason, true)
  returning id into v_id;

  insert into public.consultation_events
    (consultation_id, actor_id, actor_role, event, note)
  values
    (v_id, v_patient, 'patient', 'requested', '');

  return v_id;
end;
$$;

-- Assigned provider accepts or declines a pending request.
create or replace function public.respond_consultation(
  p_id uuid,
  p_accept boolean,
  p_reason text default ''
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.consultations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'consultation: sign in required';
  end if;

  select * into v_row from public.consultations where id = p_id for update;
  if v_row.id is null then
    raise exception 'consultation: not found';
  end if;
  if v_row.provider_id <> auth.uid() then
    raise exception 'consultation: not your consultation';
  end if;
  if not public.is_verified_provider_user(auth.uid()) then
    raise exception 'consultation: provider is not verified';
  end if;
  if v_row.status <> 'requested' then
    raise exception 'consultation: request already handled';
  end if;

  if p_accept then
    update public.consultations
       set status = 'accepted'
     where id = p_id;
    insert into public.consultation_events
      (consultation_id, actor_id, actor_role, event, note)
    values
      (p_id, auth.uid(), 'provider', 'accepted', left(coalesce(p_reason, ''), 1000));
  else
    update public.consultations
       set status = 'declined',
           decline_reason = left(coalesce(p_reason, ''), 500)
     where id = p_id;
    insert into public.consultation_events
      (consultation_id, actor_id, actor_role, event, note)
    values
      (p_id, auth.uid(), 'provider', 'declined', left(coalesce(p_reason, ''), 1000));
  end if;
end;
$$;

-- Either participant cancels a consultation that has not started.
create or replace function public.cancel_consultation(
  p_id uuid,
  p_note text default ''
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.consultations%rowtype;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'consultation: sign in required';
  end if;

  select * into v_row from public.consultations where id = p_id for update;
  if v_row.id is null then
    raise exception 'consultation: not found';
  end if;
  if v_row.patient_id = auth.uid() then
    v_role := 'patient';
  elsif v_row.provider_id = auth.uid() then
    v_role := 'provider';
  else
    raise exception 'consultation: not a participant';
  end if;
  if v_row.status not in ('requested', 'accepted') then
    raise exception 'consultation: cannot cancel now';
  end if;

  update public.consultations
     set status = 'cancelled'
   where id = p_id;
  insert into public.consultation_events
    (consultation_id, actor_id, actor_role, event, note)
  values
    (p_id, auth.uid(), v_role, 'cancelled', left(coalesce(p_note, ''), 1000));
end;
$$;

-- Assigned provider opens the session. Allowed from 15 minutes before the
-- scheduled start until 30 minutes after the scheduled end.
create or replace function public.start_consultation(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.consultations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'consultation: sign in required';
  end if;

  select * into v_row from public.consultations where id = p_id for update;
  if v_row.id is null then
    raise exception 'consultation: not found';
  end if;
  if v_row.provider_id <> auth.uid() then
    raise exception 'consultation: not your consultation';
  end if;
  if not public.is_verified_provider_user(auth.uid()) then
    raise exception 'consultation: provider is not verified';
  end if;
  if v_row.status <> 'accepted' then
    raise exception 'consultation: session is not ready to start';
  end if;
  if now() < v_row.scheduled_for - interval '15 minutes' then
    raise exception 'consultation: too early to start';
  end if;
  if now() > v_row.scheduled_for
       + make_interval(mins => v_row.duration_minutes)
       + interval '30 minutes' then
    raise exception 'consultation: session window closed';
  end if;

  update public.consultations
     set status = 'in_progress',
         started_at = now()
   where id = p_id;
  insert into public.consultation_events
    (consultation_id, actor_id, actor_role, event, note)
  values
    (p_id, auth.uid(), 'provider', 'started', '');
end;
$$;

-- Assigned provider records completion and an optional note.
create or replace function public.complete_consultation(
  p_id uuid,
  p_note text default ''
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.consultations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'consultation: sign in required';
  end if;

  select * into v_row from public.consultations where id = p_id for update;
  if v_row.id is null then
    raise exception 'consultation: not found';
  end if;
  if v_row.provider_id <> auth.uid() then
    raise exception 'consultation: not your consultation';
  end if;
  if v_row.status <> 'in_progress' then
    raise exception 'consultation: session is not in progress';
  end if;

  update public.consultations
     set status = 'completed',
         ended_at = now(),
         completion_note = left(coalesce(p_note, ''), 2000)
   where id = p_id;
  insert into public.consultation_events
    (consultation_id, actor_id, actor_role, event, note)
  values
    (p_id, auth.uid(), 'provider', 'completed', left(coalesce(p_note, ''), 1000));
end;
$$;

-- Moves the caller's stale pending/accepted rows to 'expired'. Clients call
-- this when loading a dashboard; it is scoped to the caller's own rows and
-- only ever touches consultations whose full scheduled window has passed.
create or replace function public.expire_my_consultations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_row record;
begin
  if auth.uid() is null then
    raise exception 'consultation: sign in required';
  end if;

  for v_row in
    update public.consultations
       set status = 'expired'
     where (patient_id = auth.uid() or provider_id = auth.uid())
       and status in ('requested', 'accepted')
       and scheduled_for
           + make_interval(mins => duration_minutes)
           + interval '30 minutes' < now()
    returning id
  loop
    insert into public.consultation_events
      (consultation_id, actor_id, actor_role, event, note)
    values
      (v_row.id, null, 'system', 'expired', '');
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Everything the Worker needs to mint a token, and nothing about the other
-- participant's account. Raises for anybody who is not an assigned
-- participant, for a session outside its window, and for an unverified
-- provider.
create or replace function public.consultation_join_context(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.consultations%rowtype;
  v_role text;
  v_opens timestamptz;
  v_closes timestamptz;
begin
  if auth.uid() is null then
    raise exception 'consultation: sign in required';
  end if;

  select * into v_row from public.consultations where id = p_id;
  if v_row.id is null then
    raise exception 'consultation: not found';
  end if;
  if v_row.patient_id = auth.uid() then
    v_role := 'patient';
  elsif v_row.provider_id = auth.uid() then
    v_role := 'provider';
  else
    raise exception 'consultation: not a participant';
  end if;
  if v_role = 'provider' and not public.is_verified_provider_user(auth.uid()) then
    raise exception 'consultation: provider is not verified';
  end if;
  if v_row.patient_consent is not true then
    raise exception 'consultation: consent required';
  end if;
  if v_row.status not in ('accepted', 'in_progress') then
    raise exception 'consultation: session is not active';
  end if;

  v_opens := v_row.scheduled_for - interval '15 minutes';
  v_closes := v_row.scheduled_for
              + make_interval(mins => v_row.duration_minutes)
              + interval '30 minutes';
  if now() < v_opens then
    raise exception 'consultation: session has not opened yet';
  end if;
  if now() > v_closes then
    raise exception 'consultation: session window closed';
  end if;

  return jsonb_build_object(
    'id', v_row.id,
    'status', v_row.status,
    'room_name', v_row.room_name,
    'scheduled_for', v_row.scheduled_for,
    'duration_minutes', v_row.duration_minutes,
    'patient_name', v_row.patient_name,
    'provider_name', v_row.provider_name,
    'reason', v_row.reason,
    'role', v_role,
    'join_opens_at', v_opens,
    'join_closes_at', v_closes
  );
end;
$$;

-- Worker audit hook: records that a participant obtained a join token.
create or replace function public.log_consultation_join(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.consultations%rowtype;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'consultation: sign in required';
  end if;

  select * into v_row from public.consultations where id = p_id;
  if v_row.id is null then
    raise exception 'consultation: not found';
  end if;
  if v_row.patient_id = auth.uid() then
    v_role := 'patient';
  elsif v_row.provider_id = auth.uid() then
    v_role := 'provider';
  else
    raise exception 'consultation: not a participant';
  end if;
  if v_row.status not in ('accepted', 'in_progress') then
    raise exception 'consultation: session is not active';
  end if;
  if now() < v_row.scheduled_for - interval '15 minutes'
     or now() > v_row.scheduled_for
               + make_interval(mins => v_row.duration_minutes)
               + interval '30 minutes' then
    raise exception 'consultation: outside the join window';
  end if;

  insert into public.consultation_events
    (consultation_id, actor_id, actor_role, event, note)
  values
    (p_id, auth.uid(), v_role, 'joined', '');
end;
$$;

-- Server-derived open slots for the booking picker. The grid is deterministic
-- (15-minute steps inside the default 07:00-17:00 UTC service window) and
-- excludes every active consultation already booked with that provider.
-- It reports "no conflicting booking", not a guarantee of availability;
-- the provider still accepts or declines the request.
create or replace function public.provider_open_slots(
  p_provider uuid,
  p_from timestamptz default null,
  p_days integer default 7
) returns table (slot timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_start timestamptz;
  v_end timestamptz;
begin
  if not public.is_verified_provider_user(p_provider) then
    raise exception 'consultation: provider is not verified';
  end if;

  v_start := date_trunc('hour', greatest(coalesce(p_from, now()), now()) + interval '10 minutes');
  v_end := now() + make_interval(days => least(greatest(coalesce(p_days, 7), 1), 14));

  return query
    select g.gs
      from generate_series(v_start, v_end, interval '15 minutes') as g(gs)
     where g.gs >= now() + interval '10 minutes'
       and extract(hour from (g.gs at time zone 'UTC')) between 7 and 16
       and not exists (
         select 1
           from public.consultations c
          where c.provider_id = p_provider
            and c.scheduled_for = g.gs
            and c.status in ('requested', 'accepted', 'in_progress')
       )
     order by g.gs
     limit 500;
end;
$$;

-- Professional directory for the booking picker. Reads verified applications
-- through a SECURITY DEFINER projection, because the base table is
-- administrator-only. Only professional fields are exposed: no email, phone,
-- registration number or licence evidence.
create or replace function public.list_verified_providers(
  p_search text default '',
  p_state text default ''
) returns table (
  user_id uuid,
  full_name text,
  category text,
  speciality text,
  state text,
  city text,
  facility text,
  bio text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    coalesce(nullif(btrim(a.full_name), ''), nullif(btrim(p.full_name), ''), 'Healthcare provider'),
    a.category,
    a.speciality,
    a.state,
    a.city,
    a.facility,
    a.bio
  from public.provider_applications a
  join public.profiles p on p.id = a.user_id
  where a.status = 'verified'
    and p.role = 'provider'
    and (
      btrim(coalesce(p_search, '')) = ''
      or a.full_name ilike '%' || btrim(p_search) || '%'
      or a.speciality ilike '%' || btrim(p_search) || '%'
      or a.facility ilike '%' || btrim(p_search) || '%'
    )
    and (btrim(coalesce(p_state, '')) = '' or a.state = btrim(p_state))
  order by 2
  limit 50;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

revoke all on function public.request_consultation(uuid, timestamptz, integer, text, boolean)
  from public, anon;
revoke all on function public.respond_consultation(uuid, boolean, text) from public, anon;
revoke all on function public.cancel_consultation(uuid, text) from public, anon;
revoke all on function public.start_consultation(uuid) from public, anon;
revoke all on function public.complete_consultation(uuid, text) from public, anon;
revoke all on function public.expire_my_consultations() from public, anon;
revoke all on function public.consultation_join_context(uuid) from public, anon;
revoke all on function public.log_consultation_join(uuid) from public, anon;
revoke all on function public.provider_open_slots(uuid, timestamptz, integer) from public, anon;
revoke all on function public.list_verified_providers(text, text) from public, anon;

grant execute on function public.request_consultation(uuid, timestamptz, integer, text, boolean)
  to authenticated;
grant execute on function public.respond_consultation(uuid, boolean, text) to authenticated;
grant execute on function public.cancel_consultation(uuid, text) to authenticated;
grant execute on function public.start_consultation(uuid) to authenticated;
grant execute on function public.complete_consultation(uuid, text) to authenticated;
grant execute on function public.expire_my_consultations() to authenticated;
grant execute on function public.consultation_join_context(uuid) to authenticated;
grant execute on function public.log_consultation_join(uuid) to authenticated;
grant execute on function public.provider_open_slots(uuid, timestamptz, integer) to authenticated;
grant execute on function public.list_verified_providers(text, text) to authenticated;
