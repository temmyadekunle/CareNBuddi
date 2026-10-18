/**
 * Source-level regression tests for the anonymous-access and privacy
 * corrections in 0004_anonymous_access_privacy.sql.
 *
 * These assert the *text* of the migration and the surrounding contract, and
 * they run in the normal `npm test` suite with no database. They cannot prove
 * that a policy behaves; that is the PGlite suite's job, and it is a different
 * test run. A green result here is not a substitute for it.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const m4 = read("supabase/migrations/0004_anonymous_access_privacy.sql");
const m2 = read("supabase/migrations/0002_rapid_response.sql");
const m3 = read("supabase/migrations/0003_admin_role_hardening.sql");
const rapid = read("docs/rapid-response.md");

/**
 * The migration explains at length why it does things, and that prose quotes
 * the very statements the negative assertions forbid ("deliberately NOT created
 * with security_invoker = true"). Negative assertions therefore run against
 * executable SQL only; positive ones still read the comments, because there the
 * reasoning is the thing being asserted.
 */
const stripComments = (sql: string) => sql.replace(/--[^\n]*/g, "");
const m4c = stripComments(m4);
const m2c = stripComments(m2);

/* ------------------------------------------------- Finding A: is_staff() */

test("0004 re-grants EXECUTE on is_staff() to anon", () => {
  assert.match(m4, /grant\s+execute\s+on\s+function\s+public\.is_staff\(\)\s+to\s+anon/);
});

test("0004 does not re-grant is_admin() to any client role", () => {
  // is_admin() is the function that actually decides staff. Only is_staff()
  // needs to be callable by anon, because only is_staff() appears in policies.
  assert.doesNotMatch(m4c, /grant\s+execute\s+on\s+function\s+public\.is_admin\(\)/);
  assert.doesNotMatch(m4c, /grant\s+execute\s+on\s+all\s+functions/);
});

test("0004 leaves 0003's revoke of is_staff() from anon in place as history", () => {
  // 0003 must keep its own statement: 0004 is additive, not a rewrite.
  assert.match(m3, /revoke\s+all\s+on\s+function\s+public\.is_staff\(\)\s+from\s+public,\s*anon/);
});

test("is_staff() still means administrator after 0004", () => {
  // The grant is safe only because the function body is unchanged: it keys on
  // auth.uid(), which is NULL for an anonymous caller.
  const fn = m3.slice(m3.indexOf("create or replace function public.is_staff()"));
  const body = fn.slice(0, fn.indexOf("$$;"));
  assert.match(body, /select\s+public\.is_admin\(\)/);
  assert.doesNotMatch(body, /'provider'/, "a provider must not satisfy is_staff()");

  const admin = m3.slice(m3.indexOf("create or replace function public.is_admin()"));
  const adminBody = admin.slice(0, admin.indexOf("$$;"));
  assert.match(adminBody, /id\s*=\s*auth\.uid\(\)/);
  assert.match(adminBody, /role\s*=\s*'admin'/);
});

test("0004 does not weaken any role check or grant write access", () => {
  assert.doesNotMatch(m4c, /disable\s+row\s+level\s+security/i);
  assert.doesNotMatch(m4c, /alter\s+table[\s\S]*?force\s+row\s+level\s+security/i);
  assert.doesNotMatch(m4c, /revoke\s+execute\s+on\s+function\s+public\.grant_role/);
  assert.doesNotMatch(m4c, /grant\s+execute[\s\S]*?grant_role/);
  assert.doesNotMatch(m4c, /revoke\s+update\s+on\s+public\.profiles/);
});

/* ----------------------------------------------- Finding B: the roster */

test("0004 removes the world-readable policy on the participation base table", () => {
  assert.match(m4, /drop\s+policy\s+if\s+exists\s+participation_select_public\s+on\s+public\.provider_emergency_participation/);
  // And 0002 is left intact, so the drop is the only thing that changes it.
  assert.match(m2, /create\s+policy\s+participation_select_public[\s\S]*?for\s+select\s+using\s*\(true\)/);
});

test("0004 does not replace USING (true) with a cosmetic predicate on the same table", () => {
  // A new permissive SELECT policy on the base table would just re-open the
  // table. The public surface must be the projection, not the table.
  assert.doesNotMatch(m4c, /create\s+policy[\s\S]*?on\s+public\.provider_emergency_participation\b/);
});

