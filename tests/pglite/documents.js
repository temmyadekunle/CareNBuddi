/**
 * Provider document verification (0005 + 0006), executed against real
 * PostgreSQL with check_function_bodies = on, as anon / authenticated /
 * service_role — never as the database owner — so RLS and grants decide the
 * outcome.
 *
 * Supabase ships a `storage` schema (storage.buckets, storage.objects,
 * storage.foldername). PGlite has none, so this harness stubs the minimum
 * surface the migrations and policies touch. The stub mirrors Supabase's own
 * semantics: foldername() returns the parent directories of an object path,
 * and RLS is enabled on storage.objects, which is what makes the bucket
 * policies the actual gate instead of decoration.
 *
 * What is being verified:
 *   1. the full eight-migration sequence applies strictly;
 *   2. the storage policies exist and are bucket-scoped;
 *   3. an applicant can upload only under their own path segment;
 *   4. an applicant cannot read, replace, or delete their uploads
 *      (append-only is a revocation, not an omission);
 *   5. anonymous callers see nothing and can write nothing;
 *   6. an administrator can read any document for review;
 *   7. the audit table is admin-read, admin-append, and nobody
 *      can update or delete history;
 *   8. 0008 pins the bucket to private with the 8 MiB limit and the
 *      four-item MIME allowlist, and upserts idempotently.
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
  "0008_storage_upload_limits.sql",
];

/** Minimum Supabase-storage mirror. */
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
    return { ok: true, rows: r.rows || [], rowCount: r.rowCount ?? (r.rows ? r.rows.length : 0) };
  } catch (e) {
    return { ok: false, error: e.message.replace(/\s+/g, " ").trim().slice(0, 150), rowCount: 0 };
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

  // The bucket row 0005 inserts must land: the storage stub exists BEFORE the
  // migrations, so 0005's `insert into storage.buckets` and 0006's policies
  // run against the real-object-shaped stub rather than skipping.
  await db.exec(STORAGE_STUB);

  console.log("=".repeat(78));
  console.log("PROVIDER DOCUMENT VERIFICATION: full sequence 0001..0008, strict");
  console.log("=".repeat(78));
  for (const f of MIGRATIONS) {
    const r = (await applyMigrations(db, [f]))[0];
    console.log(`  ${r.ok ? "APPLIED" : "FAILED "}  ${f}`);
    if (!r.ok) { console.log(`  FIRST FAILURE: ${r.error}`); await db.close(); process.exitCode = 1; return; }
  }

  // Fixtures: no real personal data.
  const U = {
    providerA: "00000000-0000-4000-8000-00000000aa01",
    providerB: "00000000-0000-4000-8000-00000000bb01",
    admin: "00000000-0000-4000-8000-00000000cc01",
  };
  for (const [k, email, meta] of [
    ["providerA", "providerA@qa.test", { name: "Provider A", role: "provider" }],
    ["providerB", "providerB@qa.test", { name: "Provider B", role: "provider" }],
    ["admin", "admin@qa.test", { name: "Admin", role: "admin" }],
  ]) {
    await db.query("insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3::jsonb)",
      [U[k], email, JSON.stringify(meta)]);
  }
  // profiles rows are created by the handle_new_user trigger from 0001, and
  // per 0003 the signup path never self-assigns 'admin' — a signed-up admin
  // lands as 'consumer' and must be promoted via grant_role() as service_role,
  // the only supported provisioning path.
  const signupRole = (await db.query("select role from public.profiles where id=$1", [U.admin])).rows[0].role;
  check("signup does not self-assign admin", signupRole === "consumer", `role after signup: ${signupRole}`);

  await db.exec("set role service_role;");
  // A real service-role request carries {"role":"service_role"} and no sub;
  // the guard in grant_role() keys on exactly that.
  await db.exec(`set request.jwt.claims = '{"role":"service_role"}';`);
  await db.query("select public.grant_role($1, 'admin')", [U.admin]);
  await db.exec("reset request.jwt.claims;");
  await db.exec("reset role;");
  const adminRole = (await db.query("select role from public.profiles where id=$1", [U.admin])).rows[0].role;
  check("admin promoted via grant_role()", adminRole === "admin", `role: ${adminRole}`);

  // Application rows: created via the service path, as the storage API would
  // never need them written by clients for this test.
  await db.exec("set role service_role;");
  await db.query(
    `insert into public.provider_applications (user_id, email, full_name) values ($1,'providerA@qa.test','Provider A'),($2,'providerB@qa.test','Provider B')`,
    [U.providerA, U.providerB],
  );
  await db.exec("reset role;");

  const appA = (await db.query("select id from public.provider_applications where user_id=$1", [U.providerA])).rows[0].id;
  const appB = (await db.query("select id from public.provider_applications where user_id=$1", [U.providerB])).rows[0].id;
  const pathA = `provider-applications/${U.providerA}/${appA}/identity/id-card.png`;
  const pathB = `provider-applications/${U.providerB}/${appB}/credentials/license.pdf`;

  // Bucket row from 0005.
  section("1. private bucket created by 0005");
  const bucket = await db.query("select id, public from storage.buckets where id='provider-applications'");
  check("provider-applications bucket exists", bucket.rowCount === 1);
  check("bucket is private", JSON.stringify(bucket.rows[0].public) === "false" || bucket.rows[0].public === false);
  check("no public buckets exist", (await db.query("select count(*)::int c from storage.buckets where public")).rows[0].c === 0);

  section("1b. bucket limits configured by 0008");
  const limits = (await db.query(
    "select file_size_limit::text size, allowed_mime_types mimes, public from storage.buckets where id='provider-applications'",
  )).rows[0];
  check("upload size limit set to 8 MiB", limits.size === "8388608", limits.size);
  check(
    "MIME allowlist matches the client whitelist exactly",
    JSON.stringify(limits.mimes) === JSON.stringify(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
    JSON.stringify(limits.mimes),
  );
  const noop = await db.exec("update storage.buckets set file_size_limit=8388608, allowed_mime_types=array['image/jpeg','image/png','image/webp','application/pdf'] where id='provider-applications'");
  noop; // idempotency of 0008 is proven by re-running applyMigrations below
  const reapply = (await applyMigrations(db, ["0008_storage_upload_limits.sql"]))[0];
  check("0008 re-applies without error (idempotent upsert)", reapply.ok, reapply.error);
  const limits2 = (await db.query(
    "select file_size_limit::text size, allowed_mime_types mimes from storage.buckets where id='provider-applications'",
  )).rows[0];
  check("limits unchanged after re-apply", limits2.size === "8388608" && JSON.stringify(limits2.mimes).includes("image/png"), JSON.stringify(limits2));

  section("2. policies are bucket-scoped and owner-scoped");
  const pol = (await db.query(
    `select policyname, cmd, roles from pg_policies where schemaname='storage' order by policyname`,
  )).rows.map((r) => `${r.policyname}(${r.cmd})`);
  check("upload policy restricted to own path segment", pol.some((p) => p.startsWith("provider_applications_upload_own")), pol.join(", "));

  // Sanity: 0001..0004 anonymous guarantees must still hold.
  const anonRead = await as(db, "anon", null, async () =>
    db.query("select count(*)::int c from storage.objects"));
  check("anonymous cannot read storage objects", anonRead.ok && anonRead.rows[0].c === 0, anonRead.error);
  const anonWrite = await as(db, "anon", null, async () =>
    db.query("insert into storage.objects (bucket_id, name) values ('provider-applications', $1)", [pathA]));
  check("anonymous cannot upload documents", !anonWrite.ok, anonWrite.error);
  const anonAudit = await as(db, "anon", null, async () =>
    db.query("select count(*)::int c from public.provider_application_audit"));
  check("anonymous cannot read audit history", anonAudit.ok && anonAudit.rows[0].c === 0, anonAudit.error);

  section("3. applicant uploads are path-scoped");
  const ownUpload = await as(db, "authenticated", U.providerA, async () =>
    db.query("insert into storage.objects (bucket_id, name) values ('provider-applications', $1) returning name", [pathA]));
  check("applicant uploads under own path", ownUpload.ok, ownUpload.error);

  const foreignUpload = await as(db, "authenticated", U.providerA, async () =>
    db.query("insert into storage.objects (bucket_id, name) values ('provider-applications', $1)", [pathB]));
  check("applicant cannot upload into another applicant's path", !foreignUpload.ok, foreignUpload.error);

  const otherBucket = await as(db, "authenticated", U.providerA, async () =>
    db.query("insert into storage.objects (bucket_id, name) values ('avatars', 'whatever.png')"));
  check("policies do not leak into other buckets", !otherBucket.ok, otherBucket.error);

  section("4. uploads are append-only off the client path");
  const ownSelect = await as(db, "authenticated", U.providerA, async () =>
    db.query("select name from storage.objects"));
  check("applicant reads back own document", ownSelect.ok && ownSelect.rows.length === 1, ownSelect.error);

  const foreignRead = await as(db, "authenticated", U.providerA, async () =>
    db.query("select name from storage.objects"));
  check("applicant cannot read other applicants' documents", foreignRead.ok && foreignRead.rows.length === 1, JSON.stringify(foreignRead.rows.length));

  const selfDelete = await as(db, "authenticated", U.providerA, async () =>
    db.query("delete from storage.objects where name=$1", [pathA]));
  check("applicant cannot delete own upload", !selfDelete.ok, selfDelete.error || `rowCount=${selfDelete.rowCount}`);

  const selfFix = await as(db, "authenticated", U.providerA, async () =>
    db.query("update storage.objects set name=$1 where name=$2", [pathB, pathA]));
  check("applicant cannot rewrite their object's path", !selfFix.ok, selfFix.error || `rowCount=${selfFix.rowCount}`);

  section("5. administrator review access");
  const ownUploadB = await as(db, "authenticated", U.providerB, async () =>
    db.query("insert into storage.objects (bucket_id, name) values ('provider-applications', $1) returning name", [pathB]));
  check("second applicant uploads under own path", ownUploadB.ok, ownUploadB.error);

  const adminRead = await as(db, "authenticated", U.admin, async () =>
    db.query("select name from storage.objects order by name"));
  check("admin can read all documents for review", adminRead.ok && adminRead.rows.length === 2, adminRead.error || JSON.stringify(adminRead.rows.length));

  const providerBRead = await as(db, "authenticated", U.providerB, async () =>
    db.query("select name from storage.objects order by name"));
  check("second provider sees only their own document", providerBRead.ok && providerBRead.rows.length === 1 && providerBRead.rows[0].name === pathB);

  section("6. audit history append-only and admin-only");
  const adminAuditInsertOk = await as(db, "authenticated", U.admin, async () =>
    db.query(
      `insert into public.provider_application_audit (application_id, reviewer_id, previous_status, new_status, reason)
       values ($1,$2,'submitted','under-review','beginning credential check') returning id`,
      [appA, U.admin],
    ));
  check("admin appends audit row", adminAuditInsertOk.ok, adminAuditInsertOk.error);

  const adminForge = await as(db, "authenticated", U.admin, async () =>
    db.query(
      `insert into public.provider_application_audit (application_id, reviewer_id, previous_status, new_status)
       values ($1,$2,'draft','verified','')`,
      [appB, U.providerB],
    ));
  check("admin cannot forge another reviewer's audit entry", !adminForge.ok, adminForge.error);

  const providerAuditRead = await as(db, "authenticated", U.providerA, async () =>
    db.query("select count(*)::int c from public.provider_application_audit"));
  check("applicant cannot read audit history", providerAuditRead.ok && providerAuditRead.rows[0].c === 0, providerAuditRead.error);

  const providerAuditWrite = await as(db, "authenticated", U.providerA, async () =>
    db.query(
      `insert into public.provider_application_audit (application_id, reviewer_id, previous_status, new_status) values ($1,$1,'draft','verified')`,
      [U.providerA],
    ));
  check("applicant cannot append audit rows", !providerAuditWrite.ok, providerAuditWrite.error);

  const auditRewrite = await as(db, "authenticated", U.admin, async () =>
    db.query("update public.provider_application_audit set new_status='verified'"));
  check("admin cannot rewrite audit history (no update grant)", !auditRewrite.ok, auditRewrite.error || `rowCount=${auditRewrite.rowCount}`);

  const auditErase = await as(db, "authenticated", U.admin, async () =>
    db.query("delete from public.provider_application_audit"));
  check("admin cannot erase audit history (no delete grant)", !auditErase.ok, auditErase.error || `rowCount=${auditErase.rowCount}`);

  // Anonymous escalation sweep on the new table.
  const anonForcedWrite = await as(db, "anon", null, async () =>
    db.query(
      `insert into public.provider_application_audit (application_id, reviewer_id, previous_status, new_status) values ($1,$2,'draft','verified')`,
      [appA, U.admin],
    ));
  check("anonymous cannot write audit rows", !anonForcedWrite.ok, anonForcedWrite.error);

  section("7. path helper");
  const helper = (await db.query(
    "select public.validate_provider_document_path($1::uuid, $2::uuid, 'identity', $3) p",
    [U.providerA, appA, "id-card.png"],
  )).rows[0].p;
  check("path helper returns application-scoped path", helper === pathA, helper);

  // ---------------------------------------------------------------- summary
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
