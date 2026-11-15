-- ============================================================================
-- 0015_room_lifecycle.sql
--
-- Backward-compatible room lifecycle controls. 0011/0013 are not rewritten.
--
-- The database cannot and must not decide that a video room was terminated.
-- A consultation row reaching completed/declined/cancelled/expired only means
-- the session is over; the provider-side room may still exist. This migration
-- therefore separates three facts:
--
--   room_opened_at                a room was created for this consultation
--   room_closure_state            not_required | pending | closed | failed
--   room_closed_at                the provider confirmed deletion
--
-- Only a provider confirmation (200 or 404 for an already-absent room) sets
-- room_closed_at. Expiry never does.
--
-- Mechanism
--   * A terminal consultation with an opened room becomes 'pending' in the
--     same transaction that ends it (BEFORE UPDATE trigger).
--   * The Worker claims a small batch, asks the provider adapter to delete the
--     room, and records the result. Claim/confirm RPCs are service-role only.
--   * Re-requesting closure is idempotent: closed stays closed, pending stays
--     pending, failed returns to pending for retry.
--   * record_room_closures()/reconcile_room_closures() finds rooms that should
--     have been closed but were never queued (legacy rows, interrupted jobs)
--     and queues them. Every step is idempotent, so the five-minute cron can
--     replay safely.
--   * consultation_media_events is append-only at the database level. It
--     records room_opened, closure_requested, closure_confirmed,
--     closure_failed and reconciliation_flagged with no client write path.
--
-- Provider neutrality: the table stores a short provider label and the private
-- room name only. Nothing here references Daily. The Worker supplies the
-- provider-specific deletion call, so a future LiveKit adapter can reuse the
-- same queue without a schema change. Daily remains the only adapter in this
-- batch and is not modified.
--
-- Residual: if the Worker fails after a room is created but before
-- record_room_opened, the database cannot see the room. Daily rooms are
-- created with a hard exp/eject_at_room_exp, so the provider still destroys
-- them; reconciliation cannot confirm what it never recorded.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Room state on the consultation row
-- ---------------------------------------------------------------------------
alter table public.consultations
  add column if not exists room_opened_at timestamptz,
  add column if not exists room_provider text
    check (room_provider is null or char_length(room_provider) <= 40),
  add column if not exists room_closed_at timestamptz,
  add column if not exists room_closure_state text not null default 'not_required'
    check (room_closure_state in ('not_required', 'pending', 'closed', 'failed')),
  add column if not exists room_closure_reason text not null default ''
    check (char_length(room_closure_reason) <= 120),
  add column if not exists room_closure_requested_at timestamptz,
  add column if not exists room_closure_last_attempt_at timestamptz,
  add column if not exists room_closure_attempts integer not null default 0
    check (room_closure_attempts >= 0),
  add column if not exists room_closure_last_error text not null default ''
    check (char_length(room_closure_last_error) <= 200);

-- ---------------------------------------------------------------------------
-- 2. Append-only media lifecycle audit
-- ---------------------------------------------------------------------------
create table if not exists public.consultation_media_events (
  id bigint generated always as identity primary key,
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text not null check (actor_role in ('patient', 'provider', 'admin', 'system')),
  event text not null check (event in (
    'room_opened', 'closure_requested', 'closure_confirmed',
    'closure_failed', 'reconciliation_flagged',
    'participant_joined', 'participant_left'
  )),
  provider text not null default '' check (char_length(provider) <= 40),
  detail text not null default '' check (char_length(detail) <= 200),
  created_at timestamptz not null default now(),
  unique (consultation_id, event, detail)
);

create index if not exists consultation_media_events_consultation_idx
  on public.consultation_media_events (consultation_id, created_at);

alter table public.consultation_media_events enable row level security;

drop policy if exists consultation_media_events_select_participants
  on public.consultation_media_events;
create policy consultation_media_events_select_participants
  on public.consultation_media_events
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

revoke all on table public.consultation_media_events from anon, authenticated;
grant select on table public.consultation_media_events to authenticated;

create or replace function public.consultation_media_events_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'consultation: media lifecycle events are append-only';
end;
$$;

drop trigger if exists consultation_media_events_immutable
  on public.consultation_media_events;
create trigger consultation_media_events_immutable
  before update or delete on public.consultation_media_events
  for each row execute function public.consultation_media_events_append_only();

-- ---------------------------------------------------------------------------
-- 3. Terminal transitions queue closure, but never claim closure
-- ---------------------------------------------------------------------------
create or replace function public.consultation_room_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;
  if new.status not in ('completed', 'declined', 'cancelled', 'expired') then
    return new;
  end if;
  if new.room_closed_at is not null then
    return new;
  end if;

  if new.room_opened_at is not null then
    if new.room_closure_state is distinct from 'closed' then
      new.room_closure_state := 'pending';
      new.room_closure_requested_at := coalesce(new.room_closure_requested_at, now());
      if btrim(new.room_closure_reason) = '' then
        new.room_closure_reason := 'consultation_' || new.status;
      end if;
    end if;
  else
    -- No room was ever opened, so there is nothing to terminate. This is not
    -- a claim that a provider-side room was deleted.
    new.room_closure_state := 'not_required';
  end if;
  return new;
