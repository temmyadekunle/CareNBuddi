import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Administrator role escalation - SOURCE-LEVEL regression tests.
 *
 * ============================================================================
 * THESE TESTS DO NOT VERIFY DATABASE SECURITY.
 * ============================================================================
 * They read the migration and the client source and assert that the vulnerable
 * *code* is gone. They cannot tell you whether Postgres would accept a write,
 * whether a policy fires, or whether RLS is enabled. Only the tests in
 * `supabase/tests/admin_role_escalation.sql`, run against a disposable
 * Supabase project, do that. See the report for the setup.
 *
 * The defect being guarded against: public.handle_new_user() copied
 * raw_user_meta_data ->> 'role' into profiles.role, and public.is_staff()
 * returned true for 'provider' as well as 'admin'. Thirteen policies are gated
 * on is_staff(), including reads of every profile and every patient booking.
 */

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

/**
 * Strips `--` line comments so an assertion about SQL is not satisfied or
 * broken by prose. The hardening migration explains itself in comments that
 * legitimately name 'admin'.
 */
function sql(source: string): string {
  return source
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

/** The body of a `create or replace function ...` up to its closing `$$;`. */
function fnBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  if (start === -1) return "";
  const from = source.indexOf("$$", start);
  const end = source.indexOf("$$;", from);
  return sql(source.slice(from, end === -1 ? undefined : end));
}

const m1 = read("../supabase/migrations/0001_init.sql");
const m2 = read("../supabase/migrations/0002_rapid_response.sql");
const m3 = read("../supabase/migrations/0003_admin_role_hardening.sql");
const cloud = read("../lib/supabase/cloud.tsx");
const signIn = read("../app/auth/sign-in/page.tsx");
const signUp = read("../app/auth/sign-up/page.tsx");
const cloudAccount = read("../components/cloud-account.tsx");
const providerRegister = read("../app/(app)/provider/register/page.tsx");

/* ------------------------------------------ the reported trigger defect */

test("0001 did contain the vulnerable role assignment", () => {
  // Guards the premise of this file. 0001 is history and is deliberately left
  // untouched - rewriting an applied migration would desynchronise every
  // database that already ran it. 0003 supersedes it.
  assert.match(
    fnBody(m1, "create or replace function public.handle_new_user()"),
    /raw_user_meta_data\s*->>\s*'role'\s+in\s*\(\s*'consumer'\s*,\s*'provider'\s*,\s*'admin'\s*\)/,
  );
});

test("0003 supersedes it and never lets metadata choose an administrator", () => {
  // 0003 re-creates the function, which is what replaces 0001's version.
  assert.match(m3, /create or replace function public\.handle_new_user\(\)/);
  const body = fnBody(m3, "create or replace function public.handle_new_user()");
  assert.doesNotMatch(body, /'admin'/, "the role assignment must not name 'admin' at all");
  assert.match(body, /raw_user_meta_data\s*->>\s*'role'\s*=\s*'provider'\s+then\s+'provider'/);
  assert.match(body, /else\s+'consumer'/);
});

test("only the hardening migration changes the trigger, and it hardens it", () => {
  // Exactly one migration may re-create handle_new_user() after 0001, and it
  // must be the one that removes the admin branch.
  assert.doesNotMatch(sql(m2), /create or replace function public\.handle_new_user\(\)/);
  assert.doesNotMatch(fnBody(m3, "create or replace function public.handle_new_user()"), /'admin'/);
});

test("no migration grants an administrator from user metadata", () => {
  // Scoped to 0003: the only migration that rewrites the trigger. 0001 is
  // superseded, not edited.
  assert.doesNotMatch(
    fnBody(m3, "create or replace function public.handle_new_user()"),
    /then\s+new\.raw_user_meta_data\s*->>\s*'role'/,
  );
});

/* ------------------------------------------- is_staff() is admin-only */

test("0003 redefines is_staff() to mean administrator", () => {
  const fn = m3.slice(m3.indexOf("create or replace function public.is_staff()"));
  const body = fn.slice(0, fn.indexOf("$$;"));
  assert.doesNotMatch(body, /'provider'/, "is_staff() must not treat a provider as staff");
  assert.match(body, /select\s+public\.is_admin\(\)/);
});

test("is_admin() checks for exactly 'admin'", () => {
  const fn = m3.slice(m3.indexOf("create or replace function public.is_admin()"));
  const body = fn.slice(0, fn.indexOf("$$;"));
  assert.match(body, /role\s*=\s*'admin'/);
  assert.doesNotMatch(body, /'provider'/);
});

/* ------------------------------------- role is not self-assignable */

test("profiles.role is not updatable by an authenticated user", () => {
  assert.match(m3, /revoke\s+update\s+on\s+public\.profiles\s+from\s+authenticated/);
  // And the grant that replaces it must not re-include role.
  const grant = m3.slice(m3.indexOf("grant update (full_name"));
  assert.doesNotMatch(grant.slice(0, grant.indexOf(";")), /\brole\b/);
});

