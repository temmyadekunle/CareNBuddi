// Why does an anonymous INSERT into emergency_requests violate RLS?
// Is it pre-existing in 0002, or introduced by 0003/0004?
const { PGlite, AUTH_STUB, applyMigrations } = require("./migrate.js");
const { SUPABASE_DEFAULTS } = require("./defaults.js");

const SETS = {
  "0001+0002 (pre-hardening)": ["0001_init.sql", "0002_rapid_response.sql"],
  "0001+0002+0003+0004 (current)": ["0001_init.sql", "0002_rapid_response.sql", "0003_admin_role_hardening.sql", "0004_anonymous_access_privacy.sql"],
};

(async () => {
  for (const [label, files] of Object.entries(SETS)) {
    const db = await PGlite.create();
    await db.exec(AUTH_STUB);
    await db.exec(SUPABASE_DEFAULTS);
    for (const f of files) {
      const r = (await applyMigrations(db, [f]))[0];
      if (!r.ok) { console.log(label, "migration failed", f, r.error); break; }
    }
    await db.exec("reset role; set role anon;");
    await db.exec(`set request.jwt.claims = '{"role":"anon"}';`);

    console.log(`\n=== ${label} ===`);
    // What does the predicate actually evaluate to for an anonymous caller?
    const pred = await db.query(
      "select (auth.uid() = null) as eq_null, (auth.uid() is null) as is_null, auth.uid() as uid");
    console.log("  auth.uid() =", JSON.stringify(pred.rows[0].uid),
      "| uid=user_id ->", pred.rows[0].eq_null,
      "| uid is null ->", pred.rows[0].is_null);

    try {
      await db.query(
        `insert into public.emergency_requests (user_id, requester_name, requester_phone, location_text, status)
         values (null,'QA','+2340000000009','QA loc','created')`);
      console.log("  INSERT: SUCCEEDED");
    } catch (e) {
      console.log("  INSERT: FAILED ->", e.message.replace(/\s+/g, " ").trim());
    }

    // Same insert but omitting user_id entirely.
    try {
      await db.query(
        `insert into public.emergency_requests (requester_name, requester_phone, location_text, status)
         values ('QA2','+2340000000009','QA loc','created')`);
      console.log("  INSERT (user_id omitted): SUCCEEDED");
    } catch (e) {
      console.log("  INSERT (user_id omitted): FAILED ->", e.message.replace(/\s+/g, " ").trim());
    }

    const n = await db.query("select count(*)::int c from public.emergency_requests");
    console.log("  rows in table:", n.rows[0].c);

    const pols = await db.query(
      "select policyname, cmd, qual, with_check from pg_policies where schemaname='public' and tablename='emergency_requests' order by policyname");
    for (const p of pols.rows) console.log(`  policy ${p.policyname} (${p.cmd}) using=${p.qual} check=${p.with_check}`);
    await db.exec("reset role;");
    await db.close();
  }
})().catch((e) => { console.error("ERR", e.message); process.exitCode = 2; });