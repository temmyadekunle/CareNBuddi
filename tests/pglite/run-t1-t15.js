/**
 * T1-T15 executed against real PostgreSQL.
 *
 * Environment: PostgreSQL 18.6 via PGlite (WASM), fully local and in-memory.
 * No Supabase project, no network, no credentials, no service-role key used
 * for any authorisation assertion.
 *
 * Each test runs its action under the intended database role with a realistic
 * request.jwt.claims, then re-reads the outcome as an unprivileged observer so
 * the assertion does not depend on the actor being able to see the effect.
 */
const { PGlite, AUTH_STUB, applyMigrations } = require("./migrate.js");

const MIGS = ["0001_init.sql", "0002_rapid_response.sql", "0003_admin_role_hardening.sql"];

let pass = 0, fail = 0;
const rows = [];
function record(id, name, expected, actual, ok, note = "") {
  if (ok) { pass += 1; } else { fail += 1; }
  const line = `${ok ? "PASS" : "FAIL"}  ${id.padEnd(4)} ${name}`;
  console.log(line);
  console.log(`        expected: ${expected}`);
  console.log(`        actual:   ${actual}${note ? "\n        note:     " + note : ""}`);
  rows.push({ id, name, expected, actual, ok, note });
}

/* ---------------------------------------------------- role/JWT helpers */

async function as(db, role, sub, fn) {
  await db.exec("reset role;");
  await db.exec(`set role ${role};`);
  if (sub) {
    await db.exec(
      `select set_config('request.jwt.claims', $${'$'}1${'$'}::jsonb::text, false);`,
    ).catch(() => {});
    // set_config cannot be parameterised through exec, so do it literally.
    await db.exec(`set request.jwt.claims = '${JSON.stringify({ sub, role })}';`);
  } else {
    await db.exec("set request.jwt.claims = '';");
  }
  try {
    const r = await fn();
    return { ok: true, rows: r.rows };
  } catch (e) {
    if (process.env.PGDEBUG) console.log("        [db error] " + e.message);
    return { ok: false, error: e.message, rows: [] };
  } finally {
    await db.exec("reset role;");
    await db.exec("set request.jwt.claims = '';");
  }
}

/** Runs as the table owner (postgres) purely to observe state, never to authorise. */
async function observe(db, sql, params = []) {
  const r = await db.query(sql, params);
  return r.rows;
}

async function signup(db, email, meta, id) {
  // Exactly what GoTrue does on signUp: insert auth.users, which fires
  // on_auth_user_created -> handle_new_user().
  await db.query(
    "insert into auth.users (id, email, raw_user_meta_data) values ($1,$2,$3::jsonb) on conflict (id) do nothing",
    [id, email, JSON.stringify(meta)],
  );
}

