const { PGlite, AUTH_STUB, applyMigrations } = require("./migrate.js");
const { SUPABASE_DEFAULTS } = require("./defaults.js");

(async () => {
  const db = await PGlite.create();
  await db.exec(AUTH_STUB);
  await db.exec(SUPABASE_DEFAULTS);
  for (const f of ["0001_init.sql", "0002_rapid_response.sql", "0003_admin_role_hardening.sql", "0004_anonymous_access_privacy.sql"]) {
    const r = (await applyMigrations(db, [f]))[0];
    if (!r.ok) { console.log("FAILED", f, r.error); process.exit(1); }
  }
  for (const name of ["is_admin", "is_staff", "grant_role"]) {
    const r = await db.query(
      "select pg_get_functiondef(p.oid) d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=$1",
      [name]);
    console.log("---------- " + name + " ----------");
    console.log(r.rows[0].d);
  }
  await db.close();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });