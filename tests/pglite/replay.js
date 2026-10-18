/**
 * Two things the report needs to be able to assert honestly:
 *
 * 1. Replay safety. The strategy for editing 0001 rests on the claim that
 *    re-applying it to a database that already has it changes nothing. That has
 *    to be demonstrated, not asserted - especially since 0001 uses
 *    `create or replace function` and `create table if not exists` throughout.
 *
 * 2. A schema fingerprint before and after, so "no-op" means the same tables,
 *    functions, policies and grants, not merely "no error was raised".
 */
const { PGlite, AUTH_STUB, applyMigrations, REPO } = require("./migrate.js");
const { SUPABASE_DEFAULTS } = require("./defaults.js");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const MIGRATIONS = ["0001_init.sql", "0002_rapid_response.sql", "0003_admin_role_hardening.sql", "0004_anonymous_access_privacy.sql"];

async function fingerprint(db) {
  const tables = (await db.query(
    "select table_name from information_schema.tables where table_schema='public' order by 1")).rows.map((r) => r.table_name);
  const fns = (await db.query(
    `select p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' f
       from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' order by 1`)).rows.map((r) => r.f);
  const pols = (await db.query(
    "select tablename||'.'||policyname||':'||cmd p from pg_policies where schemaname='public' order by 1")).rows.map((r) => r.p);
  const fnBodies = (await db.query(
    `select p.proname||'='||md5(pg_get_functiondef(p.oid)) f
       from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' order by 1`)).rows.map((r) => r.f);
  const colGrants = (await db.query(
    `select table_name||'.'||column_name||':'||grantee g
       from information_schema.column_privileges where table_schema='public'
      order by 1`)).rows.map((r) => r.g);
  return { tables, fns, pols, fnBodies, colGrants };
}

(async () => {
  const db = await PGlite.create();
  await db.exec(AUTH_STUB);
  await db.exec(SUPABASE_DEFAULTS);

  console.log("PASS 1: first application of the sequence");
  for (const f of MIGRATIONS) {
    const r = (await applyMigrations(db, [f]))[0];
    console.log(`  ${r.ok ? "APPLIED" : "FAILED "}  ${f}${r.ok ? "" : "  " + r.error}`);
    if (!r.ok) { await db.close(); process.exitCode = 1; return; }
  }
  const before = await fingerprint(db);

  console.log("\nPASS 2: replaying the same sequence (the idempotency claim)");
  for (const f of MIGRATIONS) {
    const r = (await applyMigrations(db, [f]))[0];
    console.log(`  ${r.ok ? "RE-APPLIED" : "FAILED   "}  ${f}${r.ok ? "" : "  " + r.error}`);
    if (!r.ok) { await db.close(); process.exitCode = 1; return; }
  }
  const after = await fingerprint(db);

  console.log("\n-- fingerprint comparison --");
  let same = true;
  for (const k of Object.keys(before)) {
    const a = JSON.stringify(before[k]);
    const b = JSON.stringify(after[k]);
    const ok = a === b;
    if (!ok) same = false;
    console.log(`  ${ok ? "IDENTICAL" : "CHANGED  "}  ${k} (${before[k].length} entries)`);
    if (!ok) {
      console.log(`      before: ${a}`);
      console.log(`      after:  ${b}`);
    }
  }
  console.log(`\nREPLAY IS A NO-OP: ${same ? "YES" : "NO"}`);

  console.log("\n-- policy inventory --");
  for (const p of after.pols) console.log("  " + p);

  await db.close();
  process.exitCode = same ? 0 : 1;
})().catch((e) => {
  console.error("HARNESS ERROR", e.message);
  process.exitCode = 2;
});