-- ============================================================================
-- 0014_consultation_authorization.sql
--
-- Stage 2 remediation. Forward-only: 0011 and 0013 are never rewritten.
--
-- FINDING 1 - completion did not verify the caller's account role
--   0011's complete_consultation() checked only that the caller was the
--   assigned provider id. It did not confirm the caller still holds a provider
--   profile, and a repeated call inserted a second 'completed' audit row and
--   overwrote ended_at / completion_note. Completion is now:
--     * restricted to the assigned provider (patients and administrators are
--       refused; clinical completion belongs to the treating provider);
--     * gated on the caller's profile role being 'provider';
--     * idempotent: a replay by the assigned provider returns without writing
--       anything, so ended_at, the note and the audit trail stay intact.
--
--   Current verification status is NOT required for completion. A suspension
--   stops new care, but blocking the treating provider from recording how an
--   already-started session ended would destroy the clinical record. The
--   state machine requires in_progress, which can only be reached while the
--   provider was verified at start.
--
-- FINDING 2 - revocation did not reach the patient's join path
--   consultation_join_context() checked is_verified_provider_user() only when
--   the caller was the provider. A patient whose provider was suspended after
--   booking could still obtain join context and a video token.
--   log_consultation_join() had the same gap.
--
--   Both functions now check the provider's CURRENT verification for every
--   caller, so a suspended or rejected provider cannot receive new join
--   authorization for either participant. The check is server-side; the
--   interface is not trusted.
--
-- FINDING 3 - overlapping starts could race
--   0013 rejects interval overlap inside request_consultation(), but two
--   concurrent transactions with different overlapping starts can both pass
--   that SELECT before either commits. The exact-start unique index does not
--   catch them.
--
--   Every active consultation now owns one row per 15-minute slot it covers in
--   consultation_slot_claims, whose primary key is (provider_id, slot). A
--   concurrent INSERT into the same slot serializes on that unique index and
--   the loser aborts regardless of the transaction's isolation level. This is
--   a discretised exclusion constraint built from the existing 15-minute grid
--   rules; it needs no extension. Adjacent bookings (start = previous end) do
--   not share a slot and remain valid. Terminal states release their claims.
--
--   PGlite runs a single connection, so the SQL suite can prove the constraint
--   and release rules but cannot interleave two live transactions. See the
--   test header for that limitation.
--
--   Pre-existing active rows are backfilled best-effort. If a live database
--   already contains overlapping active consultations, ON CONFLICT DO NOTHING
--   leaves the older pair ambiguous; those rows must be resolved manually.
--   New writes are always protected.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Completion authorization and idempotency
-- ---------------------------------------------------------------------------
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
  v_role text;
  v_note text := left(btrim(coalesce(p_note, '')), 2000);
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

  select role into v_role from public.profiles where id = auth.uid();
  if v_role is distinct from 'provider' then
    raise exception 'consultation: provider account required';
  end if;

  -- Safe replay: the same provider may retry after a network failure without
  -- creating a second audit event or changing the recorded note.
  if v_row.status = 'completed' then
    return;
  end if;
  if v_row.status <> 'in_progress' then
    raise exception 'consultation: session is not in progress';
  end if;

  update public.consultations
     set status = 'completed',
         ended_at = now(),
         completion_note = v_note
   where id = p_id;

  insert into public.consultation_events
    (consultation_id, actor_id, actor_role, event, note)
  values
    (p_id, auth.uid(), 'provider', 'completed', left(v_note, 1000));
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Join authorization follows current verification
-- ---------------------------------------------------------------------------
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

  -- A suspension after booking revokes join authorization for BOTH
  -- participants, not only the provider's own token.
  if not public.is_verified_provider_user(v_row.provider_id) then
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
-- The same current-verification rule applies, so a replayed audit call cannot
-- outlive a suspension.
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
    (p_id, auth.uid(), v_role, 'joined', '');
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Concurrent booking protection: one claim row per occupied 15-min slot
-- ---------------------------------------------------------------------------
create table if not exists public.consultation_slot_claims (
  provider_id uuid not null references public.profiles(id) on delete cascade,
  slot timestamptz not null,
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  primary key (provider_id, slot)
);

