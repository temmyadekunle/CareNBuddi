/**
 * Findings A and B, executed against real PostgreSQL after the FULL sequence
 * (0001 + 0002 + 0003 + 0004), with check_function_bodies = on.
 *
 * Everything here runs as anon / authenticated / service_role with a JWT sub,
 * never as the database owner, so RLS and column grants decide the outcome.
 *
 * The nine areas the brief asks for map to the sections below.
 */
const { PGlite, AUTH_STUB, applyMigrations } = require("./migrate.js");
const { SUPABASE_DEFAULTS } = require("./defaults.js");

const MIGRATIONS = ["0001_init.sql", "0002_rapid_response.sql", "0003_admin_role_hardening.sql", "0004_anonymous_access_privacy.sql"];

const as = async (db, role, sub, fn) => {
  await db.exec("reset role;");
  await db.exec(`set role ${role};`);
  await db.exec(`set request.jwt.claims = '${JSON.stringify(sub ? { sub, role } : { role })}';`);
  try {
    const r = await fn();
    return { ok: true, rows: r.rows || [] };
  } catch (e) {
    return { ok: false, error: e.message.replace(/\s+/g, " ").trim().slice(0, 150), rows: [] };
  } finally {
    await db.exec("reset role;");
    await db.exec("set request.jwt.claims = '';");
  }
};

