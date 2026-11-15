-- ============================================================================
-- 0016_consultation_join_token.sql
--
-- Forward-only migration: add join_token_issued event to distinguish
-- token issuance from actual participant join (which comes via Daily webhook).
--
-- This separation ensures audit accuracy:
--   join_token_issued  -- participant requested and received a join token
--   participant_joined -- participant actually entered the Daily room (webhook)
--   participant_left   -- participant left the Daily room (webhook)
-- ============================================================================

-- 1. Add join_token_issued to consultation_events check constraint
alter table public.consultation_events
  drop constraint if exists consultation_events_event_check;

alter table public.consultation_events
  add constraint consultation_events_event_check
  check (event in (
    'requested', 'accepted', 'declined', 'cancelled',
    'started', 'completed', 'expired', 'joined', 'join_token_issued'
  ));

-- 2. Update log_consultation_join to record join_token_issued (not joined)
-- The Worker calls this after minting a join token. Actual participant
-- presence is recorded via Daily webhook -> log_consultation_media_event
-- which writes participant_joined/participant_left to consultation_media_events.
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
    (p_id, auth.uid(), v_role, 'join_token_issued', '');
end;
$$;

-- 3. Grant execute on the updated function
revoke all on function public.log_consultation_join(uuid) from public, anon, authenticated;
grant execute on function public.log_consultation_join(uuid) to authenticated;