create index if not exists consultation_slot_claims_consultation_idx
  on public.consultation_slot_claims (consultation_id);

alter table public.consultation_slot_claims enable row level security;

-- Internal invariant table: no client role reads or writes it.
revoke all on table public.consultation_slot_claims from anon, authenticated;
grant all on table public.consultation_slot_claims to service_role;

-- Best-effort backfill of existing active bookings. New writes below are the
-- enforcing boundary; this only seeds the constraint for pre-existing rows.
insert into public.consultation_slot_claims (provider_id, slot, consultation_id)
select c.provider_id, g.slot, c.id
  from public.consultations c
  cross join lateral generate_series(
    c.scheduled_for,
    c.scheduled_for + make_interval(mins => c.duration_minutes) - interval '15 minutes',
    interval '15 minutes'
  ) as g(slot)
 where c.status in ('requested', 'accepted', 'in_progress')
on conflict (provider_id, slot) do nothing;

-- Friendly pre-check. The AFTER trigger below is the actual concurrency
-- boundary; this avoids doing work only to abort on a unique violation in the
-- common sequential case.
create or replace function public.consultation_guard_overlap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status not in ('requested', 'accepted', 'in_progress') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status in ('requested', 'accepted', 'in_progress') then
    return new;
  end if;
  -- Every active booking must sit on the 15-minute grid. Without this a
  -- service-role insert at an odd minute could overlap another booking while
  -- sharing no claim slot; the client RPCs already enforce the grid.
  if extract(second from new.scheduled_for) <> 0
     or mod(extract(minute from new.scheduled_for)::int, 15) <> 0 then
    raise exception 'consultation: invalid schedule';
  end if;
  if exists (
    select 1
      from public.consultations c
     where c.provider_id = new.provider_id
       and c.id <> new.id
       and c.status in ('requested', 'accepted', 'in_progress')
       and c.scheduled_for < new.scheduled_for + make_interval(mins => new.duration_minutes)
       and c.scheduled_for + make_interval(mins => c.duration_minutes) > new.scheduled_for
  ) then
    raise exception 'consultation: time no longer available';
  end if;
  return new;
end;
$$;

drop trigger if exists consultations_guard_overlap on public.consultations;
create trigger consultations_guard_overlap
  before insert or update on public.consultations
  for each row execute function public.consultation_guard_overlap();

-- Maintains the claim rows. A concurrent duplicate insert fails on the
-- primary key and is translated to the same user-facing error. Terminal
-- states delete their claims, freeing the slot.
create or replace function public.consultation_slot_claims_sync()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.status in ('requested', 'accepted', 'in_progress')
       and old.status in ('requested', 'accepted', 'in_progress') then
      return new;
    end if;
    delete from public.consultation_slot_claims where consultation_id = new.id;
  end if;

  if new.status not in ('requested', 'accepted', 'in_progress') then
    return new;
  end if;

  begin
    insert into public.consultation_slot_claims (provider_id, slot, consultation_id)
    select new.provider_id, g.slot, new.id
      from generate_series(
        new.scheduled_for,
        new.scheduled_for + make_interval(mins => new.duration_minutes) - interval '15 minutes',
        interval '15 minutes'
      ) as g(slot);
  exception when unique_violation then
    raise exception 'consultation: time no longer available';
  end;
  return new;
end;
$$;

drop trigger if exists consultations_slot_claims on public.consultations;
create trigger consultations_slot_claims
  after insert or update on public.consultations
  for each row execute function public.consultation_slot_claims_sync();

-- Trigger helpers are never called directly by a client role.
revoke all on function public.consultation_guard_overlap()
  from public, anon, authenticated;
revoke all on function public.consultation_slot_claims_sync()
  from public, anon, authenticated;
