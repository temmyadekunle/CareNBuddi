// Section 8 review item: 0002 grants the world SELECT on
// provider_emergency_participation via `using (true)`, and that table has a
// phone column. Establish whether the anon key can actually read it.
const { PGlite, AUTH_STUB, applyMigrations } = require("./migrate.js");
const { SUPABASE_DEFAULTS } = require("./defaults.js");

(async () => {
  const db = await PGlite.create();
  await db.exec(AUTH_STUB);
  await db.exec(SUPABASE_DEFAULTS);
  for (const f of ["0001_init.sql", "0002_rapid_response.sql", "0003_admin_role_hardening.sql", "0004_anonymous_access_privacy.sql"]) {
    const r = (await applyMigrations(db, [f]))[0];
    if (!r.ok) { console.log("FAILED", f, r.error); process.exitCode = 1; return; }
  }
  await db.query(
    `insert into public.provider_emergency_participation (provider_id, display_name, phone, accepts_emergency_requests, coverage_area)
     values ('prv-1','Community Clinic','+2348000000000',true,'Yaba')`);

  await db.exec("reset role; set role anon;");
  const cols = (await db.query(
    "select column_name from information_schema.columns where table_schema='public' and table_name='provider_emergency_participation' order by 1")).rows.map((r) => r.column_name);
  console.log("columns:", cols.join(", "));
  try {
    const r = await db.query("select provider_id, display_name, phone from public.provider_emergency_participation");
    console.log("ANON READ SUCCEEDED ->", JSON.stringify(r.rows));
  } catch (e) {
    console.log("anon read blocked ->", e.message.replace(/\s+/g, " ").trim());
  }
  await db.exec("reset role;");
  await db.close();
})().catch((e) => { console.error("ERR", e.message); process.exitCode = 2; });