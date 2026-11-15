#!/usr/bin/env node
/**
 * Real PostgreSQL staged upgrade: 0001..0016, then 0017.
 *
 * PGlite proved this path on a single connection. This script repeats it on a
 * disposable real PostgreSQL server so that the rename UPDATEs, the constraint
 * swap and the append-only trigger are exercised by the actual engine:
 *
 *   1. apply 0001..0016 and assert the 0015 unique constraint is present;
 *   2. seed legacy media events written under the 0015 vocabulary;
 *   3. prove the 0016 regression: log_consultation_join accepts a suspended
 *      provider and writes join_token_issued;
 *   4. apply 0017;
 *   5. prove the guard is restored, the old constraint is gone, the partial
 *      replacement and dedupe index behave, historical rows are intact, and
 *      the table is still append-only.
 *
 * SAFETY: refuses any host other than loopback unless ALLOW_NON_LOCAL_DATABASE=1,
 * refuses any URL mentioning supabase or a pooler, and refuses a database that
 * already has public.consultations.
 *
 * Run:
 *   PGCONN=postgres://user:secret@127.0.0.1:55432/cnb_staged \
 *     node tests/postgres/staged-0016-0017.mjs
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const { SUPABASE_DEFAULTS } = require("../pglite/defaults.js");

const UP_TO_0016 = [
  "0001_init.sql",
  "0002_rapid_response.sql",
  "0003_admin_role_hardening.sql",
  "0004_anonymous_access_privacy.sql",
  "0005_provider_applications.sql",
  "0006_storage_policies.sql",
  "0007_application_workflow.sql",
  "0008_storage_upload_limits.sql",
  "0009_profile_photo_and_avatars.sql",
  "0010_community.sql",
  "0011_consultations.sql",
  "0012_integrity_hardening.sql",
  "0013_consultation_lifecycle.sql",
  "0014_consultation_authorization.sql",
  "0015_room_lifecycle.sql",
  "0016_consultation_join_token.sql",
];

/* Same semantics as tests/pglite/migrate.js, but role creation is idempotent
   because a real instance may already carry these roles. */
const AUTH_STUB = `
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
`;

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

const RENAMED = {
  room_opened: "join_token_issued",
  closure_requested: "room_closure_requested",
  closure_confirmed: "room_closure_confirmed",
  closure_failed: "room_closure_failed",
};

const checks = [];
function check(name, ok, detail = "") {
  checks.push({ name, ok });
  console.log(`  ${ok ? "OK  " : "FAIL"}  ${name}${detail && !ok ? `  -- ${detail}` : ""}`);
}
function fatal(message) {
  console.error(`\nABORT: ${message}`);
  process.exit(1);
}
const message = (error) => String(error?.message ?? error).replace(/\s+/g, " ").trim();

function gridFloor(ms) {
  const d = new Date(ms);
  d.setUTCMinutes(Math.floor(d.getUTCMinutes() / 15) * 15, 0, 0);
  return d.toISOString();
}

async function as(client, role, sub, fn) {
  await client.query("reset role");
  await client.query(`set role ${role}`);
  await client.query("select set_config('request.jwt.claims', $1, false)", [
    JSON.stringify(sub ? { sub, role } : { role }),
  ]);
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    return { ok: false, error: message(error), code: error.code };
  } finally {
    await client.query("reset role");
    await client.query("select set_config('request.jwt.claims', '', false)");
  }
}

