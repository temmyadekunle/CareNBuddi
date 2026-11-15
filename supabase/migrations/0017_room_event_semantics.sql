-- ============================================================================
-- 0017_room_event_semantics.sql
--
-- Final Stage 2 verification. 0015 and 0016 are forward-only and never
-- rewritten. This migration corrects three findings.
--
-- FINDING A - token issuance was recorded as a room opening
--   0015's record_room_opened() ran after a join ticket was minted and wrote a
--   'room_opened' media event. That is evidence that a token was issued, not
--   that a participant connected. The media vocabulary is now:
--
--     join_token_issued        a join token was minted for a participant
--     participant_joined       a provider webhook confirmed a connection
--     participant_left         a provider webhook confirmed a disconnect
--     room_closure_requested   closure was queued (system)
--     room_closure_confirmed   the provider confirmed deletion (2xx/404)
--     room_closure_failed      the provider deletion failed; retryable
--     reconciliation_flagged   a terminal row was queued by reconciliation
--
--   Existing rows are renamed in place. created_at, actor, provider, detail
--   and ordering are preserved; only the event label changes. The append-only
--   trigger is disabled for exactly those four UPDATE statements.
--
-- FINDING B - 0016 dropped the current-verification check
--   0016 replaced log_consultation_join() while renaming its event to
--   join_token_issued, but omitted 0014's rule that the provider's CURRENT
--   verification is checked for every caller. That regression is repaired
--   below. A suspended provider therefore revokes this audit path again.
--
-- FINDING C - webhook idempotency without retaining provider identifiers
--   Participant webhooks carry a SHA-256 dedupe key computed by the Worker
--   from the provider event type and session id. The raw session id is never
--   stored. A partial unique index turns duplicate deliveries into no-ops.
--
--   The dedupe key is opaque: it is not a patient identifier, and logs never
--   carry it, the room name, the session id or any participant field.
--
-- room_opened_at keeps its name for backward compatibility, but now means
-- "the first join token was issued or a participant connection was confirmed".
-- Neither is proof that the other participant joined, and neither is proof
-- that the room was deleted. Only room_closure_confirmed sets room_closed_at.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Media event vocabulary: rename legacy rows, then tighten the constraint
-- ---------------------------------------------------------------------------
alter table public.consultation_media_events
  drop constraint if exists consultation_media_events_event_check;

alter table public.consultation_media_events
  disable trigger consultation_media_events_immutable;

update public.consultation_media_events
   set event = 'join_token_issued'
 where event = 'room_opened';

update public.consultation_media_events
   set event = 'room_closure_requested'
 where event = 'closure_requested';

update public.consultation_media_events
   set event = 'room_closure_confirmed'
 where event = 'closure_confirmed';

update public.consultation_media_events
   set event = 'room_closure_failed'
 where event = 'closure_failed';

alter table public.consultation_media_events
  enable trigger consultation_media_events_immutable;

alter table public.consultation_media_events
  add constraint consultation_media_events_event_check
  check (event in (
    'join_token_issued',
    'participant_joined',
    'participant_left',
    'room_closure_requested',
    'room_closure_confirmed',
    'room_closure_failed',
    'reconciliation_flagged'
  ));

-- Opaque idempotency key for provider webhook deliveries. Empty for events
-- that are not webhook-derived.
alter table public.consultation_media_events
  add column if not exists dedupe_key text not null default ''
    check (char_length(dedupe_key) <= 200);

create unique index if not exists consultation_media_events_dedupe_idx
  on public.consultation_media_events (consultation_id, event, dedupe_key)
  where dedupe_key <> '';

-- 0015's unique (consultation_id, event, detail) made a second participant's
-- connection impossible: presence rows carry no detail, so the room's second
-- join collided with the first. Presence uniqueness is the dedupe key above;
-- every other event keeps the 0015 rule.
alter table public.consultation_media_events
  drop constraint if exists consultation_media_events_consultation_id_event_detail_key;
create unique index if not exists consultation_media_events_event_detail_idx
  on public.consultation_media_events (consultation_id, event, detail)
  where event not in ('participant_joined', 'participant_left');

comment on column public.consultations.room_opened_at is
  'First join-token issuance or confirmed participant connection. Not proof that the other participant joined, and not proof of room deletion.';

