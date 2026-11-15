-- ============================================================================
-- 0013_consultation_lifecycle.sql
--
-- Stage 2 findings on 0011, corrected forward-only. 0011 is never rewritten.
--
-- FINDING 1 - overlapping consultations were accepted
--   0011 refuses a second booking only when it starts at exactly the same
--   time as an active one (plus a unique index on provider + start time).
--   A 45-minute session at 10:00 and a 30-minute session at 10:30 therefore
--   both succeeded, giving one provider two overlapping consultations and
--   two patients a claim on the same provider at the same time.
--
--   The availability check is now interval-based:
--
--       existing.start < new.end  AND  existing.end > new.start
--
--   provider_open_slots() applies the same interval to the picker, so a slot
--   that falls inside an active session is no longer offered. The picker
--   cannot know which duration the patient will choose, so a start just
--   before an existing session may still be offered; request_consultation()
--   is the enforcing boundary and refuses the overlapping booking.
--
--   Residual (documented, not claimed solved): two concurrent requests with
--   different but overlapping starts can both pass this check before either
--   commits, because PostgreSQL offers no exclusion constraint here without
--   an additional extension. The unique index still prevents exact-start
--   races, and the window is a single transaction round-trip.
--
-- FINDING 2 - expiry only ran for the caller
--   expire_my_consultations() is correctly scoped to the signed-in account,
--   but nothing expired a consultation whose two participants never open the
--   app again. Its status then stayed requested/accepted forever and its row
--   kept occupying the partial unique index slot for that provider/time.
--
--   expire_stale_consultations() applies the same window rule to every
--   account:
--
--       scheduled_for + duration + 30 minutes < now()
--       and status in ('requested', 'accepted')
--
--   It is SECURITY DEFINER and callable only by the service role, which in
--   this project means the Cloudflare Worker's cron trigger. It requires the
--   service-role claim explicitly (defence in depth if a grant is ever
--   widened), inserts one 'system' audit event per row, and returns the
--   number of consultations expired.
--
--   in_progress sessions are deliberately out of scope: the state machine
--   has no in_progress -> expired edge and a provider may still record a
--   completion note after the join window closes. Expiring them would
--   discard clinical record-keeping.
--
-- Idempotent: create-or-replace and explicit revoke/grant.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Request path: reject any interval overlap, not only an exact start.
-- ---------------------------------------------------------------------------
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

  -- Interval overlap, not equality: an active consultation occupies
  -- [scheduled_for, scheduled_for + duration) and a new one may not
  -- intersect it.
  if exists (
    select 1
      from public.consultations c
     where c.provider_id = p_provider
       and c.status in ('requested', 'accepted', 'in_progress')
       and c.scheduled_for < p_scheduled_for + make_interval(mins => p_duration_minutes)
       and c.scheduled_for + make_interval(mins => c.duration_minutes) > p_scheduled_for
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

-- ---------------------------------------------------------------------------
-- 2. Picker: a start inside an active session is not offered.
-- ---------------------------------------------------------------------------
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
            and c.status in ('requested', 'accepted', 'in_progress')
            and g.gs >= c.scheduled_for
            and g.gs < c.scheduled_for + make_interval(mins => c.duration_minutes)
       )
     order by g.gs
     limit 500;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. System-wide expiry, service-role only.
-- ---------------------------------------------------------------------------
create or replace function public.expire_stale_consultations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_row record;
begin
  -- The Worker presents the service-role key; a human session never can.
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'consultation: service role required';
  end if;

  for v_row in
    update public.consultations
       set status = 'expired'
     where status in ('requested', 'accepted')
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

revoke all on function public.expire_stale_consultations()
  from public, anon, authenticated;
grant execute on function public.expire_stale_consultations()
  to service_role;
