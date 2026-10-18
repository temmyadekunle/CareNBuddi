/**
 * T1-T16 against real PostgreSQL, run TWICE:
 *   BASELINE  - migrations 0001+0002 only (the vulnerable state)
 *   HARDENED  - plus 0003
 *
 * Running both is the point. A test that passes in BOTH states is testing
 * nothing; the baseline shows these assertions actually detect the defect.
 */
const { PGlite, AUTH_STUB, applyMigrations } = require("./migrate.js");
const { SUPABASE_DEFAULTS } = require("./defaults.js");

async function run(label, include0003) {
  const out = { label, tests: [] };
  const db = await PGlite.create();
  await db.exec(AUTH_STUB);

  // Supabase sets these when the project is created, so the migrations below
  // create their objects already granted. MUST precede applyMigrations.
  await db.exec(SUPABASE_DEFAULTS);

  // 0001+0002 are the pre-existing production state. They are applied FIRST, a
  // pre-existing administrator is seeded through the OLD trigger, and only then
  // is 0003 applied. That is the only way T12 can prove the promise 0003 makes
  // in its own header: that it changes no existing profiles.role value.
  const pre = await applyMigrations(db, ["0001_init.sql", "0002_rapid_response.sql"]);
  if (pre.find((a) => !a.ok)) throw new Error("migration failed");

  const legacyAdmin = "00000000-0000-4000-8000-00000000d0d0";
  await db.query(
    "insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3::jsonb)",
    [legacyAdmin, "existing-admin@qa.test", JSON.stringify({ name: "Existing Admin", role: "admin" })],
  );
  const roleBefore = (await db.query("select role from public.profiles where id=$1::uuid", [legacyAdmin])).rows[0].role;
  if (roleBefore !== "admin") throw new Error("fixture: pre-existing admin not created, got " + roleBefore);

  if (include0003) {
    const post = await applyMigrations(db, ["0003_admin_role_hardening.sql", "0004_anonymous_access_privacy.sql"]);
    if (post.find((a) => !a.ok)) throw new Error("migration failed");
  }

  const ids = {};
  let n = 0;
  const mk = async (key, email, meta) => {
    n += 1;
    const id = "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
    ids[key] = id;
    await db.query(
      "insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3::jsonb) on conflict (id) do nothing",
      [id, email, JSON.stringify(meta)],
    );
  };

  await mk("consumer_a", "consumer-a@qa.test", { name: "Consumer A", role: "consumer" });
  await mk("consumer_b", "consumer-b@qa.test", { name: "Consumer B", role: "consumer" });
  await mk("provider", "provider@qa.test", { name: "Provider", role: "provider" });

  await db.query(
    `insert into public.bookings (user_id, provider_id, name, phone, message, status)
     values ($1,'prv-x','Consumer A','+234000','A-PRIVATE-REASON','new')`,
    [ids.consumer_a],
  );

  const as = async (role, sub, fn) => {
    await db.exec("reset role;");
    await db.exec(`set role ${role};`);
    await db.exec(`set request.jwt.claims = '${JSON.stringify(sub ? { sub, role } : { role })}';`);
    try {
      const r = await fn();
      return { ok: true, rows: r.rows || [] };
    } catch (e) {
      return { ok: false, error: e.message, rows: [] };
    } finally {
      await db.exec("reset role;");
      await db.exec("set request.jwt.claims = '';");
    }
  };
  const obs = async (sql, params = []) => (await db.query(sql, params)).rows;
  const t = async (id, name, fn) => {
    try {
      out.tests.push({ id, name, ...(await fn()) });
    } catch (e) {
      out.tests.push({ id, name, expected: "-", actual: "ERROR: " + e.message, ok: false });
    }
  };

  const role = async (key) => (await obs("select role from public.profiles where id=$1", [ids[key]]))[0]?.role;

  // T1 / T2 - signup metadata
  await mk("t1", "t1@qa.test", { name: "T1", role: "admin" });
  await t("T1", "signup with role=admin does not create an administrator", async () => {
    const r = await role("t1");
    return { expected: "consumer", actual: r, ok: r === "consumer" };
  });

  const hostile = [
    { name: "H1", roles: ["admin"] }, { name: "H2", role: "ADMIN" },
    { name: "H3", role: " provider " }, { name: "H4", role: "superuser" },
    { name: "H5", role: 1 },
  ];
  for (let i = 0; i < hostile.length; i += 1) await mk(`h${i}`, `t2-${i}@qa.test`, hostile[i]);
  await t("T2", "altered signup metadata cannot escalate", async () => {
    const r = await obs("select role, count(*)::int n from public.profiles where email like 't2-%' group by role");
    const ok = r.length === 1 && r[0].role === "consumer" && r[0].n === 5;
    return { expected: "all 5 = consumer", actual: JSON.stringify(r), ok };
  });

  // T3 / T4 - self-update
  for (const [id, key, want] of [["T3", "consumer_a", "consumer"], ["T4", "provider", "provider"]]) {
    await t(id, `${key} cannot update own role`, async () => {
      const r = await as("authenticated", ids[key], () =>
        db.query("update public.profiles set role='admin' where id=$1::uuid", [ids[key]]));
      const after = await role(key);
      return {
        expected: `permission denied, stays ${want}`,
        actual: r.ok ? "UPDATE SUCCEEDED" : r.error,
        ok: !r.ok && after === want,
      };
    });
  }

  // T5 - provider verification + staff access
  await t("T5", "provider cannot self-verify and gets no staff access", async () => {
    const apps = (await obs("select to_regclass('public.provider_applications')::text v"))[0].v;
    const st = await as("authenticated", ids.provider, () =>
      db.query("select public.is_staff() s, public.is_admin() a"));
    const bk = await as("authenticated", ids.provider, () =>
      db.query("select count(*)::int c from public.bookings"));
    const ok = apps === null && st.rows[0]?.s === false && bk.rows[0]?.c === 0;
    return {
      expected: "no applications table; is_staff=false; bookings=0",
      actual: `apps=${apps}; is_staff=${st.rows[0]?.s}; bookings=${bk.rows[0]?.c}`,
      ok,
    };
  });

  // T6 / T7 / T8 - cross-user reads
  await t("T6", "consumer cannot read another consumer's profile", async () => {
    const r = await as("authenticated", ids.consumer_a, () =>
      db.query("select count(*)::int c from public.profiles where id=$1::uuid", [ids.consumer_b]));
    return { expected: "0", actual: String(r.rows[0]?.c ?? r.error), ok: r.rows[0]?.c === 0 };
  });
  await t("T7", "consumer cannot read another consumer's bookings", async () => {
    const r = await as("authenticated", ids.consumer_b, () =>
      db.query("select count(*)::int c from public.bookings where user_id=$1::uuid", [ids.consumer_a]));
    return { expected: "0", actual: String(r.rows[0]?.c ?? r.error), ok: r.rows[0]?.c === 0 };
  });
  await t("T8", "provider cannot select unrelated patient bookings", async () => {
    const r = await as("authenticated", ids.provider, () =>
      db.query("select count(*)::int c from public.bookings"));
    return { expected: "0", actual: String(r.rows[0]?.c ?? r.error), ok: r.rows[0]?.c === 0 };
  });

  // T9 - trusted provisioning
  await t("T9", "trusted provisioning grants administrator", async () => {
    await mk("admin1", "admin1@qa.test", { name: "Admin", role: "consumer" });
    const g = await as("service_role", null, () =>
      db.query("select public.grant_role($1::uuid,'admin')", [ids.admin1]));
    const st = await as("authenticated", ids.admin1, () =>
      db.query("select public.is_staff() s, public.is_admin() a"));
    const bk = await as("authenticated", ids.admin1, () =>
      db.query("select count(*)::int c from public.bookings"));
    const ok = g.ok && st.rows[0]?.s === true && bk.rows[0]?.c === 1;
    return {
      expected: "grant ok; is_staff=true; sees all bookings",
      actual: `grant=${g.ok ? "ok" : g.error}; is_staff=${st.rows[0]?.s}; bookings=${bk.rows[0]?.c}`,
      ok,
    };
  });

  // T10 - clients cannot call grant_role
  await t("T10", "no client role can execute grant_role()", async () => {
    const res = [];
    for (const k of ["consumer_a", "provider"]) {
      const r = await as("authenticated", ids[k], () =>
        db.query("select public.grant_role($1::uuid,'admin')", [ids.consumer_b ?? ids.consumer_a]));
      res.push(`${k}=${r.ok ? "ALLOWED(BAD)" : "denied"}`);
    }
    return { expected: "all denied", actual: res.join(" "), ok: res.every((s) => s.includes("denied")) };
  });

  // T11 - anonymous
  await t("T11", "anonymous access denied everywhere", async () => {
    // Each probe is independent: a table that does not exist, or a function the
    // caller cannot execute, is no exposure. Anything readable must be 0 rows.
    const q = async (sql) => {
      const r = await as("anon", null, () => db.query(sql));
      return r.ok ? String(r.rows[0].c) : "denied";
    };
    const p = await q("select count(*)::int c from public.profiles");
    const b = await q("select count(*)::int c from public.bookings");
    const d = await q("select count(*)::int c from public.health_documents");
    const s = await as("anon", null, () => db.query("select public.is_staff() s, public.is_admin() a"));
    const staff = s.ok ? String(s.rows[0].s) : "denied";
    const zero = (v) => v === "0" || v === "denied";
    return {
      expected: "0 rows or denied everywhere; is_staff=false",
      actual: `p=${p} b=${b} d=${d} is_staff=${staff} is_admin=${s.ok ? s.rows[0].a : "denied"}`,
      ok: zero(p) && zero(b) && zero(d) && (staff === "false" || staff === "denied"),
    };
  });

  // T13 - provisioning edge cases
  await t("T12", "pre-existing administrators are not demoted", async () => {
    const after = (await obs("select role from public.profiles where id=$1::uuid", [legacyAdmin]))[0].role;
    const st = await as("authenticated", legacyAdmin, () =>
      db.query("select public.is_staff() s"));
    const bk = await as("authenticated", legacyAdmin, () =>
      db.query("select count(*)::int c from public.bookings"));
    const ok = after === "admin" && st.rows[0]?.s === true && bk.rows[0]?.c === 1;
    return {
      expected: "role stays admin, is_staff=true, retains booking access",
      actual: `role=${after}; is_staff=${st.rows[0]?.s}; bookings=${bk.rows[0]?.c}`,
      ok,
    };
  });

  await t("T13", "provisioning rejects bad role and missing profile", async () => {
    // A dedicated fixture: T15 later asserts the provider registration fixture
    // is still role='provider', so promoting that row here would corrupt it.
    await mk("t13", "t13@qa.test", { name: "T13", role: "provider" });
    const bad = await as("service_role", null, () => db.query("select public.grant_role($1::uuid,'superuser')", [ids.t13]));
    const miss = await as("service_role", null, () => db.query("select public.grant_role(gen_random_uuid(),'admin')"));
    const good = await as("service_role", null, () => db.query("select public.grant_role($1::uuid,'admin')", [ids.t13]));
    const after = await role("t13");
    const ok = !bad.ok && !miss.ok && good.ok && after === "admin";
    return {
      expected: "superuser rejected; missing rejected; valid promote ok",
      actual: `superuser=${bad.ok ? "ALLOWED(BAD)" : "rejected"}; missing=${miss.ok ? "ALLOWED(BAD)" : "rejected"}; t13=${after}`,
      ok,
    };
  });

  // T14 - health documents owner-only
  await t("T14", "health documents stay owner-only", async () => {
    await db.query("insert into public.health_documents (user_id,doc_key,payload) values ($1,'records','[]'::jsonb)", [ids.consumer_a]);
    const r = await as("authenticated", ids.consumer_b, () =>
      db.query("select count(*)::int c from public.health_documents"));
    const own = await as("authenticated", ids.consumer_a, () =>
      db.query("select count(*)::int c from public.health_documents where user_id=$1::uuid", [ids.consumer_a]));
    const ok = r.rows[0]?.c === 0 && own.rows[0]?.c === 1;
    return {
      expected: "other sees 0; owner sees 1",
      actual: `other=${r.rows[0]?.c}; owner=${own.rows[0]?.c}`,
      ok,
    };
  });

  // T15 - registration is not verification
  await t("T15", "provider registration grants no verification", async () => {
    const r = await role("provider");
    const apps = (await obs("select count(*)::int c from information_schema.tables where table_name='provider_applications'"))[0].c;
    return { expected: "role=provider, no verification table", actual: `role=${r}; apps_tables=${apps}`, ok: r === "provider" && apps === 0 };
  });

  // T16 - no other escalation route
  await t("T16", "no other escalation route via available grants", async () => {
    const e1 = await as("authenticated", ids.consumer_a, () =>
      db.query("update public.profiles set role='admin', full_name='x' where id=$1::uuid", [ids.consumer_a]));
    const e2 = await as("authenticated", ids.consumer_a, () =>
      db.query("insert into public.profiles (id,full_name,role) values ($1::uuid,'forged','admin')", [ids.consumer_a]));
    const e3 = await as("authenticated", ids.consumer_a, () =>
      db.query("alter table public.bookings disable row level security"));
    const e4 = await as("authenticated", ids.consumer_a, () =>
      db.query("create policy x on public.bookings for select using (true)"));
    const forged = (await obs("select count(*)::int c from public.profiles where full_name='forged'"))[0].c;
    const parts = [
      `col_update=${e1.ok ? "ALLOWED(BAD)" : "denied"}`,
      `insert_admin=${e2.ok ? "ALLOWED(BAD)" : "denied"}`,
      `alter_table=${e3.ok ? "ALLOWED(BAD)" : "denied"}`,
      `create_policy=${e4.ok ? "ALLOWED(BAD)" : "denied"}`,
    ];
    return { expected: "all denied", actual: parts.join(" ") + ` forged_rows=${forged}`, ok: !e1.ok && !e2.ok && !e3.ok && !e4.ok && forged === 0 };
  });

  await db.close();
  return out;
}

(async () => {
  const mode = process.argv[2] === "baseline" ? false : true;
  const label = mode ? "HARDENED (0001+0002+0003+0004)" : "BASELINE (0001+0002 only)";
  console.log("=".repeat(72));
  console.log(label);
  console.log("=".repeat(72));
  const r = await run(label, mode);
  for (const test of r.tests) {
    console.log((test.ok ? "PASS" : "FAIL") + "  " + test.id.padEnd(4) + " " + test.name);
    console.log("        expected: " + test.expected);
    console.log("        actual:   " + test.actual);
  }
  const p = r.tests.filter((x) => x.ok).length;
  console.log("\nSUMMARY " + label + ": " + p + "/" + r.tests.length + " passed");
  require("node:fs").writeFileSync(process.argv[2] === "baseline" ? "baseline.json" : "hardened.json", JSON.stringify(r, null, 2));
})().catch((e) => { console.error("HARNESS ERROR", e.stack); process.exit(2); });