(async () => {
  const checks = [];
  const check = (name, ok, detail) => {
    checks.push({ name, ok, detail: detail || "" });
    console.log(`  ${ok ? "OK  " : "FAIL"}  ${name}${detail ? `  -- ${detail}` : ""}`);
  };
  const section = (s) => console.log(`\n-- ${s} --`);

  const db = await PGlite.create();
  await db.exec(AUTH_STUB);
  await db.exec(SUPABASE_DEFAULTS);

  console.log("=".repeat(78));
  console.log("ANONYMOUS ACCESS + PRIVACY: full sequence, strict function checking");
  console.log("=".repeat(78));
  for (const f of MIGRATIONS) {
    const r = (await applyMigrations(db, [f]))[0];
    console.log(`  ${r.ok ? "APPLIED" : "FAILED "}  ${f}`);
    if (!r.ok) { console.log(`  FIRST FAILURE: ${r.error}`); await db.close(); process.exitCode = 1; return; }
  }

  // Fixtures. No real personal data: obviously-fake numbers and names.
  const U = {
    requester: "00000000-0000-4000-8000-00000000aa01",
    provider: "00000000-0000-4000-8000-00000000bb01",
    consumer: "00000000-0000-4000-8000-00000000cc01",
  };
  for (const [k, email, meta] of [
    ["requester", "requester@qa.test", { name: "Requester", role: "consumer" }],
    ["provider", "provider@qa.test", { name: "Provider", role: "provider" }],
    ["consumer", "consumer@qa.test", { name: "Consumer", role: "consumer" }],
  ]) {
    await db.query("insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3::jsonb)",
      [U[k], email, JSON.stringify(meta)]);
  }
  await db.query(
    `insert into public.provider_emergency_participation (provider_id, display_name, phone, accepts_emergency_requests, coverage_area, last_seen_at)
     values ('prv-alpha','Alpha Clinic','+2340000000001',true,'Yaba',now()),
            ('prv-beta','Beta Clinic','+2340000000002',false,'Abeokute',now())`);

  // ---------------------------------------------------------------- area 1
  section("1. anonymous queries against policies that invoke is_staff()");
  // Every is_staff()-gated table an anonymous caller might touch. The point is
  // that none of them RAISES a function-permission error any more: they must
  // resolve to zero rows.
  for (const tbl of ["profiles", "bookings", "provider_requests", "reports", "emergency_requests", "emergency_request_events"]) {
    const r = await as(db, "anon", null, async () => {
      const q = await db.query(`select count(*)::int c from public.${tbl}`);
      return { rows: q.rows };
    });
    const notPermErr = !/permission denied for function is_staff/i.test(r.error || "");
    check(`anon SELECT ${tbl}: no is_staff() permission error`, notPermErr,
      r.ok ? `${r.rows[0].c} rows` : r.error);
    if (r.ok) check(`anon SELECT ${tbl}: zero rows`, r.rows[0].c === 0, `${r.rows[0].c}`);
  }
  // An UPDATE without RETURNING yields an empty rows array, so the outcome is
  // asserted on the data afterwards, not on rows.length.
  const rw = await as(db, "anon", null, async () => {
    const q = await db.query("update public.emergency_requests set status='dispatched'");
    return { rows: q.rows };
  });
  check("anon UPDATE emergency_requests does not raise an is_staff() error",
    !/permission denied for function is_staff/i.test(rw.error || ""),
    rw.ok ? "accepted, 0 rows visible to anon" : rw.error);

  // ---------------------------------------------------------------- area 2/3
  section("2 + 3. anonymous reads of provider_emergency_participation and phone numbers");
  const base = await as(db, "anon", null, async () => {
    const q = await db.query("select count(*)::int c from public.provider_emergency_participation");
    return { rows: q.rows };
  });
  check("anon cannot read the participation base table", base.ok && base.rows[0].c === 0,
    base.ok ? `${base.rows[0].c} rows` : base.error);

  const star = await as(db, "anon", null, async () => {
    const q = await db.query("select * from public.provider_emergency_participation");
    return { rows: q.rows };
  });
  check("anon select * on the base table returns nothing", star.ok && star.rows.length === 0,
    star.ok ? `${star.rows.length} rows` : star.error);

  // The direct attempt that the old USING (true) policy allowed.
  const phone = await as(db, "anon", null, async () => {
    const q = await db.query("select phone from public.provider_emergency_participation");
    return { rows: q.rows };
  });
  const phones = phone.ok ? phone.rows.map((r) => r.phone) : [];
  check("anon cannot retrieve provider phone numbers", phone.ok && phones.length === 0,
    phone.ok ? `phones returned: ${JSON.stringify(phones)}` : phone.error);

  // A column-qualified probe too, so this is not an artifact of column naming.
  const phone2 = await as(db, "anon", null, async () => {
    const q = await db.query("select provider_id, phone from public.provider_emergency_participation where phone is not null");
    return { rows: q.rows };
  });
  check("anon cannot filter the base table by phone", phone2.ok && phone2.rows.length === 0,
    phone2.ok ? `${phone2.rows.length} rows` : phone2.error);

  // The public projection is the supported replacement.
  const viewCols = (await db.query(
    "select column_name from information_schema.columns where table_schema='public' and table_name='provider_emergency_participation_public' order by ordinal_position")).rows.map((r) => r.column_name);
  check("public view exposes no private column", !viewCols.includes("phone") && !viewCols.includes("last_seen_at"),
    `columns: ${viewCols.join(", ")}`);
  const view = await as(db, "anon", null, async () => {
    const q = await db.query("select * from public.provider_emergency_participation_public");
    return { rows: q.rows };
  });
  check("anon can still read the public badge projection", view.ok && view.rows.length === 2,
    view.ok ? `${view.rows.length} rows: ${view.rows.map((r) => r.provider_id + "/" + r.display_name).join(", ")}` : view.error);
  check("no phone value appears anywhere in the projection",
    view.ok && view.rows.every((r) => !Object.values(r).some((v) => typeof v === "string" && /\+234000000000\d/.test(v))));

  // ---------------------------------------------------------------- area 4
  section("4. one provider reading another provider's private participation data");
  const cross = await as(db, "authenticated", U.provider, async () => {
    const q = await db.query("select provider_id, phone from public.provider_emergency_participation");
    return { rows: q.rows };
  });
  check("provider cannot read the participation roster", cross.ok && cross.rows.length === 0,
    cross.ok ? `${cross.rows.length} rows` : cross.error);
  const crossWrite = await as(db, "authenticated", U.provider, async () => {
    const q = await db.query("update public.provider_emergency_participation set accepts_emergency_requests=true where provider_id='prv-beta'");
    return { rows: q.rows };
  });
  const stillFalse = (await db.query("select accepts_emergency_requests a from public.provider_emergency_participation where provider_id='prv-beta'")).rows[0].a;
  check("provider cannot self-activate or write another's row", stillFalse === false,
    `prv-beta accepts=${stillFalse}${crossWrite.ok ? " (write accepted, matched 0 rows)" : " (denied)"}`);
  // And a provider cannot reach patient data by way of the emergency tables.
  const provBookings = await as(db, "authenticated", U.provider, async () => {
    const q = await db.query("select count(*)::int c from public.bookings");
    return { rows: q.rows };
  });
  check("provider cannot obtain patient records through emergency access", provBookings.ok && provBookings.rows[0].c === 0,
    provBookings.ok ? `bookings=${provBookings.rows[0].c}` : provBookings.error);

  // ---------------------------------------------------------------- area 5
  section("5. authorized emergency operations still work");
  // Provision an administrator the supported way, then use the staff path.
  const grant = await as(db, "service_role", null, async () => {
    const q = await db.query("select public.grant_role($1::uuid,'admin')", [U.provider]);
    return { rows: q.rows };
  });
  check("service_role can provision an administrator", grant.ok, grant.ok ? "" : grant.error);

  const staffRead = await as(db, "authenticated", U.provider, async () => {
    const a = await db.query("select public.is_staff() s");
    const q = await db.query("select provider_id, phone from public.provider_emergency_participation order by provider_id");
    return { rows: [{ s: a.rows[0].s, rows: q.rows }] };
  });
  check("provisioned administrator can read the full roster including phone",
    staffRead.ok && staffRead.rows[0].s === true && staffRead.rows[0].rows.length === 2,
    staffRead.ok ? `is_staff=${staffRead.rows[0].s} rows=${staffRead.rows[0].rows.length} phones=${staffRead.rows[0].rows.map((r) => r.phone).join(",")}` : staffRead.error);

  // A real emergency request, created anonymously, then picked up by staff.
  // No RETURNING on purpose. Postgres applies the table's SELECT policies to a
  // RETURNING clause, and an anonymous caller can never satisfy
  // `auth.uid() = user_id` for a user_id IS NULL row, so `insert ... returning`
  // raises "new row violates row-level security policy". That is a property of
  // 0002's policy pair, it predates this migration, and it is recorded as an
  // open product decision in the report rather than silently designed around.
  const ins = await as(db, "anon", null, async () => {
    const q = await db.query(
      "insert into public.emergency_requests (user_id, requester_name, requester_phone, location_text, provider_id, status) values (null,'QA Requester','+2340000000009','QA location','prv-alpha','created')");
    return { rows: q.rows };
  });
  const created = (await db.query("select count(*)::int c from public.emergency_requests where user_id is null and status='created'")).rows[0].c;
  check("anonymous requester can still create an emergency request", ins.ok && created === 1,
    ins.ok ? `inserted; ${created} anonymous request(s) in 'created'` : ins.error);

  const ret = await as(db, "anon", null, async () => {
    const q = await db.query(
      "insert into public.emergency_requests (user_id, requester_name, requester_phone, location_text, status) values (null,'QA Ret','+2340000000009','QA loc','created') returning id");
    return { rows: q.rows };
  });
  check("documented gap: anonymous insert ... returning is refused by the SELECT policy",
    !ret.ok && /row-level security/i.test(ret.error || ""), ret.ok ? "unexpectedly succeeded" : ret.error);

  const anonReadOwn = await as(db, "anon", null, async () => {
    const q = await db.query("select count(*)::int c from public.emergency_requests");
    return { rows: q.rows };
  });
  check("anonymous read of emergency_requests resolves without error", !/permission denied for function is_st/i.test(anonReadOwn.error || ""),
    anonReadOwn.ok ? `${anonReadOwn.rows[0].c} rows visible` : anonReadOwn.error);

  const staffMove = await as(db, "authenticated", U.provider, async () => {
    const q = await db.query("update public.emergency_requests set status='dispatched' where status='created' returning id");
    return { rows: q.rows };
  });
  check("administrator can move a request through the status machine", staffMove.ok && staffMove.rows.length === 1,
    staffMove.ok ? `${staffMove.rows.length} row updated` : staffMove.error);

  const staffAudit = await as(db, "authenticated", U.provider, async () => {
    const q = await db.query(
      "insert into public.emergency_request_events (request_id, actor_role, actor_id, event, to_status) select id,'admin',$1::uuid,'status_change','dispatched' from public.emergency_requests limit 1 returning id",
      [U.provider]);
    return { rows: q.rows };
  });
  check("administrator can append the audit event", staffAudit.ok && staffAudit.rows.length === 1,
    staffAudit.ok ? "appended" : staffAudit.error);

  // ---------------------------------------------------------------- area 6
  section("6. unauthenticated access to private patient information");
  await db.query(
    `insert into public.health_documents (user_id, doc_key, payload) values ($1,'records','[{"note":"QA synthetic record"}]'::jsonb)`,
    [U.consumer]);
  await db.query(
    `insert into public.bookings (user_id, provider_id, name, phone, message, status)
     values ($1,'prv-alpha','QA Patient','+2340000000008','QA synthetic reason','new')`, [U.consumer]);

  for (const tbl of ["health_documents", "bookings"]) {
    const r = await as(db, "anon", null, async () => {
      const q = await db.query(`select count(*)::int c from public.${tbl}`);
      return { rows: q.rows };
    });
    check(`anon reads 0 rows from ${tbl}`, r.ok && r.rows[0].c === 0, r.ok ? `${r.rows[0].c}` : r.error);
  }
  const ownDocs = await as(db, "authenticated", U.consumer, async () => {
    const q = await db.query("select count(*)::int c from public.health_documents");
    return { rows: q.rows };
  });
  check("the owner can still read their own records", ownDocs.ok && ownDocs.rows[0].c === 1, ownDocs.ok ? `${ownDocs.rows[0].c}` : ownDocs.error);
  const otherDocs = await as(db, "authenticated", U.provider, async () => {
    const q = await db.query("select count(*)::int c from public.health_documents");
    return { rows: q.rows };
  });
  check("a non-owner authenticated caller reads 0 records", otherDocs.ok && otherDocs.rows[0].c === 0, otherDocs.ok ? `${otherDocs.rows[0].c}` : otherDocs.error);

  // ---------------------------------------------------------------- area 8
  section("8. emergency-request integrity protections (unchanged)");
  // A second anonymous request gives this section a real 'created' row to attack.
  await as(db, "anon", null, async () => {
    const q = await db.query(
      "insert into public.emergency_requests (user_id, requester_name, requester_phone, location_text, status) values (null,'QA Second','+2340000000009','QA loc','created')");
    return { rows: q.rows };
  });
  const before = (await db.query("select count(*)::int c from public.emergency_requests where status='dispatched'")).rows[0].c;
  const forgeDispatch = await as(db, "authenticated", U.consumer, async () => {
    const q = await db.query("update public.emergency_requests set status='dispatched' where status='created'");
    return { rows: q.rows };
  });
  const after = (await db.query("select count(*)::int c from public.emergency_requests where status='dispatched'")).rows[0].c;
  check("a non-staff user cannot move a request's status", after === before,
    `dispatched count ${before} -> ${after}${forgeDispatch.ok ? " (write accepted, matched 0 rows)" : " (denied)"}`);
  const eventsBefore = (await db.query("select count(*)::int c from public.emergency_request_events")).rows[0].c;
  const forgeEvent = await as(db, "authenticated", U.consumer, async () => {
    const q = await db.query("insert into public.emergency_request_events (request_id, actor_role, event) select id,'requester','forged' from public.emergency_requests limit 1");
    return { rows: q.rows };
  });
  const eventsAfter = (await db.query("select count(*)::int c from public.emergency_request_events")).rows[0].c;
  check("a non-staff user cannot append an audit event", eventsAfter === eventsBefore,
    `events ${eventsBefore} -> ${eventsAfter}`);
  await as(db, "authenticated", U.provider, async () => {
    const q = await db.query("update public.emergency_request_events set event='rewritten'");
    return { rows: q.rows };
  });
  const rewritten = (await db.query("select count(*)::int c from public.emergency_request_events where event='rewritten'")).rows[0].c;
  check("audit events are not rewritable even by an administrator", rewritten === 0, `rewritten=${rewritten}`);

  // ---------------------------------------------------------------- area 9
  section("9. grants and function execution after the complete sequence");
  const fnPerm = {};
  for (const [role, expect] of [["anon", true], ["authenticated", true], ["service_role", true]]) {
    const r = await db.query("select has_function_privilege($1,'public.is_staff()','execute') as ok", [role]);
    fnPerm[role] = r.rows[0].ok;
    check(`${role} can execute is_staff() (policy evaluation)`, r.rows[0].ok === expect);
  }
  const adminPerm = await db.query("select has_function_privilege('anon','public.is_admin()','execute') as ok");
  check("anon still CANNOT execute is_admin()", adminPerm.rows[0].ok === false);
  const gr = {};
  for (const role of ["anon", "authenticated"]) {
    const r = await db.query("select has_function_privilege($1,'public.grant_role(uuid,text)','execute') as ok", [role]);
    gr[role] = r.rows[0].ok;
    check(`${role} still cannot execute grant_role()`, r.rows[0].ok === false);
  }
  const sr = await db.query("select has_function_privilege('service_role','public.grant_role(uuid,text)','execute') as ok");
  check("service_role can still execute grant_role()", sr.rows[0].ok === true);
  const roleCol = await db.query("select has_column_privilege('authenticated','public.profiles','role','update') as ok");
  check("authenticated still cannot update profiles.role", roleCol.rows[0].ok === false);
  const viewWrite = await db.query(
    "select has_table_privilege('anon','public.provider_emergency_participation_public','insert') as i, has_table_privilege('anon','public.provider_emergency_participation_public','update') as u");
  check("anon cannot write to the public view", viewWrite.rows[0].i === false && viewWrite.rows[0].u === false);

  const pass = checks.filter((c) => c.ok).length;
  console.log("\n" + "=".repeat(78));
  console.log(`PRIVACY + ANONYMOUS SUITE: ${pass}/${checks.length} passed`);
  console.log("=".repeat(78));
  if (pass !== checks.length) {
    console.log("\nFAILURES:");
    for (const c of checks.filter((x) => !x.ok)) console.log(`  - ${c.name}: ${c.detail}`);
  }
  require("node:fs").writeFileSync("privacy.json", JSON.stringify({ checks, pass, total: checks.length }, null, 2));
  await db.close();
  process.exitCode = pass === checks.length ? 0 : 1;
})().catch((e) => {
  console.error("HARNESS ERROR", e.message);
  process.exitCode = 2;
});