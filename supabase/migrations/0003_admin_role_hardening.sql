-- ============================================================================
-- 0003_admin_role_hardening.sql
--
-- Closes the privilege-escalation path found in the security audit.
--
-- THE DEFECT
--   public.handle_new_user() copied `raw_user_meta_data ->> 'role'` into
--   profiles.role whenever the value was 'consumer', 'provider' or 'admin'.
--   raw_user_meta_data is supplied by whoever calls auth.signUp, so anybody
--   could create an administrator account by sending role: 'admin'. The UI
--   never offers it, but hiding a control in a browser is not a control.
--
--   That mattered because public.is_staff() returned true for
--   role in ('provider','admin'), and thirteen policies are gated on it -
--   including profiles_select_own and bookings_select, which expose every
--   account's contact details and every patient's name, phone and reason for
--   visit.
--
--   There was a second route to the same blast radius which needed no
--   attacker skill at all: provider registration legitimately sends
--   role: 'provider', and 'provider' satisfies is_staff(). A newly registered
--   provider could read every patient's booking the moment the account existed.
--
-- WHAT THIS MIGRATION DOES
--   1. Signup can never create an administrator. Metadata may request
--      'consumer' or 'provider' only; anything else becomes 'consumer'.
--   2. is_staff() means administrator. A provider is no longer staff.
--   3. profiles.role is no longer self-assignable by any authenticated user.
--   4. Role changes go through one restricted provisioning function that no
--      client role may execute.
--
-- WHAT IT DOES NOT DO
--   - It does not change any existing profiles.role value. Existing
--     administrators keep working and nobody is demoted; see the report for
--     the recovery plan.
--   - It does not touch health data, bookings or applications.
--   - It does not verify any of this by itself. The tests in the report must be
--     run against a disposable Supabase project before this is applied
--     anywhere real.
--
-- Idempotent: uses create-or-replace, drop-policy-if-exists and grants, so it
-- can be applied to an existing database or replayed safely.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Signup assigns the least-privileged role it is allowed to.
--
-- 'provider' is accepted because provider registration is a legitimate signup
-- flow and the provider role carries no data access on its own (see step 2).
-- 'admin' is deliberately absent: it is never assignable from user metadata.
--
-- Registering as a provider still grants no verification. Verification lives in
-- a reviewed application process, not in a signup field.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, phone, role, lang)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    new.email,
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    -- Least privilege. An 'admin' claim in metadata is ignored, not honoured.
    case
      when new.raw_user_meta_data ->> 'role' = 'provider' then 'provider'
      else 'consumer'
    end,
    coalesce(new.raw_user_meta_data ->> 'lang', 'en')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. is_staff() means administrator.
--
-- It previously returned true for 'provider' as well, which handed every
-- newly registered provider read access to all profiles, all bookings and the
-- emergency tables. Narrowing it is a tightening, not a feature removal:
-- nothing in the product currently depends on a provider reading those tables
-- unscoped, and provider-scoped access is intended to arrive with proper
-- care-relationship policies.
--
-- The thirteen policies keep the name they already reference, so this is the
-- smallest change that closes both routes.
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- Kept as the name the policies already use, now meaning administrator only.
  select public.is_admin();
$$;

revoke all on function public.is_admin() from public, anon;
revoke all on function public.is_staff() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_staff() to authenticated;

-- ----------------------------------------------------------------------------
-- 3. profiles.role is not self-assignable.
--
-- profiles_update_own was row-scoped but not column-scoped, so
-- `update public.profiles set role='admin' where id=auth.uid()` satisfied both
-- `using` and `with check`. Withdrawing UPDATE on the table and granting it back
-- per column is deterministic and needs no trigger and no session flag, which
-- keeps it verifiable.
--
-- Everything a person may legitimately change about their own profile stays
-- writable. updated_at is granted because the profiles_set_updated_at trigger
-- writes it.
-- ----------------------------------------------------------------------------
revoke update on public.profiles from authenticated;
grant update (full_name, email, phone, lang, updated_at) on public.profiles to authenticated;

-- ----------------------------------------------------------------------------
-- 4. One restricted way to grant a role.
--
-- Executable only by the service role, i.e. by the Cloudflare Worker. No client
-- role - not even an administrator's session - may call it directly; the Worker
-- authorises the actor first and then applies the change. It is a security
-- definer function so it can write a column the caller cannot.
--
-- The is_admin() guard is defence in depth: if execute were ever re-granted by
-- mistake, an ordinary session still cannot promote anybody.
--
-- VERIFIED DEFECT, corrected here. The guard used to read only
-- `if not public.is_admin()`, and is_admin() is keyed on auth.uid(). A
-- service-role request carries a role claim but NO sub, so auth.uid() is NULL,
-- is_admin() is false and the function refused. But EXECUTE is revoked from
-- authenticated and anon, and an administrator's own session is
-- `authenticated`. The result was that no caller could ever succeed: the only
-- role permitted to execute was the one role that failed the guard. The
-- documented provisioning path was dead on arrival.
--
-- The guard is now "service_role OR an administrator's own session". Neither
-- branch weakens the client boundary: anon and authenticated still cannot
-- execute the function at all, and a re-granted EXECUTE still leaves an ordinary
-- session subject to is_admin().
-- ----------------------------------------------------------------------------
create or replace function public.grant_role(p_user uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_role is null or p_role not in ('consumer', 'provider', 'admin') then
    raise exception 'grant_role: unknown role %', coalesce(p_role, '(null)');
  end if;

  if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
    raise exception 'grant_role: not permitted';
  end if;

  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'grant_role: no such profile';
  end if;

  -- Triggers on the table still apply; updated_at advances as normal.
  update public.profiles set role = p_role where id = p_user;
end;
$$;

revoke all on function public.grant_role(uuid, text) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. Summary of what an unprivileged session can and cannot do afterwards.
--
--   signup with role='admin'      -> profile.role is 'consumer'
--   signup with role='provider'   -> profile.role is 'provider', no data access
--   update own profiles.role      -> permission denied (column not granted)
--   select all profiles/bookings -> denied, is_staff() is false
--   call grant_role()             -> permission denied (revoked from authenticated)
--
-- Administration is reachable only through the Worker's service-role
-- credential, which is not shipped to the browser.
-- ----------------------------------------------------------------------------