async function main() {
  const connectionString = process.env.PGCONN?.trim();
  if (!connectionString) fatal("PGCONN is required");

  let host;
  try {
    host = new URL(connectionString).hostname;
  } catch {
    fatal("PGCONN is not a valid connection URL");
  }
  if (/supabase|pooler/i.test(connectionString)) {
    fatal("refusing a Supabase/pooler URL: this test must never touch the live project");
  }
  const loopback = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
  if (!loopback.has(host) && process.env.ALLOW_NON_LOCAL_DATABASE !== "1") {
    fatal(`refusing non-loopback host "${host}"`);
  }

  let Client;
  try {
    ({ Client } = require("pg"));
  } catch {
    fatal('the "pg" client is not installed. npm install --no-save --no-package-lock pg');
  }

  const client = new Client({ connectionString });
  await client.connect();
  await client.query("set statement_timeout = 0");
  await client.query("set lock_timeout = 0");

  try {
    const existing = await client.query("select to_regclass('public.consultations') as t");
    if (existing.rows[0].t) fatal("database already has public.consultations");

    console.log("=".repeat(78));
    console.log("STAGED UPGRADE 0001..0016 -> 0017: real PostgreSQL");
    console.log("=".repeat(78));

    await client.query("set check_function_bodies = on");
    const strict = await client.query("show check_function_bodies");
    check(
      "running with check_function_bodies=on",
      String(strict.rows[0].check_function_bodies).toLowerCase() === "on",
      strict.rows[0].check_function_bodies,
    );

    await client.query(AUTH_STUB);
    await client.query(STORAGE_STUB);
    await client.query(SUPABASE_DEFAULTS);

    let applied = 0;
    for (const file of UP_TO_0016) {
      try {
        await client.query(readFileSync(join(REPO, "supabase", "migrations", file), "utf8"));
        applied += 1;
      } catch (error) {
        fatal(`${file}: ${message(error)}`);
      }
    }
    check(`0001..0016 apply in order (${applied}/16)`, applied === UP_TO_0016.length, String(applied));

    const oldConstraint = async () =>
      (
        await client.query(
          `select conname from pg_constraint
            where conrelid = 'public.consultation_media_events'::regclass
              and conname = 'consultation_media_events_consultation_id_event_detail_key'`,
        )
      ).rows;
    check(
      "0015 unique (consultation_id,event,detail) exists at 0016",
      (await oldConstraint()).length === 1,
    );

    const body = async () =>
      (
        await client.query(
          `select pg_get_functiondef(p.oid) as d
             from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname = 'log_consultation_join'`,
        )
      ).rows[0].d;
    check(
      "0016 body no longer calls is_verified_provider_user",
      !/is_verified_provider_user/.test(await body()),
    );

    const PATIENT = "00000000-0000-4000-8000-00000000a0f1";
    const PROVIDER = "00000000-0000-4000-8000-00000000a0f2";

    for (const [id, email, meta] of [
      [PATIENT, "staged-patient@qa.test", { name: "Staged Patient", role: "consumer" }],
      [PROVIDER, "staged-provider@qa.test", { name: "Dr Staged", role: "provider" }],
    ]) {
      await client.query(
        "insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3::jsonb)",
        [id, email, JSON.stringify(meta)],
      );
    }
    await client.query(
      `insert into public.provider_applications
         (user_id,email,full_name,status,submitted_at,category,speciality,state,city,facility)
       values ($1,'staged-provider@qa.test','Dr Staged','verified',now(),
               'doctor','General practice','Lagos','Ikeja','Care Clinic')`,
      [PROVIDER],
    );

    const inserted = await client.query(
      `insert into public.consultations
         (patient_id,provider_id,scheduled_for,duration_minutes,status,reason,patient_consent)
       values ($1,$2,$3,30,'requested','Staged 0016 probe',true)
       returning id, room_name`,
      [PATIENT, PROVIDER, gridFloor(Date.now() - 2 * 60000)],
    );
    const cid = inserted.rows[0].id;
    const room = inserted.rows[0].room_name;
    await client.query("update public.consultations set status='accepted' where id=$1", [cid]);

    await client.query("update public.provider_applications set status='suspended' where user_id=$1", [
      PROVIDER,
    ]);

    const seedEvents = [
      ["room_opened", null, "system", "daily", "", "9 minutes"],
      ["closure_requested", null, "system", "daily", "consultation_completed", "8 minutes"],
      ["closure_confirmed", null, "system", "daily", "provider 200", "7 minutes"],
      ["closure_failed", null, "system", "daily", "provider 500", "6 minutes"],
      ["reconciliation_flagged", null, "system", "", "", "5 minutes"],
      ["participant_joined", PATIENT, "patient", "daily", "", "4 minutes"],
      ["participant_left", PATIENT, "patient", "daily", "", "3 minutes"],
    ];
    for (const [event, actor, role, provider, detail, ago] of seedEvents) {
      await client.query(
        `insert into public.consultation_media_events
           (consultation_id, actor_id, actor_role, event, provider, detail, created_at)
         values ($1,$2,$3,$4,$5,$6, now() - $7::interval)`,
        [cid, actor, role, event, provider, detail, ago],
      );
    }

    const snapshot = async () =>
      (
        await client.query(
          `select id, event, actor_id::text as actor_id, actor_role, provider, detail, created_at
             from public.consultation_media_events
            order by id`,
        )
      ).rows;
    const before = await snapshot();
    check("seven legacy media events seeded at 0016", before.length === 7, String(before.length));

    const auditRows = async () =>
      (
        await client.query(
          `select id, actor_id::text as actor_id, actor_role, event, created_at
             from public.consultation_events
            where consultation_id = $1 and event = 'join_token_issued'
            order by id`,
          [cid],
        )
      ).rows;
    const callJoin = (sub) =>
      as(client, "authenticated", sub, () =>
        client.query("select public.log_consultation_join($1)", [cid]),
      );

    const at0016 = await callJoin(PATIENT);
    check(
      "REGRESSION: 0016 accepts the suspended provider's consultation",
      at0016.ok,
      at0016.error,
    );
    const auditBefore = await auditRows();
    check("0016 writes exactly one join_token_issued audit row", auditBefore.length === 1, String(auditBefore.length));

    try {
      await client.query(readFileSync(join(REPO, "supabase", "migrations", "0017_room_event_semantics.sql"), "utf8"));
      check("0017 applies on top of 0016", true);
    } catch (error) {
      check("0017 applies on top of 0016", false, message(error));
      fatal("0017 failed to apply");
    }

    check(
      "0017 restores is_verified_provider_user in log_consultation_join",
      /is_verified_provider_user/.test(await body()),
    );

    const at0017Patient = await callJoin(PATIENT);
    check(
      "FIXED: 0017 refuses the suspended provider's consultation for the patient",
      !at0017Patient.ok && /provider is not verified/i.test(at0017Patient.error),
      at0017Patient.error,
    );
    const at0017Provider = await callJoin(PROVIDER);
    check(
      "0017 refuses the suspended provider calling on their own behalf",
      !at0017Provider.ok && /provider is not verified/i.test(at0017Provider.error),
      at0017Provider.error,
    );
    const auditAfter = await auditRows();
    check("0017 appends no second audit row", auditAfter.length === 1, String(auditAfter.length));
    check(
      "the 0016 audit row keeps id, actor, role and timestamp",
      auditAfter.length === 1 &&
        auditBefore.length === 1 &&
        auditAfter[0].id === auditBefore[0].id &&
        auditAfter[0].actor_id === auditBefore[0].actor_id &&
        auditAfter[0].actor_role === auditBefore[0].actor_role &&
        new Date(auditAfter[0].created_at).getTime() === new Date(auditBefore[0].created_at).getTime(),
    );

    const after = await snapshot();
    const afterById = new Map(after.map((row) => [String(row.id), row]));
    check("historical media rows keep their ids", before.every((row) => afterById.has(String(row.id))));
    check(
      "historical event labels are renamed in place",
      before.every((row) => afterById.get(String(row.id))?.event === (RENAMED[row.event] ?? row.event)),
      before
        .filter((row) => afterById.get(String(row.id))?.event !== (RENAMED[row.event] ?? row.event))
        .map((row) => `${row.id}:${row.event}`)
        .join(","),
    );
    check(
      "historical actors, providers and details are preserved",
      before.every((row) => {
        const now = afterById.get(String(row.id));
        return (
          now &&
          now.actor_id === row.actor_id &&
          now.actor_role === row.actor_role &&
          now.provider === row.provider &&
          now.detail === row.detail
        );
      }),
    );
    check(
      "historical timestamps are preserved",
      before.every(
        (row) =>
          new Date(afterById.get(String(row.id))?.created_at).getTime() ===
          new Date(row.created_at).getTime(),
      ),
    );

    check("the 0015 unique constraint was actually dropped", (await oldConstraint()).length === 0);

    const replacement = (
      await client.query(
        `select indexdef from pg_indexes
          where schemaname='public' and indexname='consultation_media_events_event_detail_idx'`,
      )
    ).rows[0]?.indexdef ?? "";
    check(
      "the partial replacement index exists",
      /create unique index/i.test(replacement) &&
        /participant_joined/.test(replacement) &&
        /participant_left/.test(replacement),
      replacement,
    );
    const dedupeIndex = (
      await client.query(
        `select indexdef from pg_indexes
          where schemaname='public' and indexname='consultation_media_events_dedupe_idx'`,
      )
    ).rows[0]?.indexdef ?? "";
    check(
      "the dedupe-key unique index exists",
      /create unique index/i.test(dedupeIndex) && /dedupe_key/.test(dedupeIndex),
      dedupeIndex,
    );

    const insertEvent = (event, detail, key = "") =>
      client.query(
        `insert into public.consultation_media_events
           (consultation_id, actor_id, actor_role, event, provider, detail, dedupe_key)
         values ($1,$2,'system',$3,'daily',$4,$5)`,
        [cid, null, event, detail, key],
      );

    const duplicateClosure = await insertEvent("room_closure_confirmed", "provider 200").then(
      () => ({ ok: true }),
      (error) => ({ ok: false, code: error.code }),
    );
    check(
      "a duplicate non-presence event is still rejected",
      !duplicateClosure.ok && duplicateClosure.code === "23505",
      String(duplicateClosure.code),
    );

    const secondJoin = await insertEvent("participant_joined", "").then(
      () => ({ ok: true }),
      (error) => ({ ok: false, error: message(error) }),
    );
    check(
      "a second presence row with the same detail is now allowed",
      secondJoin.ok,
      secondJoin.error,
    );

    await insertEvent("participant_joined", "", "sha-duplicate");
    const duplicateKey = await insertEvent("participant_joined", "", "sha-duplicate").then(
      () => ({ ok: true }),
      (error) => ({ ok: false, code: error.code }),
    );
    check(
      "a duplicate presence dedupe key is rejected",
      !duplicateKey.ok && duplicateKey.code === "23505",
      String(duplicateKey.code),
    );

    const webhook = (key) =>
      as(client, "service_role", null, () =>
        client.query("select public.record_room_participant_event($1,$2,$3,$4) as r", [
          room,
          "participant_joined",
          "daily",
          key,
        ]),
      );
    const firstDelivery = await webhook("sha-rpc-a");
    const repeatDelivery = await webhook("sha-rpc-a");
    const otherDelivery = await webhook("sha-rpc-b");
    check(
      "record_room_participant_event returns recorded then duplicate",
      firstDelivery.ok &&
        firstDelivery.value.rows[0].r === "recorded" &&
        repeatDelivery.ok &&
        repeatDelivery.value.rows[0].r === "duplicate",
      `${firstDelivery.error ?? firstDelivery.value?.rows[0]?.r} / ${repeatDelivery.error ?? repeatDelivery.value?.rows[0]?.r}`,
    );
    check(
      "a different dedupe key records a new presence row",
      otherDelivery.ok && otherDelivery.value.rows[0].r === "recorded",
      otherDelivery.error,
    );

    const targetId = before[0].id;
    const updateAttempt = await client
      .query("update public.consultation_media_events set provider='tampered' where id=$1", [targetId])
      .then(() => ({ ok: true }), (error) => ({ ok: false, error: message(error) }));
    check(
      "the append-only trigger blocks UPDATE",
      !updateAttempt.ok && /append-only/i.test(updateAttempt.error),
      updateAttempt.error,
    );
    const deleteAttempt = await client
      .query("delete from public.consultation_media_events where id=$1", [targetId])
      .then(() => ({ ok: true }), (error) => ({ ok: false, error: message(error) }));
    check(
      "the append-only trigger blocks DELETE",
      !deleteAttempt.ok && /append-only/i.test(deleteAttempt.error),
      deleteAttempt.error,
    );
    const triggerState = (
      await client.query(
        `select tgenabled from pg_trigger
          where tgname='consultation_media_events_immutable'
            and tgrelid='public.consultation_media_events'::regclass`,
      )
    ).rows[0]?.tgenabled;
    check("the append-only trigger is re-enabled after the rename", triggerState === "O", triggerState);

    const integrity = await client.query(
      `select count(*)::int as n,
              count(distinct id)::int as ids
         from public.consultation_media_events`,
    );
    check(
      "media audit rows remain individually addressable",
      integrity.rows[0].n === integrity.rows[0].ids,
      JSON.stringify(integrity.rows[0]),
    );
  } finally {
    await client.end().catch(() => {});
  }

  const passed = checks.filter((entry) => entry.ok).length;
  console.log(`\nSTAGED 0016->0017 RESULT: ${passed}/${checks.length} checks passed`);
  if (passed !== checks.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error("HARNESS ERROR:", message(error));
  process.exitCode = 2;
});
