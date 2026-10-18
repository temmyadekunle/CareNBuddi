/**
 * Proves the grant_role() boundary by execution, not by assertion.
 *
 * 0003 revokes EXECUTE from anon and authenticated, so a client cannot call it
 * at all. The question that a text review cannot answer is whether the SECOND
 * guard still holds if that revoke is ever undone - which is what the is_admin()
 * branch is for. This script deliberately re-grants EXECUTE to authenticated
 * (simulating a mistaken future grant or a botched migration) and then checks
 * who can actually promote somebody.
 */
const { PGlite, AUTH_STUB, applyMigrations } = require("./migrate.js");
const { SUPABASE_DEFAULTS } = require("./defaults.js");

(async () => {
  const db = await PGlite.create();
  await db.exec(AUTH_STUB);
  await db.exec(SUPABASE_DEFAULTS);
  const applied = await applyMigrations(db, [
    "0001_init.sql",
    "0002_rapid_response.sql",
    "0003_admin_role_hardening.sql",
  ]);
  if (applied.find((a) => !a.ok)) throw new Error("migration failed");

  const id = (n) => "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
  const users = {
    consumer: [id(1), "consumer@qa.test", "consumer"],
    provider: [id(2), "provider@qa.test", "provider"],
    admin: [id(3), "admin@qa.test", "admin"],
    victim: [id(4), "victim@qa.test", "consumer"],
  };
  for (const [k, [uid, email, role]] of Object.entries(users)) {
    await db.query(
      "insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3::jsonb)",
      [uid, email, JSON.stringify({ role })],
    );
  }

  // Deliberately break the revoke to test the guard underneath it.
  await db.exec("grant execute on function public.grant_role(uuid, text) to authenticated, anon;");
  console.log("EXECUTE deliberately re-granted to anon + authenticated\n");

  const as = async (role, sub, fn) => {
    await db.exec("reset role;");
    await db.exec(`set role ${role};`);
    await db.exec(`set request.jwt.claims = '${JSON.stringify(sub ? { sub, role } : { role })}';`);
    try {
      const r = await fn();
      return { ok: true, ...r };
    } catch (e) {
      return { ok: false, error: e.message.replace(/\s+/g, " ").slice(0, 70) };
    } finally {
      await db.exec("reset role;");
      await db.exec("set request.jwt.claims = '';");
    }
  };

  const rows = [];
  // Inserting the fixture with metadata role='admin' produced a CONSUMER,
  // because that is exactly what handle_new_user does - the same behaviour T1
  // asserts. So the administrator fixture has to be promoted the supported way
  // before the administrator-session probe means anything.
  const promote = await as("service_role", null, async () => {
    const q = await db.query("select public.grant_role($1::uuid,'admin')", [users.admin[0]]);
    return { rows: q.rows };
  });
  const adminRole = (await db.query("select role from public.profiles where id=$1::uuid", [users.admin[0]])).rows[0].role;
  console.log(`fixture promotion via service_role: ${promote.ok ? "ok" : promote.error} -> ${adminRole}\n`);

  const probe = (name, role, sub, allow) =>
    (async () => {
      const r = await as(role, sub, async () => {
        const q = await db.query("select public.grant_role($1::uuid,'admin')", [users.victim[0]]);
        return { rows: q.rows };
      });
      const after = (await db.query("select role from public.profiles where id=$1::uuid", [users.victim[0]])).rows[0].role;
      const verdict = allow ? (after === "admin" ? "ALLOWED (expected)" : "BLOCKED (unexpected)") : (after === "consumer" ? "blocked (expected)" : "ALLOWED (BAD)");
      const ok = allow ? after === "admin" : after !== "admin";
      rows.push({ name, ok, verdict, detail: r.ok ? "grant executed" : r.error, victimRole: after });
      await db.query("update public.profiles set role='consumer' where id=$1::uuid", [users.victim[0]]);
    })();

  await probe("anonymous, execute re-granted", "anon", null, false);
  await probe("consumer session, execute re-granted", "authenticated", users.consumer[0], false);
  await probe("provider session, execute re-granted", "authenticated", users.provider[0], false);
  await probe("administrator session", "authenticated", users.admin[0], true);
  await probe("service_role key (no sub)", "service_role", null, true);

  for (const r of rows) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}`);
    console.log(`        ${r.verdict}  victim_role=${r.victimRole}`);
    console.log(`        ${r.detail}`);
  }
  const pass = rows.filter((r) => r.ok).length;
  console.log(`\nSUMMARY defence-in-depth: ${pass}/${rows.length} passed`);
  await db.close();
  // process.exit() straight after close() trips a libuv assertion on Windows
  // and reports a bogus non-zero code. Set the code and let the loop drain.
  process.exitCode = pass === rows.length ? 0 : 1;
})().catch((e) => {
  console.error("HARNESS ERROR", e.message);
  process.exitCode = 2;
});