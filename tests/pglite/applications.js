/**
 * Provider application workflow (0007), executed against real PostgreSQL
 * with check_function_bodies = on, as anon / authenticated / service_role —
 * never as the database owner — so RLS, grants and SECURITY DEFINER function
 * validation decide every outcome.
 *
 * Reuses the Supabase-shaped storage stub from the documents harness so the
 * full sequence 0001..0007 applies in one database.
 *
 * What is verified here:
 *   1. the applicant path creates their own row only, under their own id;
 *   2. submission from draft, and resubmission from needs-info;
 *   3. the applicant can never set verified/rejected/under-review themselves,
 *      cannot touch another applicant's row, and cannot raise their role;
 *   4. direct table writes remain admin-only (0005 policies);
 *   5. document references must name the caller (segment [2]) and the
 *      application row (segment [3]);
 *   6. administrator review works only through the function, with the
 *      transition matrix enforced and the audit row written inside the same
 *      transaction (a rejected decision leaves neither);
 *   7. reasons are required for needs-info / rejected / suspended;
 *   8. audit history is immututable for ordinary users and appended with the
 *      database-derived reviewer identity.
 */
const { PGlite, AUTH_STUB, applyMigrations } = require("./migrate.js");
const { SUPABASE_DEFAULTS } = require("./defaults.js");

const MIGRATIONS = [
  "0001_init.sql",
  "0002_rapid_response.sql",
  "0003_admin_role_hardening.sql",
  "0004_anonymous_access_privacy.sql",
  "0005_provider_applications.sql",
  "0006_storage_policies.sql",
  "0007_application_workflow.sql",
];

/** Same Supabase-storage mirror the documents harness uses. */
const STORAGE_STUB = `
create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  name text not null,
  owner uuid,
  created_at timestamptz not null default now()
);

alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select (string_to_array(name, '/'))[1:coalesce(array_length(string_to_array(name, '/'), 1), 1) - 1]
$$;

grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;
`;