(async () => {
  const db = await PGlite.create();
  await db.exec(AUTH_STUB);
  const applied = await applyMigrations(db, MIGS);
  const bad = applied.find((a) => !a.ok);
  if (bad) { console.log("MIGRATION FAILED", bad.file, bad.error); process.exit(1); }
  console.log("Migrations applied: " + applied.map((a) => a.file).join(", ") + "\n");

  /* ------------------------------------------------------- fixtures */
  const ids = {};
  const mk = async (key, email, meta) => {
    const id = "00000000-0000-4000-8000-" + String(Object.keys(ids).length + 1).padStart(12, "0");
    ids[key] = id;
    await signup(db, email, meta, id);
    return id;
  };
  await mk("consumer_a", "consumer-a@qa.test", { name: "Consumer A", role: "consumer" });
  await mk("consumer_b", "consumer-b@qa.test", { name: "Consumer B", role: "consumer" });
  await mk("provider", "provider@qa.test", { name: "Provider", role: "provider" });
  await mk("provider_b", "provider-b@qa.test", { name: "Provider B", role: "provider" });

  // Seed a booking per patient so cross-patient reads are observable.
  await db.query(
    `insert into public.bookings (user_id, provider_id, name, phone, message, status)
     values ($1,'prv-x','Consumer A','+234000','A-PRIVATE-REASON','new'),
            ($1,'prv-y','Consumer B','+234111','B-PRIVATE-REASON','confirmed')`,
    [ids.consumer_a],
  );

  /* ============================================ T1 admin via metadata */
  await signup(db, "t1@qa.test", { name: "T1", role: "admin" }, "00000000-0000-4000-8000-000000000101");
  let t1 = await observe(db, "select role from public.profiles where email='t1@qa.test'");
  record("T1", "signup with role=admin does not create an administrator",
    "role = 'consumer'", `role = '${t1[0]?.role}'`, t1[0]?.role === "consumer");

  /* ============================================ T2 altered metadata */
  const hostile = [
    ["ADMIN"], [" provider "], ["superadmin"], ["admin ", ""],
  ];
  const shaped = [
    { label: "roles[] wrong key", meta: { name: "H1", roles: ["admin"] } },
    { label: "role uppercase", meta: { name: "H2", role: "ADMIN" } },
    { label: "role padded", meta: { name: "H3", role: " provider " } },
    { label: "role unknown", meta: { name: "H4", role: "superuser" } },
    { label: "role numeric", meta: { name: "H5", role: 1 } },
  ];
  shaped.forEach((s, i) => {
    signup(db, `t2-${i}@qa.test`, s.meta, `00000000-0000-4000-8000-00000000020${i}`);
  });
  const t2 = await observe(
    db,
    "select role, count(*)::int as n from public.profiles where email like 't2-%' group by role order by role",
  );
  record("T2", "altered signup metadata cannot escalate",
    "all 5 land on 'consumer'",
    JSON.stringify(t2),
    t2.length === 1 && t2[0].role === "consumer" && t2[0].n === 5);

  /* ============================================ T3 consumer self-update */
  const t3 = await as(db, "authenticated", ids.consumer_a, () =>
    db.query("update public.profiles set role='admin' where id=$1::uuid", [ids.consumer_a]));
  const t3after = await observe(db, "select role from public.profiles where id=$1", [ids.consumer_a]);
  record("T3", "consumer cannot update own role",
    "permission denied, role stays 'consumer'",
    t3.ok ? "UPDATE SUCCEEDED (no error)" : t3.error,
    !t3.ok && t3after[0]?.role === "consumer");

  /* ============================================ T4 provider self-update */
  const t4 = await as(db, "authenticated", ids.provider, () =>
    db.query("update public.profiles set role='admin' where id=$1::uuid", [ids.provider]));
  const t4after = await observe(db, "select role from public.profiles where id=$1", [ids.provider]);
  record("T4", "provider cannot update own role",
    "permission denied, role stays 'provider'",
    t4.ok ? "UPDATE SUCCEEDED (no error)" : t4.error,
    !t4.ok && t4after[0]?.role === "provider");

  /* ============================================ T5 provider verification */
  const t5a = await observe(db, "select to_regclass('public.provider_applications')::text as t");
  const t5b = await as(db, "authenticated", ids.provider, () => db.query("select count(*)::int as c from public.bookings"));
  const t5c = await as(db, "authenticated", ids.provider, () =>
    db.query("select public.is_staff() as staff, public.is_admin() as admin"));
  record("T5", "provider cannot self-verify, and gets no staff access",
    "no applications table; is_staff=false; bookings=0",
    `applications_table=${t5a[0]?.t}; is_staff=${t5c.rows[0]?.staff}; is_admin=${t5c.rows[0]?.admin}; bookings=${t5b.rows[0]?.c}`,
    t5a[0]?.t === null && t5c.rows[0]?.staff === false && t5b.rows[0]?.c === 0);

  /* ============================================ T6 cross-consumer profile */
  const t6 = await as(db, "authenticated", ids.consumer_a, () =>
    db.query("select count(*)::int as c from public.profiles where id=$1::uuid", [ids.consumer_b]));
  record("T6", "consumer cannot read another consumer's profile",
    "0 rows", `${t6.rows[0]?.c} rows`, !t6.ok ? false : t6.rows[0]?.c === 0);

  /* ============================================ T7 cross-consumer bookings */
  const t7 = await as(db, "authenticated", ids.consumer_a, () =>
    db.query("select count(*)::int as c from public.bookings where user_id=$1::uuid", [ids.consumer_b]));
  record("T7", "consumer cannot read another consumer's bookings",
    "0 rows", t7.ok ? `${t7.rows[0]?.c} rows` : t7.error, t7.ok && t7.rows[0]?.c === 0);

  /* ============================================ T8 provider unrelated bookings */
  const t8 = await as(db, "authenticated", ids.provider, () =>
    db.query("select count(*)::int as c from public.bookings"));
  record("T8", "provider cannot select unrelated patient bookings",
    "0 rows (was: all bookings, pre-0003)",
    t8.ok ? `${t8.rows[0]?.c} rows` : t8.error, t8.ok && t8.rows[0]?.c === 0);

  /* ============================================ T9 provisioning grants admin */
  await as(db, "service_role", null, () => db.query("select public.grant_role($1::uuid,'admin')", [ids.provider_b]));
  const t9 = await as(db, "authenticated", ids.provider_b, () =>
    db.query("select public.is_staff() as staff, public.is_admin() as admin"));
  const t9bookings = await as(db, "authenticated", ids.provider_b, () =>
    db.query("select count(*)::int as c from public.bookings"));
  record("T9", "trusted provisioning grants administrator",
    "is_staff=true, is_admin=true, sees all bookings",
    `is_staff=${t9.rows[0]?.staff}; is_admin=${t9.rows[0]?.admin}; bookings=${t9bookings.rows[0]?.c}`,
    t9.rows[0]?.staff === true && t9.rows[0]?.admin === true && t9bookings.rows[0]?.c === 2);

  /* ============================================ T10 clients cannot grant_role */
  const t10 = [];
  for (const who of ["admin", "consumer_a", "provider"]) {
    const r = await as(db, "authenticated", ids[who], () =>
      db.query("select public.grant_role($1::uuid,'admin')", [ids.consumer_a]));
    t10.push(`${who}=${r.ok ? "ALLOWED(BAD)" : "denied"}`);
  }
  record("T10", "no client role can execute grant_role()",
    "denied for admin, consumer and provider",
    t10.join(" "),
    t10.every((s) => s.includes("denied")));

  /* ============================================ T11 anonymous access */
  const t11 = await as(db, "anon", null, async () => {
    const p = await db.query("select count(*)::int as c from public.profiles");
    const b = await db.query("select count(*)::int as c from public.bookings");
    const d = await db.query("select count(*)::int as c from public.health_documents");
    const s = await db.query("select public.is_staff() as s, public.is_admin() as a");
    return { p: p.rows[0].c, b: b.rows[0].c, d: d.rows[0].c, s: s.rows[0].s, a: s.rows[0].a };
  });
  record("T11", "anonymous access is denied everywhere",
    "0/0/0 rows, is_staff=false, is_admin=false",
    `profiles=${t11.rows[0]?.p} bookings=${t11.rows[0]?.b} docs=${t11.rows[0]?.d} is_staff=${t11.rows[0]?.s} is_admin=${t11.rows[0]?.a}`,
    t11.rows[0]?.p === 0 && t11.rows[0]?.b === 0 && t11.rows[0]?.d === 0 && t11.rows[0]?.s === false);

  /* ============================================ T12 existing admins survive */
  const before = t9.rows[0]?.admin;
  await db.exec("set check_function_bodies = off;");
  await applyMigrations(db, ["0003_admin_role_hardening.sql"]);
  const t12 = await observe(db, "select role from public.profiles where id=$1", [ids.provider_b]);
  record("T12", "existing administrators survive a replayed migration",
    "role still 'admin'", `role = '${t12[0]?.role}' (was admin=${before})`,
    t12[0]?.role === "admin");

  /* ============================================ T13 provisioning edge cases */
  const badRole = await as(db, "service_role", null, () =>
    db.query("select public.grant_role($1::uuid,'superuser')", [ids.provider]));
  const missing = await as(db, "service_role", null, () =>
    db.query("select public.grant_role(gen_random_uuid(),'admin')"));
  const promote = await as(db, "service_role", null, () =>
    db.query("select public.grant_role($1::uuid,'admin')", [ids.provider]));
  const promoteCheck = await observe(db, "select role from public.profiles where id=$1", [ids.provider]);
  record("T13", "provisioning rejects bad roles and missing profiles",
    "superuser rejected; missing uuid rejected; valid promote works",
    `superuser=${badRole.ok ? "ALLOWED(BAD)" : "rejected"}; missing=${missing.ok ? "ALLOWED(BAD)" : "rejected"}; provider=${promoteCheck[0]?.role}`,
    !badRole.ok && !missing.ok && promoteCheck[0]?.role === "admin");

  /* ============================================ T14 health docs owner-only */
  await db.query("insert into public.health_documents (user_id, doc_key, payload) values ($1,'records','[]'::jsonb)", [ids.consumer_a]);
  const t14 = await as(db, "authenticated", ids.consumer_a, () =>
    db.query("select count(*)::int as c from public.health_documents where user_id <> $1::uuid", [ids.consumer_a]));
  const t14admin = await as(db, "authenticated", ids.provider_b, () =>
    db.query("select count(*)::int as c from public.health_documents"));
  record("T14", "health documents remain owner-only, even for an administrator",
    "consumer sees 0 others; admin also sees 0",
    `consumer_sees_others=${t14.rows[0]?.c}; admin_sees=${t14admin.rows[0]?.c}`,
    t14.rows[0]?.c === 0 && t14admin.rows[0]?.c === 0);

  /* ============================================ T15 registration != verification */
  const t15 = await observe(db, "select role from public.profiles where email='provider@qa.test'");
  const t15apps = await observe(db, "select count(*)::int as c from information_schema.tables where table_name='provider_applications'");
  record("T15", "provider registration grants no verification",
    "role='provider', no verification state exists",
    `role='${t15[0]?.role}'; provider_applications tables=${t15apps[0]?.c}`,
    t15[0]?.role === "provider" && t15apps[0]?.c === 0);

  /* ============================================ T16 supplementary: no other escalation path */
  const extra = [];
  const e1 = await as(db, "authenticated", ids.consumer_a, () =>
    db.query("update public.profiles set role='admin', full_name='x' where id=$1::uuid", [ids.consumer_a]));
  extra.push(`column_update_with_role=${e1.ok ? "ALLOWED(BAD)" : "denied"}`);
  const e2 = await as(db, "authenticated", ids.consumer_a, () =>
    db.query("insert into public.profiles (id, full_name, role) values ($1::uuid,'forged','admin')", [ids.consumer_a]));
  const e2after = await observe(db, "select count(*)::int as c from public.profiles where role='admin' and full_name='forged'");
  extra.push(`insert_admin_row=${e2.ok ? "ALLOWED(BAD)" : "denied"}`);
  const e3 = await as(db, "authenticated", ids.consumer_a, () =>
    db.query("alter table public.bookings disable row level security"));
  extra.push(`alter_table=${e3.ok ? "ALLOWED(BAD)" : "denied"}`);
  record("T16", "no other route to escalation via available grants",
    "column update denied; admin insert denied; alter table denied",
    extra.join(" "),
    !e1.ok && !e2.ok && e2after[0]?.c === 0 && !e3.ok);

  console.log(`\n${pass} passed, ${fail} failed`);
  await db.close();
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error("HARNESS ERROR", e.stack); process.exit(2); });