test("the public projection exposes only non-private columns", () => {
  const view = m4.slice(m4.indexOf("create or replace view public.provider_emergency_participation_public"));
  const selectList = view.slice(view.indexOf("select"), view.indexOf("from public.provider_emergency_participation"));
  for (const col of ["provider_id", "display_name", "accepts_emergency_requests", "coverage_area"]) {
    assert.match(selectList, new RegExp(`\\b${col}\\b`), `public projection must expose ${col}`);
  }
  for (const col of ["phone", "last_seen_at", "created_at", "updated_at"]) {
    assert.doesNotMatch(selectList, new RegExp(`\\b${col}\\b`), `public projection must not expose ${col}`);
  }
  // select * would silently widen the surface as columns are added.
  assert.doesNotMatch(selectList, /\*/);
});

test("the public projection is read-only for client roles", () => {
  assert.match(m4, /revoke\s+insert,\s*update,\s*delete\s+on\s+public\.provider_emergency_participation_public\s+from\s+public,\s*anon,\s*authenticated/);
  assert.match(m4, /grant\s+select\s+on\s+public\.provider_emergency_participation_public\s+to\s+anon,\s*authenticated,\s*service_role/);
});

test("the projection is deliberately not security_invoker, and says so", () => {
  // Owner-privileged reads are what let a public projection exist while the
  // base table stays locked. If someone flips this, the view returns zero rows
  // to anonymous callers - fail-closed - so the mistake is not a leak. The
  // migration must warn about it either way.
  assert.doesNotMatch(m4c, /security_invoker\s*=\s*true/);
  assert.match(m4, /bypass the base table's RLS/);
  assert.match(m4, /fail-closed/);
});

test("participation writes stay administrator-only after 0004", () => {
  // participation_write_staff is `for all using (is_staff())`; 0004 must not add
  // any policy that would let a provider self-activate.
  assert.match(m2, /create\s+policy\s+participation_write_staff[\s\S]*?for\s+all\s+using\s*\(public\.is_staff\(\)\)/);
  assert.doesNotMatch(m4c, /participation_write_staff/);
});

/* ------------------------------------------- emergency integrity intact */

test("0004 does not touch the emergency request or audit policies", () => {
  for (const name of [
    "emergency_requests_insert",
    "emergency_requests_select",
    "emergency_requests_update_staff",
    "emergency_events_insert_staff",
    "emergency_events_select",
  ]) {
    assert.ok(!m4c.includes(name), `0004 must not redefine ${name}`);
  }
  // The bare name would also match the column `accepts_emergency_requests`
  // exposed by the projection, so the boundary must exclude an identifier
  // character in front of it.
  assert.doesNotMatch(m4c, /(?<!\w)emergency_requests\b/i, "0004 must not alter the emergency request table");
  assert.doesNotMatch(m4c, /(?<!\w)emergency_request_events\b/i, "0004 must not alter the audit trail");
});

test("a requester still cannot fabricate a dispatch", () => {
  const ins = m2.slice(m2.indexOf("create policy emergency_requests_insert"));
  assert.match(ins, /with\s+check\s*\(auth\.uid\(\)\s*=\s*user_id\s+or\s+auth\.uid\(\)\s+is\s+null\)/);
  // The status machine is staff-only in USING and WITH CHECK.
  const upd = m2.slice(m2.indexOf("create policy emergency_requests_update_staff"));
  assert.match(upd, /for\s+update\s+using\s*\(public\.is_staff\(\)\)\s+with\s+check\s*\(public\.is_staff\(\)\)/);
});

test("the audit trail stays append-only with no UPDATE policy", () => {
  assert.match(m2, /create\s+policy\s+emergency_events_insert_staff[\s\S]*?for\s+insert/);
  assert.doesNotMatch(m2c, /create\s+policy\s+\w+\s+on\s+public\.emergency_request_events\s+for\s+update/);
  assert.doesNotMatch(m4c, /emergency_request_events[\s\S]*?for\s+update/);
});

/* --------------------------------------------- the documented contract */

test("the documented RBAC table no longer promises a public read of phone numbers", () => {
  const row = rapid.slice(rapid.indexOf("| Anonymous / requester"));
  assert.ok(row.length > 0, "the RBAC table must still document the anon row");
  // It may still describe a public capability, but only through the projection.
  assert.doesNotMatch(row, /provider_emergency_participation[^|]*\|\s*SELECT \(public\)/);
  assert.match(rapid, /provider_emergency_participation_public/);
});

test("no source file reads provider_emergency_participation directly", () => {
  // The /emergency facility list is built from the in-app provider directory.
  // This is the reason a public projection is sufficient and no app change is
  // needed: nothing consumes the base table.
  const rapidResponse = read("lib/rapid-response.ts");
  assert.doesNotMatch(rapidResponse, /provider_emergency_participation/);
  assert.match(rapidResponse, /emergency\s*===\s*true/);
});