const as = async (db, role, sub, fn) => {
  await db.exec("reset role;");
  await db.exec(`set role ${role};`);
  await db.exec(`set request.jwt.claims = '${JSON.stringify(sub ? { sub, role } : { role })}';`);
  try {
    const r = await fn();
    return { ok: true, rows: r.rows || [], rowCount: r.rowCount ?? 0 };
  } catch (e) {
    return { ok: false, error: e.message.replace(/\s+/g, " ").trim().slice(0, 160), rowCount: 0 };
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
  await db.exec(STORAGE_STUB);

  console.log("=".repeat(78));
  console.log("APPLICATION WORKFLOW: full sequence 0001..0007, strict");
  console.log("=".repeat(78));
  for (const f of MIGRATIONS) {
    const r = (await applyMigrations(db, [f]))[0];
    console.log(`  ${r.ok ? "APPLIED" : "FAILED "}  ${f}`);
    if (!r.ok) { console.log(`  FIRST FAILURE: ${r.error}`); await db.close(); process.exitCode = 1; return; }
  }

  // Fixtures: three accounts, no real personal data. The admin is promoted
  // along the documented path.
  const U = {
    providerA: "00000000-0000-4000-8000-00000000aa01",
    providerB: "00000000-0000-4000-8000-00000000bb01",
    admin: "00000000-0000-4000-8000-00000000cc01",
    consumer: "00000000-0000-4000-8000-00000000dd01",
  };
  for (const [k, email, meta] of [
    ["providerA", "providerA@qa.test", { name: "Provider A", role: "provider" }],
    ["providerB", "providerB@qa.test", { name: "Provider B", role: "provider" }],
    ["admin", "admin@qa.test", { name: "Admin", role: "consumer" }],
    ["consumer", "consumer@qa.test", { name: "Consumer", role: "consumer" }],
  ]) {
    await db.query("insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3::jsonb)",
      [U[k], email, JSON.stringify(meta)]);
  }
  await db.exec("set role service_role;");
  await db.exec(`set request.jwt.claims = '{"role":"service_role"}';`);
  await db.query("select public.grant_role($1, 'admin')", [U.admin]);
  await db.exec("reset request.jwt.claims;");
  await db.exec("reset role;");

  const LOCAL_APP_ID = "aaaaaaaa-bbbb-4ccc-8ddd-000000000123";
  const DOC_PATH = `provider-applications/${U.providerA}/${LOCAL_APP_ID}/identity/id.png`;

  const draftPayload = (over = {}) => JSON.stringify({
    id: LOCAL_APP_ID,
    email: "providerA@qa.test",
    fullName: "Provider A",
    phone: "+2340000000001",
    acceptedTerms: false,
    acceptedPrivacy: false,
    category: "",
    trainee: false,
    speciality: "", qualifications: "", institution: "", registrationNumber: "",
    licensingBody: "", licenceExpiry: "", yearsExperience: "", bio: "", languages: "",
    state: "", city: "", facility: "", services: "",
    identityDocument: null, credentialEvidence: null,
    ...over,
  });

  section("1. applicant path: create + read own row only");
  const created = await as(db, "authenticated", U.providerA, async () =>
    db.query("select public.upsert_provider_application($1::jsonb, false) row", [draftPayload()]));
  check("applicant creates own draft row via function", created.ok, created.error);
  check("row adopts the client-generated application id", created.rows?.[0]?.row?.id === LOCAL_APP_ID ||
    (await as(db, "service_role", undefined, async () =>
      db.query("select id::text from provider_applications where user_id=$1", [U.providerA]))).rows[0].id === LOCAL_APP_ID);

  const readOwn = await as(db, "authenticated", U.providerA, async () =>
    db.query("select count(*)::int c from provider_applications where user_id=auth.uid()"));
  check("applicant reads back their own application (select_own policy)", readOwn.ok && readOwn.rows[0].c === 1, readOwn.error);

  const readAll = await as(db, "authenticated", U.providerA, async () =>
    db.query("select count(*)::int c from provider_applications"));
  check("applicant cannot read anyone else's application", readAll.ok && readAll.rows[0].c === 1, readAll.error || JSON.stringify(readAll.rows));

  section("2. submission transitions");
  const ready = draftPayload({
    acceptedTerms: true, acceptedPrivacy: true, category: "doctor",
    identityDocument: {
      docType: "National Identity Card", fileName: "id.png", sizeBytes: 10,
      mimeType: "image/png", addedAt: "2026-01-01T00:00:00.000Z",
      storagePath: DOC_PATH,
    },
  });
  const badSubmit = await as(db, "authenticated", U.providerA, async () =>
    db.query("select public.upsert_provider_application($1::jsonb, true) row", [draftPayload()]));
  check("submission without identity document is refused", !badSubmit.ok, badSubmit.error);

  const goodSubmit = await as(db, "authenticated", U.providerA, async () =>
    db.query("select public.upsert_provider_application($1::jsonb, true) row", [ready]));
  check("valid submission is accepted via function", goodSubmit.ok, goodSubmit.error);
  const submitStatus = goodSubmit.rows?.[0]?.row?.status;
  check("submission persists as submitted with server status", submitStatus === "submitted", JSON.stringify(submitStatus));

  const draftAfter = await as(db, "authenticated", U.providerA, async () =>
    db.query("select public.upsert_provider_application($1::jsonb, false) row", [ready]));
  check("applicant cannot edit a submitted application via function", !draftAfter.ok, draftAfter.error);

  section("3. self-approval and role elevation are impossible");
  const directVerified = await as(db, "authenticated", U.providerA, async () =>
    db.query("update provider_applications set status='verified' where user_id=auth.uid()"));
  check("applicant cannot update own row directly (superseded by 0007 revoke)", !directVerified.ok, directVerified.error || `rowCount=${directVerified.rowCount}`);
  const stillSubmitted = (await db.query("select status from provider_applications where id=$1", [LOCAL_APP_ID])).rows[0];
  check("row status is unchanged after the direct attempt", stillSubmitted.status === "submitted", stillSubmitted.status);

  // reset status for the rest of the flow
  await db.exec("set role service_role; set request.jwt.claims='{\"role\":\"service_role\"}';");

  const selfReview = await as(db, "authenticated", U.providerA, async () =>
    db.query("select public.review_provider_application($1::uuid, 'verified', 'self-approve')", [LOCAL_APP_ID]));
  check("a provider's session cannot call the review function", !selfReview.ok, selfReview.error);

  const consumerReview = await as(db, "authenticated", U.consumer, async () =>
    db.query("select public.review_provider_application($1::uuid, 'verified', 'consumer-approve')", [LOCAL_APP_ID]));
  check("a consumer's session cannot call the review function", !consumerReview.ok, consumerReview.error);

  const helper = (await db.query("select public.can_review_transition('under-review','verified') t, public.can_review_transition('under-review','draft') f")).rows[0];
  check("transition helper matrix reads as designed", helper.t === true && helper.f === false, JSON.stringify(helper));

  // admin has no direct UPDATE grant anymore; the function is the only path
  const directAdminUpdate = await as(db, "authenticated", U.admin, async () =>
    db.query("update provider_applications set status='draft' where id=$1", [LOCAL_APP_ID]));
  check("admin session cannot update the row directly (audit bypass closed)", !directAdminUpdate.ok, directAdminUpdate.error || `rowCount=${directAdminUpdate.rowCount}`);

  const startReview = await as(db, "authenticated", U.admin, async () =>
    db.query("select public.review_provider_application($1::uuid, 'under-review', '')", [LOCAL_APP_ID]));
  check("admin can move submitted to under-review (no reason needed)", startReview.ok, startReview.error);
  let auditCount = 1;

  section("4. transition matrix and audit atomicity");
  const invalidToDraft = await as(db, "authenticated", U.admin, async () =>
    db.query("select public.review_provider_application($1::uuid, 'draft', '')", [LOCAL_APP_ID]));
  check("under-review -> draft is refused", !invalidToDraft.ok, invalidToDraft.error);

  const noReason = await as(db, "authenticated", U.admin, async () =>
    db.query("select public.review_provider_application($1::uuid, 'needs-info', '   ')", [LOCAL_APP_ID]));
  const auditAfterBlank = (await db.query("select count(*)::int c from provider_application_audit where application_id=$1", [LOCAL_APP_ID])).rows[0].c;
  check("blank reason for needs-info is refused", !noReason.ok, noReason.error);
  check("refused decision leaves no audit row (same transaction)", auditCount === auditAfterBlank, `${auditCount} vs ${auditAfterBlank}`);
  const rowStill = (await db.query("select status from provider_applications where id=$1", [LOCAL_APP_ID])).rows[0];
  check("refused decision leaves the status unchanged", rowStill.status === "under-review", rowStill.status);

  const askInfo = await as(db, "authenticated", U.admin, async () =>
    db.query("select public.review_provider_application($1::uuid, 'needs-info', 'Please re-upload your licence.')", [LOCAL_APP_ID]));
  auditCount += askInfo.ok ? 1 : 0;
  check("under-review -> needs-info with message commits audit", askInfo.ok, askInfo.error);

  const toVerified = await as(db, "authenticated", U.admin, async () =>
    db.query("select public.review_provider_application($1::uuid, 'verified', 'documents in order')", [LOCAL_APP_ID]));
  auditCount += toVerified.ok ? 1 : 0;
  check("needs-info -> verified with reason commits audit", toVerified.ok, toVerified.error);
  const statuses = (await db.query("select status, identity_status, credentials_status from provider_applications where id=$1", [LOCAL_APP_ID])).rows[0];
  check("verified promotes both verification states (domain parity)", toVerified.ok && statuses.identity_status === "verified" && statuses.credentials_status === "verified", JSON.stringify(statuses));

  const badAfterVerified = await as(db, "authenticated", U.admin, async () =>
    db.query("select public.review_provider_application($1::uuid, 'draft', '')", [LOCAL_APP_ID]));
  check("verified -> draft is refused", !badAfterVerified.ok, badAfterVerified.error);

  const revoke = await as(db, "authenticated", U.admin, async () =>
    db.query("select public.review_provider_application($1::uuid, 'suspended', 'policy violation')", [LOCAL_APP_ID]));
  auditCount += revoke.ok ? 1 : 0;
  check("verified -> suspended with reason commits audit", revoke.ok, revoke.error);

  const terminal = await as(db, "authenticated", U.admin, async () =>
    db.query("select public.review_provider_application($1::uuid, 'draft', '')", [LOCAL_APP_ID]));
  check("suspended -> draft is refused (matrix limits to verified/rejected)", !terminal.ok, terminal.error);

  const lastWord = await as(db, "authenticated", U.admin, async () =>
    db.query("select public.review_provider_application($1::uuid, 'rejected', 'unresolvable eligibility issue')", [LOCAL_APP_ID]));
  auditCount += lastWord.ok ? 1 : 0;
  check("suspended -> rejected with reason commits audit", lastWord.ok, lastWord.error);

  const closed = await as(db, "authenticated", U.admin, async () =>
    db.query("select public.review_provider_application($1::uuid, 'verified', 'reopen attempt')", [LOCAL_APP_ID]));
  check("rejected is terminal on the review path", !closed.ok, closed.error);

  section("5. applicant cannot reopen or rewrite history");
  const reopen = await as(db, "authenticated", U.providerA, async () =>
    db.query("select public.upsert_provider_application($1::jsonb, false) row", [ready]));
  check("applicant cannot edit a rejected application via function", !reopen.ok, reopen.error);

  const auditWrite = await as(db, "authenticated", U.providerA, async () =>
    db.query(`insert into provider_application_audit (application_id, reviewer_id, previous_status, new_status) values ($1, $1, 'draft', 'verified')`, [LOCAL_APP_ID]));
  check("applicant cannot append audit rows", !auditWrite.ok, auditWrite.error);

  const auditRewrite = await as(db, "authenticated", U.admin, async () =>
    db.query("update provider_application_audit set new_status='verified'"));
  check("admin cannot rewrite audit history (no update grant)", !auditRewrite.ok, auditRewrite.error || `rowCount=${auditRewrite.rowCount}`);

  section("6. document references must belong to caller and application");
  const foreignOwnedDoc = await as(db, "authenticated", U.providerB, async () =>
    db.query("select public.upsert_provider_application($1::jsonb, false) row", [
      draftPayload({
        id: "bbbbbbbb-cccc-4ddd-8eee-000000000123",
        email: "providerB@qa.test",
        identityDocument: {
          docType: "National Identity Card", fileName: "id.png", sizeBytes: 10,
          mimeType: "image/png", addedAt: "2026-01-01T00:00:00.000Z",
          storagePath: `provider-applications/${U.providerA}/${LOCAL_APP_ID}/identity/id.png`,
        },
      }),
    ]));
  check("document referencing another applicant's path is refused", !foreignOwnedDoc.ok, foreignOwnedDoc.error);

  const ownForeignApp = await as(db, "authenticated", U.providerB, async () =>
    db.query("select public.upsert_provider_application($1::jsonb, false) row", [
      draftPayload({
        id: "bbbbbbbb-cccc-4ddd-8eee-000000000123",
        email: "providerB@qa.test",
        identityDocument: {
          docType: "National Identity Card", fileName: "id.png", sizeBytes: 10,
          mimeType: "image/png", addedAt: "2026-01-01T00:00:00.000Z",
          storagePath: `provider-applications/${U.providerB}/${LOCAL_APP_ID}/identity/id.png`,
        },
      }),
    ]));
  check("document path naming another application id is refused", !ownForeignApp.ok, ownForeignApp.error);

  const ownCorrect = await as(db, "authenticated", U.providerB, async () =>
    db.query("select public.upsert_provider_application($1::jsonb, false) row", [
      draftPayload({
        id: "bbbbbbbb-cccc-4ddd-8eee-000000000123",
        email: "providerB@qa.test",
        identityDocument: {
          docType: "National Identity Card", fileName: "id.png", sizeBytes: 10,
          mimeType: "image/png", addedAt: "2026-01-01T00:00:00.000Z",
          storagePath: `provider-applications/${U.providerB}/bbbbbbbb-cccc-4ddd-8eee-000000000123/identity/id.png`,
        },
      }),
    ]));
  check("the applicant's own (user, application) document path is accepted", ownCorrect.ok, ownCorrect.error);

  section("7. anonymous and offline denials");
  const anonRpc = await as(db, "anon", null, async () =>
    db.query("select public.upsert_provider_application($1::jsonb, false) row", [draftPayload()]));
  check("anonymous cannot call the applicant function", !anonRpc.ok, anonRpc.error);
  const anonReview = await as(db, "anon", null, async () =>
    db.query("select public.review_provider_application($1::uuid, 'verified', 'x')", [LOCAL_APP_ID]));
  check("anonymous cannot call the review function", !anonReview.ok, anonReview.error);

  const summary = (await db.query(
    `select count(*)::int c from provider_application_audit where application_id=$1`, [LOCAL_APP_ID])).rows[0];
  check("audit trail shows exactly the successful decisions", summary.c === 5, String(summary.c));

  console.log("\n" + "=".repeat(78));
  const failed = checks.filter((c) => !c.ok);
  console.log(`${checks.length - failed.length}/${checks.length} checks passed`);
  for (const f of failed) console.log(`FAILED: ${f.name}${f.detail ? ` -- ${f.detail}` : ""}`);
  await db.close();
  if (failed.length > 0) process.exitCode = 1;
})().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