test("0003 does not rely on a trigger or session flag for the role guard", () => {
  // A column grant is deterministic and verifiable. A trigger keyed off a
  // GUC depends on clients being unable to set it, which is an assumption.
  assert.doesNotMatch(m3, /current_setting\(\s*'app\./);
});

/* ------------------------------------- restricted provisioning only */

test("grant_role is revoked from every client role", () => {
  assert.match(
    m3,
    /revoke\s+all\s+on\s+function\s+public\.grant_role\(uuid,\s*text\)\s+from\s+public,\s*anon,\s*authenticated/,
  );
});

test("grant_role refuses roles outside the allowed set and checks the caller", () => {
  const fn = m3.slice(m3.indexOf("create or replace function public.grant_role"));
  assert.match(fn, /security\s+definer/);
  assert.match(fn, /p_role\s+not\s+in\s*\(\s*'consumer'\s*,\s*'provider'\s*,\s*'admin'\s*\)/);
  // The caller check has two branches. The service-role branch is what the
  // Worker's service-role key needs - that JWT carries a role but no sub, so
  // is_admin() alone would be false and the function would be uncallable. The
  // is_admin() branch is defence in depth for a mistaken EXECUTE re-grant, and
  // must not be dropped when the service-role branch exists.
  assert.match(fn, /if\s+coalesce\(auth\.role\(\),\s*''\)\s*<>\s*'service_role'\s+and\s+not\s+public\.is_admin\(\)\s+then/);
  assert.doesNotMatch(
    fn,
    /if\s+coalesce\(auth\.role\(\),\s*''\)\s*<>\s*'service_role'\s+then/,
    "the is_admin() branch must remain for non-service-role callers",
  );
});

test("grant_role is not a backdoor: it cannot promote anybody", () => {
  const fn = m3.slice(m3.indexOf("create or replace function public.grant_role"));
  const body = fn.slice(0, fn.indexOf("$$;", fn.indexOf("as $$")));
  assert.doesNotMatch(body, /current_setting|app\./, "grant_role must not trust a client-set flag");
  // It must actually perform the change it claims to.
  assert.match(body, /update\s+public\.profiles\s+set\s+role\s*=\s*p_role/);
});

/* --------------------------------------------------- client cannot ask */

test("the signup client never requests an administrator", () => {
  assert.match(cloud, /const requestedRole: Role = meta\.role === "provider" \? "provider" : "consumer"/);
  assert.doesNotMatch(cloud, /role: meta\.role/);
});

test("the local user mirror does not take a role from client metadata", () => {
  // The database never grants admin, so mirroring it locally would show
  // staff-only screens that every query behind them denies.
  const fn = cloud.slice(cloud.indexOf("function localUserFor"));
  const body = fn.slice(0, fn.indexOf("\n}", fn.indexOf("function localUserFor")));
  assert.doesNotMatch(body, /user_metadata\?\.role/);
  assert.match(body, /role: profile\?\.role \?\? "consumer"/);
});

/* ----------------------------------- no UI offers an administrator */

test("no signup screen offers an administrator role", () => {
  for (const [name, src] of [
    ["sign-up", signUp],
    ["cloud-account", cloudAccount],
  ] as const) {
    assert.doesNotMatch(src, /value="admin"/, `${name} offers admin as a choice`);
  }
});

test("provider registration still requests the provider role", () => {
  // The legitimate flow must survive: registering as a professional is allowed
  // and is not the same thing as being verified.
  assert.match(providerRegister, /role: "provider"/);
  assert.doesNotMatch(providerRegister, /value="admin"/);
});

test("sign-in is unaffected and still has no offline path", () => {
  assert.doesNotMatch(signIn, /signInOffline/);
  assert.match(signIn, /cloud\.signIn\(email, password\)/);
});

/* --------------------------------- no other migration path re-opens it */

test("no other migration copies a role from metadata or exposes one", () => {
  const combined = m1 + m3;
  assert.doesNotMatch(combined, /raw_user_meta_data\s*->>\s*'role'\s*\n?\s*then/);
  // profiles.role must still be constrained to the three known values.
  assert.match(m1, /role text not null default 'consumer' check \(role in \('consumer', 'provider', 'admin'\)\)/);
});

test("health documents stay owner-only and are not reopened", () => {
  assert.match(m1, /create policy documents_owner_all on public\.health_documents\s+for all using \(auth\.uid\(\) = user_id\)/);
  assert.doesNotMatch(m3, /documents_owner_all/);
});

test("0003 does not touch bookings, applications or any health table", () => {
  // Narrow scope: role hardening only. Data policies are a separate migration.
  assert.doesNotMatch(m3, /on public\.bookings/);
  assert.doesNotMatch(m3, /on public\.health_documents/);
  assert.doesNotMatch(m3, /provider_applications/);
});

test("0003 is idempotent so it can be replayed safely", () => {
  assert.match(m3, /create or replace function public\.handle_new_user\(\)/);
  assert.match(m3, /create or replace function public\.is_staff\(\)/);
  assert.match(m3, /revoke\s+update\s+on public\.profiles from authenticated/);
});