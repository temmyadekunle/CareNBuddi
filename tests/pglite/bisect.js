// Bisect the exact anonymous INSERT that failed in privacy.js.
const { PGlite, AUTH_STUB, applyMigrations } = require("./migrate.js");
const { SUPABASE_DEFAULTS } = require("./defaults.js");
const FILES = ["0001_init.sql", "0002_rapid_response.sql", "0003_admin_role_hardening.sql", "0004_anonymous_access_privacy.sql"];

(async () => {
  const db = await PGlite.create();
  await db.exec(AUTH_STUB);
  await db.exec(SUPABASE_DEFAULTS);
  for (const f of FILES) { const r = (await applyMigrations(db, [f]))[0]; if (!r.ok) { console.log("MIGRATION FAILED", f, r.error); process.exitCode = 1; return; } }

  await db.exec("reset role; set role anon;");
  await db.exec(`set request.jwt.claims = '{"role":"anon"}';`);

  const variants = [
    ["plain, no provider_id, no RETURNING",
      "insert into public.emergency_requests (user_id, requester_name, requester_phone, location_text, status) values (null,'QA','+2340000000009','QA loc','created')"],
    ["with provider_id, no RETURNING",
      "insert into public.emergency_requests (user_id, requester_name, requester_phone, location_text, provider_id, status) values (null,'QA','+2340000000009','QA loc','prv-alpha','created')"],
    ["with provider_id AND RETURNING id",
      "insert into public.emergency_requests (user_id, requester_name, requester_phone, location_text, provider_id, status) values (null,'QA','+2340000000009','QA loc','prv-alpha','created') returning id"],
    ["no provider_id, RETURNING id",
      "insert into public.emergency_requests (user_id, requester_name, requester_phone, location_text, status) values (null,'QA','+2340000000009','QA loc','created') returning id"],
    ["RETURNING requester_name (own-ish column)",
      "insert into public.emergency_requests (user_id, requester_name, requester_phone, location_text, status) values (null,'QA','+2340000000009','QA loc','created') returning requester_name"],
  ];

  for (const [label, sql] of variants) {
    try {
      const r = await db.query(sql);
      console.log(`  SUCCEEDED  ${label}  (rows returned: ${r.rows.length})`);
    } catch (e) {
      console.log(`  FAILED     ${label}\n               -> ${e.message.replace(/\s+/g, " ").trim()}`);
    }
  }
  await db.exec("reset role;");
  const total = (await db.query("select count(*)::int c from public.emergency_requests")).rows[0].c;
  console.log("  total rows inserted as anon:", total);
  await db.close();
})().catch((e) => { console.error("ERR", e.message); process.exitCode = 2; });