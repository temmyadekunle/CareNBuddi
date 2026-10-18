/**
 * Applies the CareNBuddi migrations to a disposable in-memory PostgreSQL and
 * reports whether they parse and execute.
 *
 * The auth schema is a STUB. Supabase normally provides auth.users, auth.uid()
 * and GoTrue. Here they are created by hand to mirror Supabase's documented
 * semantics, because nothing else in this repository depends on their
 * internals. Everything in public/ is the real migration SQL, unmodified.
 */
const { PGlite } = require("@electric-sql/pglite");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const REPO = process.env.REPO ?? "C:/Users/USER/AppData/Local/Temp/opencode/carenbuddi-fix";

/** Supabase-compatible auth stub. */
const AUTH_STUB = `
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

-- Supabase's auth.role() returns the JWT 'role' claim. The service-role key
-- payload is {"role":"service_role","iss":"supabase"} - it carries a role but
-- no sub, which is why auth.uid() is NULL for service-role requests.
create or replace function auth.role() returns text
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )
$$;

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

-- Supabase grants the client roles usage on schema auth and EXECUTE on the
-- auth helpers, which is why auth.uid() and auth.role() are callable from a
-- policy. Without these the stub cannot evaluate "auth.uid() is null", and an
-- anonymous requester - a documented participant in the emergency flow - cannot
-- be modelled at all.
grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
`;

async function applyMigrations(db, files) {
  const results = [];
  // Strict, and asserted rather than assumed.
  //
  // An earlier version of this harness set check_function_bodies = off so that
  // 0001's forward reference (is_staff() querying public.profiles before the
  // table exists) would not block the remaining SQL. That let the whole suite
  // report a pass while the migration sequence was still impossible to apply to
  // a real database. 0001 has since been reordered, so the workaround is gone
  // and the sequence now runs under the same strictness as a real project.
  await db.exec("set check_function_bodies = on;");
  const setting = await db.query("show check_function_bodies");
  if (String(setting.rows[0].check_function_bodies).toLowerCase() !== "on") {
    throw new Error("harness is not running with check_function_bodies=on");
  }
  for (const f of files) {
    const sql = readFileSync(join(REPO, "supabase", "migrations", f), "utf8");
    try {
      await db.exec(sql);
      results.push({ file: f, ok: true });
    } catch (e) {
      results.push({ file: f, ok: false, error: e.message });
      break;
    }
  }
  return results;
}

module.exports = { PGlite, AUTH_STUB, applyMigrations, REPO };

if (require.main === module) {
  (async () => {
    const db = await PGlite.create();
    try {
      await db.exec(AUTH_STUB);
      console.log("auth stub: created");
    } catch (e) {
      console.log("auth stub FAILED:", e.message);
    }

    const files = [
      "0001_init.sql",
      "0002_rapid_response.sql",
      "0003_admin_role_hardening.sql",
    ];
    for (const r of await applyMigrations(db, files)) {
      console.log(r.ok ? "APPLIED  " : "FAILED  ", r.file, r.ok ? "" : r.error);
      if (!r.ok) break;
    }

    const tables = await db.query(
      "select table_name from information_schema.tables where table_schema='public' order by 1",
    );
    console.log("public tables:", tables.rows.map((t) => t.table_name).join(", "));

    const fns = await db.query(
      "select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1",
    );
    console.log("public functions:", fns.rows.map((f) => f.proname).join(", "));

    await db.close();
  })().catch((e) => {
    console.error("ERR", e.message);
    process.exit(1);
  });
}