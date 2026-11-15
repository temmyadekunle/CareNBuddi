/**
 * Two-phase proof that 0016 temporarily removed the provider-verification
 * guard from log_consultation_join and that 0017 restored it.
 *
 * Delivered by the audit task as text; run with:
 *   node tests/pglite/regression-0016.js
 */
const { PGlite, AUTH_STUB, applyMigrations } = require("./migrate.js");
const { SUPABASE_DEFAULTS } = require("./defaults.js");

const UP_TO_0015 = [
  "0001_init.sql", "0002_rapid_response.sql", "0003_admin_role_hardening.sql",
  "0004_anonymous_access_privacy.sql", "0005_provider_applications.sql",
  "0006_storage_policies.sql", "0007_application_workflow.sql",
  "0008_storage_upload_limits.sql", "0009_profile_photo_and_avatars.sql",
  "0010_community.sql", "0011_consultations.sql", "0012_integrity_hardening.sql",
  "0013_consultation_lifecycle.sql", "0014_consultation_authorization.sql",
  "0015_room_lifecycle.sql",
];

const STORAGE_STUB = `
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  name text not null, owner uuid, created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select (string_to_array(name, '/'))[1:coalesce(array_length(string_to_array(name, '/'), 1), 1) - 1]
$$;
grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;
`;

const checks = [];
const check = (name, ok, detail = "") => {
  checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  -- ${detail}` : ""}`);
};

const as = async (db, role, sub, fn) => {
  await db.exec("reset role;");
  await db.exec(`set role ${role};`);
  await db.exec(`set request.jwt.claims = '${JSON.stringify(sub ? { sub, role } : { role })}';`);
  try {
    return { ok: true, ...(await fn()) };
  } catch (e) {
    return { ok: false, error: e.message.replace(/\s+/g, " ").trim() };
  } finally {
    await db.exec("reset role;");
    await db.exec("set request.jwt.claims = '';");
  }
};

const gridFloor = (ms) => {
  const d = new Date(ms);
  d.setUTCMinutes(Math.floor(d.getUTCMinutes() / 15) * 15, 0, 0);
  return d.toISOString();
};

(async () => {
  const db = await PGlite.create();
  await db.exec(AUTH_STUB);
  await db.exec(STORAGE_STUB);
  await db.exec(SUPABASE_DEFAULTS);

  const seq = await applyMigrations(db, UP_TO_0015);
  const failed = seq.find((r) => !r.ok);
  check("0001..0015 apply with check_function_bodies=on", !failed, failed ? failed.error : "");

  const PATIENT = "00000000-0000-4000-8000-0000000000f1";
  const PROVIDER = "00000000-0000-4000-8000-0000000000f2";

  await db.query(
    "insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3::jsonb)",
    [PATIENT, "reg-patient@qa.test", JSON.stringify({ name: "Regression Patient", role: "consumer" })],
  );
  await db.query(
    "insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3::jsonb)",
    [PROVIDER, "reg-provider@qa.test", JSON.stringify({ name: "Dr Regression", role: "provider" })],
  );

  await db.exec("set role service_role;");
  await db.exec(`set request.jwt.claims = '{"role":"service_role"}';`);

  await db.query(
    `insert into public.provider_applications
       (user_id,email,full_name,status,submitted_at,category,speciality,state,city,facility)
     values ($1,'reg-provider@qa.test','Dr Regression','verified',now(),
             'doctor','General practice','Lagos','Ikeja','Care Clinic')`,
    [PROVIDER],
  );

  const inserted = await db.query(
    `insert into public.consultations
       (patient_id,provider_id,scheduled_for,duration_minutes,status,reason,patient_consent)
     values ($1,$2,$3,30,'requested','Suspension regression probe',true)
     returning id`,
    [PATIENT, PROVIDER, gridFloor(Date.now() - 2 * 60000)],
  );
  const cid = inserted.rows[0].id;
  await db.query("update public.consultations set status='accepted' where id=$1", [cid]);

  // Suspend only after the booking exists, so the insert guard saw a verified provider.
  await db.query("update public.provider_applications set status='suspended' where user_id=$1", [PROVIDER]);
  await db.exec("reset request.jwt.claims;");
  await db.exec("reset role;");

  const body = async () =>
    (await db.query(
      `select pg_get_functiondef(p.oid) d
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname='public' and p.proname='log_consultation_join'`,
    )).rows[0].d;

  const joinRows = async () =>
    (await db.query(
      `select count(*)::int n from public.consultation_events
        where consultation_id=$1 and event='join_token_issued'`,
      [cid],
    )).rows[0].n;

  const callJoin = (sub) =>
    as(db, "authenticated", sub, () => db.query("select public.log_consultation_join($1)", [cid]));

  // ---- Phase 1: 0014's function, still in force at 0015 ---------------------
  const at0015 = await callJoin(PATIENT);
  check(
    "0015: a suspended provider's consultation is refused",
    !at0015.ok && /provider is not verified/i.test(at0015.error),
    at0015.error,
  );

  // ---- Phase 2: the regression --------------------------------------------
  const r16 = (await applyMigrations(db, ["0016_consultation_join_token.sql"]))[0];
  check("0016 applies", r16.ok, r16.error || "");
  check(
    "0016 function body no longer calls is_verified_provider_user",
    !/is_verified_provider_user/.test(await body()),
  );

  const at0016 = await callJoin(PATIENT);
  check(
    "REGRESSION: at 0016 the same call succeeds for a suspended provider",
    at0016.ok,
    at0016.error || "",
  );

  const rows16 = await joinRows();
  check("at 0016 the call writes exactly one join_token_issued event", rows16 === 1, String(rows16));

  // ---- Phase 3: the repair ------------------------------------------------
  const r17 = (await applyMigrations(db, ["0017_room_event_semantics.sql"]))[0];
  check("0017 applies on top of 0016", r17.ok, r17.error || "");
  check(
    "0017 restores is_verified_provider_user in log_consultation_join",
    /is_verified_provider_user/.test(await body()),
  );

  const at0017 = await callJoin(PATIENT);
  check(
    "FIXED: at 0017 the same call is refused again",
    !at0017.ok && /provider is not verified/i.test(at0017.error),
    at0017.error,
  );

  const at0017Provider = await callJoin(PROVIDER);
  check(
    "0017 refuses the suspended provider calling on their own behalf",
    !at0017Provider.ok && /provider is not verified/i.test(at0017Provider.error),
    at0017Provider.error,
  );

  const rows17 = await joinRows();
  check("0017 appends no second audit row", rows17 === 1, String(rows17));
  check(
    "the 0016 audit row survives the upgrade with its new label",
    (await db.query(
      `select 1 from public.consultation_events
        where consultation_id=$1 and event='join_token_issued'`,
      [cid],
    )).rows.length === 1,
  );
  check(
    "the 0015 unique constraint was actually dropped (silent-name risk)",
    (await db.query(
      `select count(*)::int n from pg_constraint
        where conrelid='public.consultation_media_events'::regclass
          and conname='consultation_media_events_consultation_id_event_detail_key'`,
    )).rows[0].n === 0,
  );

  const passed = checks.filter((c) => c.ok).length;
  console.log(`\n0016/0017 REGRESSION RESULT: ${passed}/${checks.length} checks passed`);
  await db.close();
  if (passed !== checks.length) process.exitCode = 1;
})().catch((e) => {
  console.error("HARNESS ERROR:", e.message);
  process.exitCode = 2;
});
