/**
 * Phase 3: prove the migration sequence applies end to end on a genuinely
 * clean database, with check_function_bodies = on the whole way.
 *
 * Nothing here reuses a database, a data directory or a dump. PGlite.create()
 * with no dataDir runs initdb from scratch, so this is a true bootstrap.
 *
 * It also audits the state that results, because "the migrations applied" is
 * not the same as "the security survived": the risk in Supabase is that a
 * default privilege silently re-grants what 0003 revoked.
 */
const { PGlite, AUTH_STUB, applyMigrations, REPO } = require("./migrate.js");
const { SUPABASE_DEFAULTS } = require("./defaults.js");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const MIGRATIONS = ["0001_init.sql", "0002_rapid_response.sql", "0003_admin_role_hardening.sql", "0004_anonymous_access_privacy.sql"];
const OUT = [];
const log = (s = "") => { console.log(s); OUT.push(s); };

const as = async (db, role, sub, fn) => {
  await db.exec("reset role;");
  await db.exec(`set role ${role};`);
  await db.exec(`set request.jwt.claims = '${JSON.stringify(sub ? { sub, role } : { role })}';`);
  try {
    const r = await fn();
    return { ok: true, ...r };
  } catch (e) {
    return { ok: false, error: e.message.replace(/\s+/g, " ").trim().slice(0, 160), rows: [] };
  } finally {
    await db.exec("reset role;");
    await db.exec("set request.jwt.claims = '';");
  }
};

