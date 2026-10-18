/**
 * Supabase's baseline privileges, replicated.
 *
 * ORDER MATTERS, and getting it wrong invalidates the whole run.
 *
 * On a real project these are `alter default privileges` configured when the
 * project is created, so every table and function a migration creates is
 * granted at CREATE time. A later migration that revokes therefore wins.
 *
 * Applying blanket grants AFTER the migrations is not equivalent: it re-grants
 * full UPDATE on profiles and re-grants EXECUTE on grant_role() to anon and
 * authenticated, silently undoing 0003 and making every assertion meaningless.
 *
 * Without any of this, every SELECT as `authenticated` fails with "permission
 * denied for table", which looks like a passing zero-row assertion but is only
 * a missing grant. With it, RLS is what decides, exactly as on a real project.
 */
const SUPABASE_DEFAULTS = `
grant usage on schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant all on functions to service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
`;

module.exports = { SUPABASE_DEFAULTS };