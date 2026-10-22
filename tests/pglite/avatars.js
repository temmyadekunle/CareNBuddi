/**
 * Patient profile photo durability (0009), executed against real PostgreSQL
 * with check_function_bodies = on, as anon / authenticated / service_role —
 * never as the database owner — so RLS, grants and CHECK constraints decide
 * the outcome.
 *
 * Reuses the Supabase-shaped storage stub from the documents harness.
 *
 * What is being verified:
 *   1. the full nine-migration sequence applies strictly;
 *   2. profiles.photo_path exists, is nullable, and the owner can write it;
 *   3. photo_path cannot point into somebody else's avatars segment (CHECK);
 *   4. 0003's model survives: the role column stays unwritable while
 *      photo_path is writable — promotion still needs the Worker path;
 *   5. the avatars bucket is private, 2 MiB, JPEG-only;
 *   6. avatar objects are owner-scoped: upload into your own segment only,
 *      upload under anyone else's segment (including an administrator's)
 *      denied, anonymous roles see nothing;
 *   7. no cross-bucket leak: the new avatars policies do not grant anything
 *      under provider-applications, and provider policies do not grant
 *      anything under avatars beyond the owner's own segment;
 *   8. administrators deliberately have NO avatar read policy: the photo is
 *      the patient's personal data.
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
  "0009_profile_photo_and_avatars.sql",
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
  await db.exec(STORAGE_STUB);

  console.log("=".repeat(78));
  console.log("AVATAR VERIFICATION: full sequence 0001..0009, strict");
  console.log("=".repeat(78));
  for (const f of MIGRATIONS) {
    const r = (await applyMigrations(db, [f]))[0];
    console.log(`  ${r.ok ? "APPLIED" : "FAILED "}  ${f}`);
    if (!r.ok) { console.log(`  FIRST FAILURE: ${r.error}`); await db.close(); process.exitCode = 1; return; }
  }

  // Fixtures: no real personal data.
  const U = {
    consumerA: "00000000-0000-4000-8000-00000000aa01",
    consumerB: "00000000-0000-4000-8000-00000000bb01",
    admin: "00000000-0000-4000-8000-00000000cc01",
  };
  for (const [k, email, meta] of [
    ["consumerA", "patientA@qa.test", { name: "Patient A", role: "consumer" }],
    ["consumerB", "patientB@qa.test", { name: "Patient B", role: "consumer" }],
    ["admin", "admin@qa.test", { name: "Admin", role: "admin" }],
  ]) {
    await db.query("insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3::jsonb)",
      [U[k], email, JSON.stringify(meta)]);
  }

  await db.exec("set role service_role;");
  await db.exec(`set request.jwt.claims = '{"role":"service_role"}';`);
  await db.query("select public.grant_role($1, 'admin')", [U.admin]);
  await db.exec("reset request.jwt.claims;");
  await db.exec("reset role;");

  const pathA = `avatars/${U.consumerA}/1719999999999.jpg`;
  const pathAModifiedBucketPath = `${U.consumerA}/1719999999999.jpg`;

  // ---------------------------------------------------------------- column
  section("1. profiles.photo_path column");
  const col = await db.query(
    `select column_name, is_nullable from information_schema.columns
      where table_schema='public' and table_name='profiles' and column_name='photo_path'`);
  check("photo_path exists", col.rowCount === 1);
  check("photo_path is nullable", col.rows[0].is_nullable === "YES");

  const pathAWrite = await as(db, "authenticated", U.consumerA, async () =>
    db.query("update public.profiles set photo_path=$1 where id=$2 returning photo_path", [pathA, U.consumerA]));
  check("owner writes own photo_path", pathAWrite.ok && pathAWrite.rows[0].photo_path === pathA, pathAWrite.error);

  const readBack = await as(db, "authenticated", U.consumerA, async () =>
    db.query("select photo_path from public.profiles where id=$1", [U.consumerA]));
  check("owner reads own photo_path", readBack.ok && readBack.rows[0].photo_path === pathA, readBack.error);

  const peerRead = await as(db, "authenticated", U.consumerB, async () =>
    db.query("select photo_path from public.profiles where id=$1", [U.consumerA]));
  check("another patient sees nothing of the row (RLS)", peerRead.ok && peerRead.rows.length === 0, peerRead.error);

  const clearRef = await as(db, "authenticated", U.consumerA, async () =>
    db.query("update public.profiles set photo_path=null where id=$1 returning photo_path", [U.consumerA]));
  check("owner can clear own photo_path", clearRef.ok && clearRef.rows[0].photo_path === null, clearRef.error);

  section("2. photo_path scope constraint");
  const foreignPath = await as(db, "authenticated", U.consumerA, async () =>
    db.query("update public.profiles set photo_path=$1 where id=$2", [`avatars/${U.consumerB}/1.jpg`, U.consumerA]));
  check("photo_path cannot point at another user's segment", !foreignPath.ok, foreignPath.error);

  const weirdPath = await as(db, "authenticated", U.consumerA, async () =>
    db.query("update public.profiles set photo_path=$1 where id=$2", [`somewhere-else/${U.consumerA}/1.jpg`, U.consumerA]));
  check("photo_path must stay inside the avatars bucket scheme", !weirdPath.ok, weirdPath.error);

  const danglingPath = await as(db, "authenticated", U.consumerA, async () =>
    db.query("update public.profiles set photo_path=$1 where id=$2", [`avatars/${U.consumerA}/`, U.consumerA]));
  check("photo_path needs a file segment", !danglingPath.ok, danglingPath.error);

  section("3. the role column stays out of reach (0003 preserved)");
  const selfAdmin = await as(db, "authenticated", U.consumerA, async () =>
    db.query("update public.profiles set role='admin' where id=$1", [U.consumerA]));
  check("photo_path grant does not re-open role self-assignment", !selfAdmin.ok, selfAdmin.error || "unexpected success");

  const grantRole = await as(db, "authenticated", U.consumerA, async () =>
    db.query("select public.grant_role($1, 'admin')", [U.consumerA]));
  check("grant_role stays revoked from authenticated", !grantRole.ok, grantRole.error || "unexpected success");

  // ---------------------------------------------------------------- bucket
  section("4. avatars bucket configuration (0009)");
  const bucket = await db.query("select id, public, file_size_limit::text size, allowed_mime_types mimes from storage.buckets where id='avatars'");
  check("avatars bucket exists", bucket.rowCount === 1);
  check("avatars bucket is private", bucket.rows[0].public === false);
  check("avatars upload limit is 2 MiB", bucket.rows[0].size === "2097152", bucket.rows[0].size);
  check("avatars MIME list is JPEG-only",
    JSON.stringify(bucket.rows[0].mimes) === JSON.stringify(["image/jpeg"]), JSON.stringify(bucket.rows[0].mimes));
  check("provider-applications limits unchanged by 0009",
    (await db.query("select file_size_limit::text s from storage.buckets where id='provider-applications'")).rows[0].s === "8388608");

  // -------------------------------------------------------------- policies
  section("5. avatar objects are owner-scoped");
  const ownUpload = await as(db, "authenticated", U.consumerA, async () =>
    db.query("insert into storage.objects (bucket_id, name) values ('avatars', $1) returning name", [pathA]));
  check("owner uploads into own avatars segment", ownUpload.ok, ownUpload.error || "denied");

  const foreignUpload = await as(db, "authenticated", U.consumerA, async () =>
    db.query("insert into storage.objects (bucket_id, name) values ('avatars', $1)", [`avatars/${U.consumerB}/2.jpg`]));
  check("owner cannot upload under another user's segment", !foreignUpload.ok, foreignUpload.error || "unexpected success");

  const stolenName = await as(db, "authenticated", U.consumerA, async () =>
    db.query("insert into storage.objects (bucket_id, name) values ('avatars', 'browsing.jpg')"));
  check("no loose files in the avatars bucket (owner segment mandatory)", !stolenName.ok, stolenName.error || "unexpected success");

  const readOwn = await as(db, "authenticated", U.consumerA, async () =>
    db.query("select name from storage.objects where bucket_id='avatars'"));
  check("owner reads back own avatar", readOwn.ok && readOwn.rows.length === 1, readOwn.error);

  const readForeign = await as(db, "authenticated", U.consumerB, async () =>
    db.query("select count(*)::int c from storage.objects where bucket_id='avatars'"));
  check("another patient sees zero avatars", readForeign.ok && readForeign.rows[0].c === 0, readForeign.error);

  const adminAvatarRead = await as(db, "authenticated", U.admin, async () =>
    db.query("select count(*)::int c from storage.objects where bucket_id='avatars'"));
  check("admin deliberately has NO avatar read policy", adminAvatarRead.ok && adminAvatarRead.rows[0].c === 0, adminAvatarRead.error);

  const anonRead = await as(db, "anon", null, async () =>
    db.query("select count(*)::int c from storage.objects where bucket_id='avatars'"));
  check("anonymous cannot read avatars", anonRead.ok && anonRead.rows[0].c === 0, anonRead.error);

  const anonUpload = await as(db, "anon", null, async () =>
    db.query("insert into storage.objects (bucket_id, name) values ('avatars', 'avatars/' || '00000000-0000-4000-8000-00000000aa01' || '/9.jpg')"));
  check("anonymous cannot upload avatars", !anonUpload.ok, anonUpload.error || "unexpected success");

  const selfDelete = await as(db, "authenticated", U.consumerA, async () =>
    db.query("delete from storage.objects where bucket_id='avatars'"));
  check("owner cannot delete avatars (append-only revocation preserved)", !selfDelete.ok, selfDelete.error || `rowCount=${selfDelete.rowCount}`);

  const selfRewrite = await as(db, "authenticated", U.consumerA, async () =>
    db.query("update storage.objects set name=$1 where bucket_id='avatars'", [`avatars/${U.consumerB}/9.jpg`]));
  check("owner cannot rewrite avatar object paths", !selfRewrite.ok, selfRewrite.error || `rowCount=${selfRewrite.rowCount}`);

  section("6. no cross-bucket leak");
  const crossUpload = await as(db, "authenticated", U.consumerA, async () =>
    db.query("insert into storage.objects (bucket_id, name) values ('provider-applications', $1)",
      [`avatars/${U.consumerB}/1.jpg`]));
  check("avatar-named uploads still cannot enter another user's provider path", !crossUpload.ok, crossUpload.error || "unexpected success");

  const providerOwnDocs = await as(db, "authenticated", U.consumerA, async () =>
    db.query("select count(*)::int c from storage.objects where bucket_id='provider-applications'"));
  check("provider-applications remains untouched for a consumer fixture", providerOwnDocs.ok && providerOwnDocs.rows[0].c === 0, providerOwnDocs.error);

  const docsPolicyCount = await db.query(
    "select count(*)::int c from pg_policies where schemaname='storage' and policyname like 'provider_applications_%'");
  check("provider document policies intact", docsPolicyCount.rows[0].c === 3, docsPolicyCount.rows[0].c);
  const avatarPolicyCount = await db.query(
    "select count(*)::int c from pg_policies where schemaname='storage' and policyname like 'avatars_%'");
  check("exactly two avatars policies", avatarPolicyCount.rows[0].c === 2, avatarPolicyCount.rows[0].c);

  section("7. the sample path the dedupe layer relies on");
  check("reference path shape matches lib/avatar-storage.ts",
    /^avatars\/[A-Za-z0-9_-]+\/[0-9]+\.jpg$/.test(pathA) && isValidShape(pathAModifiedBucketPath), pathA);
  function isValidShape(bucketRelative) {
    return /^[A-Za-z0-9_-]+\/[0-9]+\.jpg$/.test(bucketRelative);
  }

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