(async () => {
  const checks = [];
  const check = (name, ok, detail) => {
    checks.push({ name, ok, detail });
    log(`  ${ok ? "OK  " : "FAIL"}  ${name}${detail ? `  -- ${detail}` : ""}`);
  };

  log("=".repeat(78));
  log("CLEAN BOOTSTRAP: fresh initdb, check_function_bodies=on, no prior state");
  log("=".repeat(78));

  const db = await PGlite.create();
  await db.exec(AUTH_STUB);

  const s0 = await db.query("show check_function_bodies");
  log(`\ninitial check_function_bodies = ${s0.rows[0].check_function_bodies}`);

  // Supabase sets these when a project is created, so objects created by the
  // migrations below are granted at CREATE time. Must precede the migrations;
  // applying blanket grants afterwards would silently undo 0003.
  await db.exec(SUPABASE_DEFAULTS);
  log("Supabase default privileges applied before migrations (alter default privileges)\n");

  log("Applying migrations in project order:");
  for (const f of MIGRATIONS) {
    const r = (await applyMigrations(db, [f]))[0];
    const bytes = readFileSync(join(REPO, "supabase", "migrations", f), "utf8").length;
    log(`  ${r.ok ? "APPLIED" : "FAILED "}  ${f}  (${bytes} bytes)`);
    if (!r.ok) {
      log(`\n  FIRST FAILURE: ${f}\n  ${r.error}\n  Stopping - not skipping ahead.`);
      await db.close();
      process.exit(1);
    }
  }

  const s1 = await db.query("show check_function_bodies");
  check("check_function_bodies was on for every migration", String(s1.rows[0].check_function_bodies).toLowerCase() === "on");

  // ---------------------------------------------------------------- schema
  log("\n-- resulting schema --");
  const tables = await db.query(
    "select table_name from information_schema.tables where table_schema='public' order by 1");
  log(`tables (${tables.rows.length}): ${tables.rows.map((t) => t.table_name).join(", ")}`);

  const fns = await db.query(
    `select p.proname, l.lanname, p.prosecdef as secdef
       from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       join pg_language l on l.oid=p.prolang
      where n.nspname='public' order by 1`);
  log(`functions: ${fns.rows.map((f) => `${f.proname}(${f.lanname}${f.secdef ? ",security_definer" : ""})`).join(", ")}`);

  const rls = await db.query(
    `select c.relname, c.relrowsecurity as enabled
       from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r' order by 1`);
  const rlsOff = rls.rows.filter((r) => !r.enabled).map((r) => r.relname);
  check("row level security enabled on every public table", rlsOff.length === 0,
    rlsOff.length ? `disabled: ${rlsOff.join(", ")}` : `${rls.rows.length} tables`);

  const pols = await db.query(
    `select count(*)::int n from pg_policies where schemaname='public'`);
  log(`policies: ${pols.rows[0].n}`);
  check("policies present", pols.rows[0].n > 0, `${pols.rows[0].n} policies`);

  // is_staff must mean administrator after the full sequence.
  const isstaff = (await db.query(
    `select pg_get_functiondef(p.oid) d from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='is_staff'`)).rows[0].d;
  check("is_staff() delegates to is_admin()", /select public\.is_admin\(\)/.test(isstaff));

  const isadmin = (await db.query(
    `select pg_get_functiondef(p.oid) d from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='is_admin'`)).rows[0].d;
  check("is_admin() is security definer with a pinned search_path",
    /security definer/i.test(isadmin) && /search_path\s*(=|to)\s*'?public'?/i.test(isadmin));
  check("is_admin() requires role = 'admin'", /role\s*=\s*'admin'/.test(isadmin));

  const handler = (await db.query(
    `select pg_get_functiondef(p.oid) d from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='handle_new_user'`)).rows[0].d;
  check("handle_new_user() cannot mint an administrator from metadata",
    !/metadata[^;]*'admin'/.test(handler.replace(/when[^\n]*role'\s*=\s*'provider'[^\n]*\n/, "")) &&
    !/\bin\s+'admin'|'admin'\s*\)\s*then/.test(handler),
    "only 'provider' is honoured; everything else is 'consumer'");

  const grantdef = (await db.query(
    `select pg_get_functiondef(p.oid) d from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='grant_role'`)).rows[0].d;
  check("grant_role() is security definer", /security definer/i.test(grantdef));
  check("grant_role() keeps both caller restrictions",
    /service_role/.test(grantdef) && /public\.is_admin\(\)/.test(grantdef));

  // ------------------------------------------------- grants actually granted
  log("\n-- privilege audit (the Supabase default-privilege trap) --");

  const roleUpd = await db.query(
    `select has_table_privilege('authenticated','public.profiles','update') as t,
            has_column_privilege('authenticated','public.profiles','role','update') as role_col
       from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname='profiles'`);
  check("authenticated cannot UPDATE profiles as a table", roleUpd.rows[0].t === false);
  check("authenticated cannot UPDATE profiles.role specifically", roleUpd.rows[0].role_col === false);
  for (const col of ["full_name", "email", "phone", "lang"]) {
    const c = await db.query(
      `select has_column_privilege('authenticated','public.profiles',$1,'update') as ok`, [col]);
    check(`authenticated can still UPDATE profiles.${col}`, c.rows[0].ok === true);
  }

  for (const r of ["anon", "authenticated"]) {
    const g = await db.query("select has_function_privilege($1,'public.grant_role(uuid,text)','execute') as ok", [r]);
    check(`${r} cannot EXECUTE grant_role()`, g.rows[0].ok === false);
  }
  const gsr = await db.query("select has_function_privilege('service_role','public.grant_role(uuid,text)','execute') as ok");
  check("service_role CAN execute grant_role() (the Worker path)", gsr.rows[0].ok === true);

  // Default privileges must not have re-opened anything the migrations closed.
  // Supabase grants anon full table privileges on every public table by default;
  // RLS is the barrier that stops it. That is the platform's model, not a
  // defect here, so this records what anon actually holds rather than asserting
  // a grant that was never there. The behavioural assertions below are what
  // matter, and they are checked further down.
  const anonPrivs = (await db.query(
    `select has_table_privilege('anon','public.profiles','select') as sel,
            has_table_privilege('anon','public.profiles','insert') as ins,
            has_table_privilege('anon','public.profiles','update') as upd,
            has_table_privilege('anon','public.profiles','delete') as del
       from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname='profiles'`)).rows[0];
  log(`  info  anon table privileges on profiles: select=${anonPrivs.sel} insert=${anonPrivs.ins} update=${anonPrivs.upd} delete=${anonPrivs.del}`);
  log(`        (Supabase's documented default; RLS is the only barrier for anon. Behavioural proof follows below.)`);

  // ------------------------------------------------ behavioural spot checks
  log("\n-- behaviour after the full sequence --");

  const ids = {
    adminAttempt: "00000000-0000-4000-8000-0000000000a1",
    consumer: "00000000-0000-4000-8000-0000000000c1",
    provider: "00000000-0000-4000-8000-0000000000b1",
  };
  for (const [k, email, meta] of [
    ["adminAttempt", "escalate@qa.test", { role: "admin" }],
    ["consumer", "consumer@qa.test", { role: "consumer" }],
    ["provider", "provider@qa.test", { role: "provider" }],
  ]) {
    await db.query(
      "insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3::jsonb)",
      [ids[k], email, JSON.stringify(meta)]);
  }
  await db.query(
    `insert into public.bookings (user_id, provider_id, name, phone, message, status)
     values ($1,'prv-x','Consumer A','+234000','private reason','new')`, [ids.consumer]);

  const roleOf = async (k) =>
    (await db.query("select role from public.profiles where id=$1::uuid", [ids[k]])).rows[0].role;

  check("I1  signup with role='admin' yields a consumer", (await roleOf("adminAttempt")) === "consumer",
    `role=${await roleOf("adminAttempt")}`);

  for (const k of ["consumer", "provider"]) {
    const r = await as(db, "authenticated", ids[k], async () => {
      const q = await db.query("update public.profiles set role='admin' where id=$1::uuid", [ids[k]]);
      return { rows: q.rows };
    });
    check(`I2  ${k} cannot self-promote to admin`, !r.ok && (await roleOf(k)) !== "admin",
      r.ok ? "UPDATE SUCCEEDED" : "permission denied");
  }

  const pv = await as(db, "authenticated", ids.provider, async () => {
    const q = await db.query("select count(*)::int c from public.bookings");
    return { rows: q.rows };
  });
  check("I3  provider reads 0 unrelated bookings", pv.rows[0]?.c === 0, `bookings=${pv.rows[0]?.c}`);

  const pvDocs = await as(db, "authenticated", ids.provider, async () => {
    const q = await db.query("select count(*)::int c from public.health_documents");
    return { rows: q.rows };
  });
  check("I4  provider reads 0 health documents", pvDocs.rows[0]?.c === 0, `docs=${pvDocs.rows[0]?.c}`);

  const grant = await as(db, "service_role", null, async () => {
    const q = await db.query("select public.grant_role($1::uuid,'admin')", [ids.consumer]);
    return { rows: q.rows };
  });
  check("I5  service_role can provision an administrator", grant.ok, grant.ok ? "" : grant.error);

  const provisioned = await as(db, "authenticated", ids.consumer, async () => {
    const a = await db.query("select public.is_admin() a, public.is_staff() s");
    const b = await db.query("select count(*)::int c from public.bookings");
    return { rows: [{ a: a.rows[0].a, s: a.rows[0].s, c: b.rows[0].c }] };
  });
  check("I6  provisioned administrator retains staff access",
    provisioned.rows[0]?.a === true && provisioned.rows[0]?.s === true && provisioned.rows[0]?.c === 1,
    `is_admin=${provisioned.rows[0]?.a} is_staff=${provisioned.rows[0]?.s} bookings=${provisioned.rows[0]?.c}`);

  const appsTable = (await db.query("select to_regclass('public.provider_applications')::text v")).rows[0].v;
  check("I7  provider verification cannot be self-assigned (no such table)", appsTable === null,
    `provider_applications=${appsTable}`);

  // The anon key reaches the tables but must see nothing.
  //
  // FINDING: this does not return zero rows - it raises
  // `permission denied for function is_staff`. 0003 revokes EXECUTE on
  // is_staff()/is_admin() from anon, and RLS evaluates a policy expression as
  // the querying role, so profiles_select_own cannot be evaluated for anon at
  // all. It fails CLOSED (no rows, no error leak), but it turns anonymous reads
  // into permission errors rather than empty results. Recorded for review in
  // report section 8; not changed here.
  const anonSee = await as(db, "anon", null, async () => {
    const p = await db.query("select count(*)::int c from public.profiles");
    const b = await db.query("select count(*)::int c from public.bookings");
    return { rows: [{ p: p.rows[0].c, b: b.rows[0].c }] };
  });
  const anonReadBlocked = anonSee.ok
    ? anonSee.rows[0].p === 0 && anonSee.rows[0].b === 0
    : /permission denied/.test(anonSee.error || "");
  check("I8  anon key cannot read profiles or bookings (fails closed)",
    anonReadBlocked,
    anonSee.ok ? `profiles=${anonSee.rows[0].p} bookings=${anonSee.rows[0].b}`
               : `denied by policy evaluation: ${anonSee.error}`);

  // anon holds a table-level UPDATE grant from Supabase's defaults, so prove the
  // role set is unchanged rather than merely that no admin exists - an admin
  // already exists here, legitimately provisioned in I5.
  const rolesBefore = (await db.query("select role, count(*)::int n from public.profiles group by role order by 1"))
    .rows.map((r) => `${r.role}=${r.n}`).join(" ");
  const anonUpd = await as(db, "anon", null, async () => {
    const q = await db.query("update public.profiles set role='admin'");
    return { rows: q.rows };
  });
  const rolesAfter = (await db.query("select role, count(*)::int n from public.profiles group by role order by 1"))
    .rows.map((r) => `${r.role}=${r.n}`).join(" ");
  check("I9  anon key cannot change any role despite holding the UPDATE grant",
    rolesBefore === rolesAfter, `${rolesBefore}  ->  ${rolesAfter}${anonUpd.ok ? " (UPDATE accepted but matched 0 rows)" : " (UPDATE denied)"}`);

  // Ownership must still be strictly one-owner after the full sequence.
  // A fresh, non-privileged account is used: ids.consumer was promoted to admin
  // in I5 and would legitimately be allowed to see other profiles.
  // (Pre-existing administrators not being demoted cannot be checked here - this
  // script applies every migration before seeding rows, so there is no "before
  // 0003" moment. That guarantee is T12 in verify.js.)
  const owner = "00000000-0000-4000-8000-0000000000d1";
  await db.query(
    "insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3::jsonb)",
    [owner, "owner@qa.test", JSON.stringify({ name: "Owner", role: "consumer" })]);
  await db.query(
    "insert into public.health_documents (user_id,doc_key,payload) values ($1,'records','[]'::jsonb)",
    [ids.consumer]);
  await db.query(
    "insert into public.health_documents (user_id,doc_key,payload) values ($1,'records','[]'::jsonb)",
    [owner]);
  const owns = await as(db, "authenticated", owner, async () => {
    const own = await db.query("select count(*)::int c from public.health_documents where user_id=$1::uuid", [owner]);
    const other = await db.query("select count(*)::int c from public.health_documents where user_id<>$1::uuid", [owner]);
    const prof = await db.query("select count(*)::int c from public.profiles where id<>$1::uuid", [owner]);
    return { rows: [{ own: own.rows[0].c, other: other.rows[0].c, prof: prof.rows[0].c }] };
  });
  const providerDocs = await as(db, "authenticated", ids.provider, async () => {
    const q = await db.query("select count(*)::int c from public.health_documents");
    return { rows: q.rows };
  });
  check("I10 ownership intact: owner sees own records, nobody else's",
    owns.rows[0]?.own === 1 && owns.rows[0]?.other === 0 && owns.rows[0]?.prof === 0 && providerDocs.rows[0]?.c === 0,
    `own=${owns.rows[0]?.own} others=${owns.rows[0]?.other} other_profiles=${owns.rows[0]?.prof} provider_sees_docs=${providerDocs.rows[0]?.c}`);

  const emergency = await as(db, "authenticated", ids.provider, async () => {
    const q = await db.query("select count(*)::int c from public.emergency_requests");
    return { rows: q.rows };
  });
  check("I11 emergency-request protections intact (provider sees 0)", emergency.rows[0]?.c === 0,
    `emergency_requests=${emergency.rows[0]?.c}`);

  const pass = checks.filter((c) => c.ok).length;
  log("\n" + "=".repeat(78));
  log(`CLEAN BOOTSTRAP: all ${MIGRATIONS.length} migrations applied with strict checking`);
  log(`INVARIANTS: ${pass}/${checks.length} passed`);
  log("=".repeat(78));
  if (pass !== checks.length) {
    log("\nFAILURES:");
    for (const c of checks.filter((x) => !x.ok)) log(`  - ${c.name}: ${c.detail}`);
  }

  require("node:fs").writeFileSync("bootstrap.json", JSON.stringify({ checks, pass, total: checks.length }, null, 2));
  await db.close();
  process.exit(pass === checks.length ? 0 : 1);
})().catch((e) => {
  console.error("HARNESS ERROR", e.message);
  process.exit(2);
});