end;
$$;

drop trigger if exists consultations_room_lifecycle on public.consultations;
create trigger consultations_room_lifecycle
  before insert or update on public.consultations
  for each row execute function public.consultation_room_lifecycle();

-- ---------------------------------------------------------------------------
-- 4. Service-role-only room operations
-- ---------------------------------------------------------------------------

-- Worker hook, called only after a join ticket was actually minted. Idempotent:
-- the first call records the room, later calls leave it untouched.
create or replace function public.record_room_opened(
  p_id uuid,
  p_provider text default ''
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.consultations%rowtype;
  v_provider text := left(btrim(coalesce(p_provider, '')), 40);
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'consultation: service role required';
  end if;

  select * into v_row from public.consultations where id = p_id for update;
  if v_row.id is null then
    raise exception 'consultation: not found';
  end if;
  if v_row.room_opened_at is not null then
    return false;
  end if;
  if v_row.status not in ('accepted', 'in_progress') then
    raise exception 'consultation: session is not active';
  end if;

  update public.consultations
     set room_opened_at = now(),
         room_provider = v_provider
   where id = p_id;

  insert into public.consultation_media_events
    (consultation_id, actor_id, actor_role, event, provider, detail)
  values
    (p_id, null, 'system', 'room_opened', v_provider, '');

  return true;
end;
$$;

-- Idempotent operator/Worker request. A closed room stays closed; a pending
-- request is returned unchanged; a failed attempt is made eligible again.
create or replace function public.request_room_closure(
  p_id uuid,
  p_reason text default ''
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.consultations%rowtype;
  v_reason text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'consultation: service role required';
  end if;

  select * into v_row from public.consultations where id = p_id for update;
  if v_row.id is null then
    raise exception 'consultation: not found';
  end if;
  if v_row.status not in ('completed', 'declined', 'cancelled', 'expired') then
    raise exception 'consultation: room closure requires a terminal consultation';
  end if;
  if v_row.room_closed_at is not null then
    return jsonb_build_object('state', 'closed', 'changed', false);
  end if;
  if v_row.room_opened_at is null then
    update public.consultations
       set room_closure_state = 'not_required'
     where id = p_id;
    return jsonb_build_object('state', 'not_required', 'changed', false);
  end if;
  if v_row.room_closure_state = 'pending' then
    return jsonb_build_object('state', 'pending', 'changed', false);
  end if;

  v_reason := case
    when btrim(v_row.room_closure_reason) <> '' then v_row.room_closure_reason
    else coalesce(nullif(left(btrim(coalesce(p_reason, '')), 120), ''), 'requested')
  end;

  update public.consultations
     set room_closure_state = 'pending',
         room_closure_requested_at = coalesce(v_row.room_closure_requested_at, now()),
         room_closure_last_attempt_at = null,
         room_closure_reason = v_reason
   where id = p_id;

  insert into public.consultation_media_events
    (consultation_id, actor_id, actor_role, event, provider, detail)
  values
    (p_id, null, 'system', 'closure_requested', coalesce(v_row.room_provider, ''), v_reason);

  return jsonb_build_object('state', 'pending', 'changed', true);
end;
$$;

-- Claim a bounded batch for the Worker. The two-minute backoff means a Worker
-- that died mid-batch is retried, while an immediate duplicate tick does not
-- re-claim the same row. FOR UPDATE SKIP LOCKED keeps overlapping ticks apart.
create or replace function public.claim_room_closure_batch(
  p_limit integer default 10
) returns table (
  consultation_id uuid,
  room_name text,
  attempts integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 50);
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'consultation: service role required';
  end if;

  return query
  with candidates as (
    select c.id
      from public.consultations c
     where c.room_closed_at is null
       and c.room_opened_at is not null
       and c.status in ('completed', 'declined', 'cancelled', 'expired')
       and c.room_closure_state in ('pending', 'failed')
       and (c.room_closure_last_attempt_at is null
            or c.room_closure_last_attempt_at < now() - interval '2 minutes')
     order by c.room_closure_requested_at nulls first, c.id
     limit v_limit
     for update skip locked
  )
  update public.consultations c
     set room_closure_attempts = c.room_closure_attempts + 1,
         room_closure_last_attempt_at = now(),
         room_closure_state = 'pending'
    from candidates k
   where c.id = k.id
  returning c.id, c.room_name, c.room_closure_attempts;
end;
$$;

-- The only path that asserts a room no longer exists. Success requires a
-- provider confirmation; a repeated success is a no-op.
create or replace function public.record_room_closure_result(
  p_id uuid,
  p_success boolean,
  p_detail text default ''
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.consultations%rowtype;
  v_detail text := left(btrim(coalesce(p_detail, '')), 200);
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'consultation: service role required';
  end if;

  select * into v_row from public.consultations where id = p_id for update;
  if v_row.id is null then
    raise exception 'consultation: not found';
  end if;
  if v_row.room_closed_at is not null then
    return 'closed';
  end if;

  if p_success then
    update public.consultations
       set room_closed_at = now(),
           room_closure_state = 'closed',
           room_closure_reason = case
             when btrim(room_closure_reason) = '' then 'closed'
             else room_closure_reason
           end,
           room_closure_last_error = ''
     where id = p_id;

    insert into public.consultation_media_events
      (consultation_id, actor_id, actor_role, event, provider, detail)
    values
      (p_id, null, 'system', 'closure_confirmed',
       coalesce(v_row.room_provider, ''), v_detail);

    return 'closed';
  end if;

  update public.consultations
     set room_closure_state = 'failed',
         room_closure_last_error = coalesce(nullif(v_detail, ''), 'provider_error')
   where id = p_id;

  insert into public.consultation_media_events
    (consultation_id, actor_id, actor_role, event, provider, detail)
  values
    (p_id, null, 'system', 'closure_failed',
     coalesce(v_row.room_provider, ''), coalesce(nullif(v_detail, ''), 'provider_error'));

  return 'failed';
end;
$$;

-- Service-role hook for the Daily webhook to record participant join/leave events.
-- Idempotent: the webhook handler deduplicates by Daily event ID before calling.
create or replace function public.log_consultation_media_event(
  p_id uuid,
  p_event text,
  p_provider text default '',
  p_detail text default ''
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.consultations%rowtype;
  v_event text := lower(btrim(coalesce(p_event, '')));
  v_provider text := left(btrim(coalesce(p_provider, '')), 40);
  v_detail text := left(btrim(coalesce(p_detail, '')), 200);
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'consultation: service role required';
  end if;

  if v_event not in ('participant_joined', 'participant_left') then
    raise exception 'consultation: invalid media event';
  end if;

  select * into v_row from public.consultations where id = p_id for update;
  if v_row.id is null then
    raise exception 'consultation: not found';
  end if;

  insert into public.consultation_media_events
    (consultation_id, actor_id, actor_role, event, provider, detail)
  values
    (p_id, null, 'system', v_event, v_provider, v_detail);
end;
$$;

-- Finds terminal consultations whose room should have been queued but was not
-- (legacy rows, a Worker interruption, a manual status repair). It queues them
-- and reports the durable queue size. It never sets room_closed_at.
create or replace function public.reconcile_room_closures()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
  v_flagged integer := 0;
  v_pending integer;
  v_failed integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'consultation: service role required';
  end if;

  for v_row in
    select c.id
      from public.consultations c
     where c.status in ('completed', 'declined', 'cancelled', 'expired')
       and c.room_closed_at is null
       and (
         c.room_opened_at is not null
         or exists (
           select 1 from public.consultation_events e
            where e.consultation_id = c.id and e.event in ('join_token_issued', 'joined')
         )
       )
       and c.room_closure_state not in ('pending', 'closed')
     for update
  loop
    update public.consultations
       set room_closure_state = 'pending',
           room_closure_requested_at = coalesce(room_closure_requested_at, now()),
           room_closure_reason = coalesce(
             nullif(btrim(room_closure_reason), ''), 'reconciliation'
           )
     where id = v_row.id;

    insert into public.consultation_media_events
      (consultation_id, actor_id, actor_role, event, provider, detail)
    select c.id, null, 'system', 'reconciliation_flagged',
           coalesce(c.room_provider, ''), ''
      from public.consultations c
     where c.id = v_row.id;

    v_flagged := v_flagged + 1;
  end loop;

  select count(*)::int into v_pending
    from public.consultations
   where room_closed_at is null and room_closure_state = 'pending';
  select count(*)::int into v_failed
    from public.consultations
   where room_closed_at is null and room_closure_state = 'failed';

  return jsonb_build_object('flagged', v_flagged, 'pending', v_pending, 'failed', v_failed);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Grants: closure is a backend operation only
-- ---------------------------------------------------------------------------
revoke all on function public.consultation_room_lifecycle()
  from public, anon, authenticated;
revoke all on function public.record_room_opened(uuid, text)
  from public, anon, authenticated;
revoke all on function public.request_room_closure(uuid, text)
  from public, anon, authenticated;
revoke all on function public.claim_room_closure_batch(integer)
  from public, anon, authenticated;
revoke all on function public.record_room_closure_result(uuid, boolean, text)
  from public, anon, authenticated;
revoke all on function public.reconcile_room_closures()
  from public, anon, authenticated;
revoke all on function public.log_consultation_media_event(uuid, text, text, text)
  from public, anon, authenticated;

grant execute on function public.record_room_opened(uuid, text) to service_role;
grant execute on function public.request_room_closure(uuid, text) to service_role;
grant execute on function public.claim_room_closure_batch(integer) to service_role;
grant execute on function public.record_room_closure_result(uuid, boolean, text) to service_role;
grant execute on function public.reconcile_room_closures() to service_role;
grant execute on function public.log_consultation_media_event(uuid, text, text, text) to service_role;