-- ---------------------------------------------------------------------------
-- 2. Token issuance is its own event
-- ---------------------------------------------------------------------------
create or replace function public.record_join_token_issued(
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
    (p_id, null, 'system', 'join_token_issued', v_provider, '');

  return true;
end;
$$;

-- 0015's name is kept as a thin alias so an already-deployed Worker cannot
-- write the retired 'room_opened' label while it is being rolled forward.
create or replace function public.record_room_opened(
  p_id uuid,
  p_provider text default ''
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.record_join_token_issued(p_id, p_provider);
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Restore join-audit verification revoked by 0016
-- ---------------------------------------------------------------------------
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
  if not public.is_verified_provider_user(v_row.provider_id) then
    raise exception 'consultation: provider is not verified';
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
    (p_id, auth.uid(), v_role, 'join_token_issued', '');
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Closure events use the room_ prefix
-- ---------------------------------------------------------------------------
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
    (p_id, null, 'system', 'room_closure_requested',
     coalesce(v_row.room_provider, ''), v_reason);

  return jsonb_build_object('state', 'pending', 'changed', true);
end;
$$;

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
      (p_id, null, 'system', 'room_closure_confirmed',
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
    (p_id, null, 'system', 'room_closure_failed',
     coalesce(v_row.room_provider, ''), coalesce(nullif(v_detail, ''), 'provider_error'));

  return 'failed';
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Provider webhook ingestion
-- ---------------------------------------------------------------------------
-- The Worker authenticates the webhook before calling this function and passes
-- an opaque SHA-256 dedupe key. The database resolves the room name to the
-- consultation, so the Worker never needs to read consultation rows and never
-- logs the room. Provider-neutral: the label is supplied by the caller.
create or replace function public.record_room_participant_event(
  p_room_name text,
  p_event text,
  p_provider text default '',
  p_dedupe_key text default ''
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room text := btrim(coalesce(p_room_name, ''));
  v_event text := lower(btrim(coalesce(p_event, '')));
  v_provider text := left(btrim(coalesce(p_provider, '')), 40);
  v_key text := left(btrim(coalesce(p_dedupe_key, '')), 200);
  v_row public.consultations%rowtype;
  v_inserted integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'consultation: service role required';
  end if;
  if v_event not in ('participant_joined', 'participant_left') then
    raise exception 'consultation: invalid media event';
  end if;
  if v_key = '' then
    raise exception 'consultation: dedupe key required';
  end if;
  if v_room !~ '^cnb-[a-f0-9]{32}$' then
    return 'unknown_room';
  end if;

  select * into v_row from public.consultations where room_name = v_room;
  if v_row.id is null then
    return 'unknown_room';
  end if;

  insert into public.consultation_media_events
    (consultation_id, actor_id, actor_role, event, provider, detail, dedupe_key)
  values
    (v_row.id, null, 'system', v_event, v_provider, '', v_key)
  on conflict (consultation_id, event, dedupe_key) where dedupe_key <> ''
  do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return 'duplicate';
  end if;

  -- A confirmed connection is evidence that the room existed even if the
  -- token-issuance write was lost. It still says nothing about deletion.
  if v_event = 'participant_joined' then
    update public.consultations
       set room_opened_at = coalesce(room_opened_at, now()),
           room_provider = case
             when btrim(coalesce(room_provider, '')) = '' then v_provider
             else room_provider
           end
     where id = v_row.id;
  end if;

  return 'recorded';
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Reconciliation treats both token issuance and presence as evidence
-- ---------------------------------------------------------------------------
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
           select 1 from public.consultation_media_events m
            where m.consultation_id = c.id
              and m.event in ('join_token_issued', 'participant_joined')
         )
         or exists (
           select 1 from public.consultation_events e
            where e.consultation_id = c.id
              and e.event in ('join_token_issued', 'joined')
         )
       )
       and c.room_closure_state not in ('pending', 'closed')
       -- Flag a consultation at most once. A failed closure is still claimed
       -- and retried through room_closure_state = 'failed'; re-flagging it on
       -- every tick would collide with the (consultation_id, event, detail)
       -- uniqueness rule and abort the whole reconciliation.
       and not exists (
         select 1 from public.consultation_media_events flagged
          where flagged.consultation_id = c.id
            and flagged.event = 'reconciliation_flagged'
       )
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
-- 7. Grants: same service-role-only boundary as 0015
-- ---------------------------------------------------------------------------
revoke all on function public.record_join_token_issued(uuid, text)
  from public, anon, authenticated;
revoke all on function public.record_room_opened(uuid, text)
  from public, anon, authenticated;
revoke all on function public.request_room_closure(uuid, text)
  from public, anon, authenticated;
revoke all on function public.record_room_closure_result(uuid, boolean, text)
  from public, anon, authenticated;
revoke all on function public.reconcile_room_closures()
  from public, anon, authenticated;
revoke all on function public.record_room_participant_event(text, text, text, text)
  from public, anon, authenticated;

grant execute on function public.record_join_token_issued(uuid, text) to service_role;
grant execute on function public.record_room_opened(uuid, text) to service_role;
grant execute on function public.request_room_closure(uuid, text) to service_role;
grant execute on function public.record_room_closure_result(uuid, boolean, text) to service_role;
grant execute on function public.reconcile_room_closures() to service_role;
grant execute on function public.record_room_participant_event(text, text, text, text) to service_role;
