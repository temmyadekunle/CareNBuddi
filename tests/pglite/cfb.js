/**
 * Confirms the migration-ordering blocker with the exact server error, and
 * checks whether it is 0001 alone or 0003 as well.
 */
const { PGlite, AUTH_STUB, REPO } = require("./migrate.js");
const { SUPABASE_DEFAULTS } = require("./defaults.js");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const read = (f) => readFileSync(join(REPO, "supabase", "migrations", f), "utf8");

(async () => {
  const db = await PGlite.create();
  await db.exec(AUTH_STUB);
  await db.exec(SUPABASE_DEFAULTS);

  console.log("A) defaults on (check_function_bodies = on), as on a real project");
  try {
    await db.exec(read("0001_init.sql"));
    console.log("   0001 applied under strict checking (this is the fix: it used to fail here)");
  } catch (e) {
    console.log("   0001 FAILED: " + e.message.replace(/\s+/g, " ").trim());
  }

  console.log("\nB) 0001+0002 with checks off, then 0003 with checks ON");
  await db.exec("set check_function_bodies = off;");
  await db.exec(read("0001_init.sql"));
  await db.exec(read("0002_rapid_response.sql"));
  try {
    await db.exec("set check_function_bodies = on;");
    await db.exec(read("0003_admin_role_hardening.sql"));
    console.log("   0003 applied cleanly with function-body checking ENABLED");
  } catch (e) {
    console.log("   0003 FAILED: " + e.message.replace(/\s+/g, " ").trim());
  }

  const rel = await db.query(
    "select exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='is_staff') as present");
  console.log("   is_staff() present after the full sequence: " + rel.rows[0].present);

  await db.close();
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});