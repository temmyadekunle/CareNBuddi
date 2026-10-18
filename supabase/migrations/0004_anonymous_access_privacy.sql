-- ============================================================================
-- 0004_anonymous_access_privacy.sql
--
-- Two corrections to the anonymous surface. Both are additive forward changes:
-- 0001, 0002 and 0003 are left exactly as written.
--
-- ---------------------------------------------------------------------------
-- FINDING A - anonymous queries fail with a permission error
--
-- 0003 revoked EXECUTE on public.is_staff() from anon:
--
--     revoke all on function public.is_staff() from public, anon;
--
-- Row level security evaluates a policy expression *as the querying role*, and
-- seven policies OR in public.is_staff():
--
--     using (auth.uid() = id or public.is_staff())      profiles, bookings,
--     using (public.is_staff())                          emergency_requests, ...
--     with check (public.is_staff())                    emergency events
--     using (public.is_staff() or auth.uid() = user_id) provider_requests, reports
--
-- So an anonymous SELECT against any of those tables could not have its policy
-- evaluated at all and raised:
--
--     ERROR: permission denied for function is_staff
--
-- That is fail-closed - no rows and no detail leak - but it is still a broken
-- contract, because the anon key is a documented participant in the emergency
-- flow. docs/rapid-response.md, "RBAC / operations boundary", grants
-- anonymous/requester INSERT own and SELECT own on emergency_requests, and
-- SELECT on its own request's history in emergency_request_events. Those are
-- legitimate anonymous reads, and they now error.
--
-- The correction is a single grant. It is safe because for the anon key
-- auth.uid() is NULL: the anon JWT carries no `sub` claim, so the predicate
--
--     where id = auth.uid() and role = 'admin'
--
-- is never true and is_staff() provably returns false. Granting EXECUTE cannot
-- return data, cannot promote anyone, and cannot be used as an oracle: the
-- function only ever reports the caller's OWN staff status, which for an
-- anonymous caller is always false. What changes is that "denied" becomes
-- "no rows" instead of a raised error.
--
-- is_admin() is deliberately NOT granted to anon. No policy references it; the
-- only caller is is_staff(), which runs as its owner. The administrator-only
-- meaning of is_staff() is unchanged, and no role check is relaxed.
--
-- ---------------------------------------------------------------------------
-- FINDING B - provider phone numbers are world-readable
--
-- 0002 created:
--
--     create policy participation_select_public on public.provider_emergency_participation
--       for select using (true);
--
-- `using (true)` publishes the entire row, and that row carries:
--
--     phone            a provider's contact number
--     coverage_area    where they operate
--     last_seen_at     operational telemetry
--     display_name, accepts_emergency_requests
--
-- The anon key is a public credential - it ships in the browser bundle - so
-- `using (true)` on a table holding phone numbers publishes those numbers to
-- anyone who loads the app. Verified before this migration:
--
--     anon> select provider_id, display_name, phone
--          from public.provider_emergency_participation;
--     [{"provider_id":"prv-1","display_name":"Community Clinic","phone":"+2348..."}]
--
-- The access itself was documented as intended ("Anonymous/requester: SELECT
-- (public)"), so this does not delete the capability. What was wrong was that
-- the capability was expressed as "the whole table" rather than "the part a
-- public badge needs". Nothing in the app reads this table today - the
-- /emergency facility list is built from the in-app provider directory by
-- emergencyFacilities() in lib/rapid-response.ts, and the future partner
-- dashboard sits behind AppGuard's staff gate - so the exposure was pure risk
-- with no reader to justify it.
--
-- The correction keeps the documented public capability and drops the private
-- columns, by publishing a projection instead of the table:
--
--   * the base table loses its USING (true) policy, so it becomes staff-only,
--     exactly like every other coordination table;
--   * a view exposes the four columns a public "does this facility take
--     emergency work, and where" badge needs - and nothing else.
--
-- SECURITY NOTE ON THE VIEW - read this before changing it. The view is owned
-- by the migration runner and is deliberately NOT created with
-- `security_invoker = true`, so its reads execute with the view owner's
-- privileges and bypass the base table's RLS. That is what lets a public
-- projection exist while the base table stays locked; the column list is the
-- entire security boundary, and adding a column to it is a disclosure
-- decision. If this view is ever made security_invoker it will simply return
-- zero rows to anonymous callers - fail-closed, not a leak - so the failure
-- mode of getting this wrong is safe.
--
-- Providers gain nothing from this: `participation_write_staff` is `for all
-- using (public.is_staff())`, and since 0003 is_staff() means administrator, so
-- one provider can neither read nor activate another provider's row. That is
-- unchanged here.
--
-- Emergency-request integrity is untouched: this migration does not alter
-- emergency_requests, emergency_request_events, or any status-machine policy,
-- so a requester still cannot fabricate a dispatch and events stay append-only
-- and staff-written.
--
-- Idempotent: drop-policy-if-exists, create-or-replace, and explicit grants.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Finding A: let anonymous callers evaluate staff-gated policies.
-- ----------------------------------------------------------------------------
grant execute on function public.is_staff() to anon;

-- ----------------------------------------------------------------------------
-- Finding B: the base table stops being world-readable.
-- ----------------------------------------------------------------------------
drop policy if exists participation_select_public on public.provider_emergency_participation;

-- The public projection. Explicit column list - never `select *`.
create or replace view public.provider_emergency_participation_public as
  select
    provider_id,
    display_name,
    accepts_emergency_requests,
    coverage_area
  from public.provider_emergency_participation;

grant select on public.provider_emergency_participation_public to anon, authenticated, service_role;

-- Belt and braces: the view is read-only, and a column dropped from it must not
-- linger in a client's column-level grant.
revoke insert, update, delete on public.provider_emergency_participation_public from public, anon, authenticated;

-- The projection is a new object, so state the intent for the next migration
-- author: private columns live in the base table only.
comment on view public.provider_emergency_participation_public is
  'Public badge projection: providers that take emergency work, and where. '
  'Phone and operational telemetry stay in provider_emergency_participation, '
  'which is readable by administrators (is_staff()) only.';

comment on table public.provider_emergency_participation is
  'Emergency participation roster. Base table is administrator-only; the public '
  'projection is provider_emergency_participation_public.';
