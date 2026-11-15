#!/usr/bin/env node
/**
 * Real two-connection concurrency checks for the consultation lifecycle.
 *
 * Every scenario runs in its own disposable database, built from the real
 * migrations 0001..0017, with two independent pg connections (distinct
 * pg_backend_pid values). Locking is proved deterministically: the first
 * connection holds its row lock inside an open transaction, the second calls
 * the same operation with a short lock_timeout and must fail with 55P03.
 * A statement that is expected not to wait (SKIP LOCKED) runs under the same
 * lock_timeout and must succeed. No assertion depends on wall-clock timing.
 *
 * Scenarios:
 *   1. concurrent consultation responses (respond_consultation)
 *   2. concurrent stale expiry (expire_stale_consultations)
 *   3. room-closure batch claiming with FOR UPDATE SKIP LOCKED
 *   4. concurrent join-token issuance and idempotency (record_join_token_issued)
 *   5. concurrent participant-event dedupe (record_room_participant_event)
 *   6. concurrent room-closure reconciliation (reconcile_room_closures)
 *
 * SAFETY: loopback hosts only unless ALLOW_NON_LOCAL_DATABASE=1; refuses any
 * URL mentioning supabase or a pooler; creates and drops only cnb_conc_*.
 *
 * Run:
 *   PGCONN=postgres://user:secret@127.0.0.1:55433/postgres \
 *     node tests/postgres/concurrency-extra.mjs
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const { SUPABASE_DEFAULTS } = require("../pglite/defaults.js");

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
  "0010_community.sql",
  "0011_consultations.sql",
  "0012_integrity_hardening.sql",
  "0013_consultation_lifecycle.sql",
  "0014_consultation_authorization.sql",
  "0015_room_lifecycle.sql",
  "0016_consultation_join_token.sql",
  "0017_room_event_semantics.sql",
];

const AUTH_STUB = `
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key, email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create or replace function auth.uid() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
create or replace function auth.role() returns text
language sql stable as $$
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

const PATIENT = "00000000-0000-4000-8000-0000000d0a01";
const PROVIDER = "00000000-0000-4000-8000-0000000d0a02";

const checks = [];
let CURRENT = "";
function check(name, ok, detail = "") {
  const full = `${CURRENT}: ${name}`;
  checks.push({ name: full, ok });
  console.log(`  ${ok ? "OK  " : "FAIL"}  ${name}${detail && !ok ? `  -- ${detail}` : ""}`);
}
const describe = (error) => String(error?.message ?? error).replace(/\s+/g, " ").trim();
const iso = (value) => new Date(value).toISOString();

async function attempt(promise) {
  try {
    return { ok: true, value: await promise };
  } catch (error) {
    return { ok: false, code: error.code, error: describe(error) };
  }
}

function grid(offsetMinutes) {
  const d = new Date(Date.now() + offsetMinutes * 60000);
  d.setUTCSeconds(0, 0);
  d.setUTCMinutes(Math.floor(d.getUTCMinutes() / 15) * 15);
  return d.toISOString();
}

function withDatabase(base, name) {
  const url = new URL(base);
  url.pathname = `/${name}`;
  return url.toString();
}

async function connect(url) {
  const { Client } = require("pg");
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query("set statement_timeout = 0");
  await client.query("set lock_timeout = 0");
  const pid = (await client.query("select pg_backend_pid() as pid")).rows[0].pid;
  return { client, pid };
}

async function beginAs(client, role, sub) {
  await client.query("begin");
  await client.query(`set local role ${role}`);
  await client.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify(sub ? { sub, role } : { role }),
  ]);
}

async function bootstrap(client) {
  await client.query("set check_function_bodies = on");
  const strict = await client.query("show check_function_bodies");
  if (String(strict.rows[0].check_function_bodies).toLowerCase() !== "on") {
    throw new Error("check_function_bodies is not on");
  }
  await client.query(AUTH_STUB);
  await client.query(STORAGE_STUB);
  await client.query(SUPABASE_DEFAULTS);
  for (const file of MIGRATIONS) {
    await client.query(readFileSync(join(REPO, "supabase", "migrations", file), "utf8"));
  }
}

async function seedAccounts(client) {
  for (const [id, email, meta] of [
    [PATIENT, "conc2-patient@qa.test", { name: "Second Patient", role: "consumer" }],
    [PROVIDER, "conc2-provider@qa.test", { name: "Dr Second", role: "provider" }],
  ]) {
    await client.query(
      "insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3::jsonb)",
      [id, email, JSON.stringify(meta)],
    );
  }
  await client.query(
    `insert into public.provider_applications
       (user_id,email,full_name,status,submitted_at,category,speciality,state,city,facility)
     values ($1,'conc2-provider@qa.test','Dr Second','verified',now(),
             'doctor','General practice','Lagos','Ikeja','Care Clinic')`,
    [PROVIDER],
  );
}

async function addConsultation(client, scheduled, duration = 30) {
  const inserted = await client.query(
    `insert into public.consultations
       (patient_id,provider_id,scheduled_for,duration_minutes,status,reason,patient_consent)
     values ($1,$2,$3,$4,'requested','Concurrency probe',true)
     returning id, room_name`,
    [PATIENT, PROVIDER, scheduled, duration],
  );
  return inserted.rows[0];
}

async function accept(client, id) {
  await client.query("update public.consultations set status='accepted' where id=$1", [id]);
}

async function openRoom(client, id) {
  await client.query(
    "update public.consultations set room_opened_at=now(), room_provider='daily' where id=$1",
    [id],
  );
}

async function complete(client, id) {
  await client.query("update public.consultations set status='in_progress' where id=$1", [id]);
  await client.query("update public.consultations set status='completed' where id=$1", [id]);
}

// ---------------------------------------------------------------------------
// 1. Concurrent responses
// ---------------------------------------------------------------------------
async function scenarioRespond(c1, c2) {
  await seedAccounts(c1);
  const { id } = await addConsultation(c1, grid(24 * 60));

  await beginAs(c1, "authenticated", PROVIDER);
  const first = await attempt(
    c1.query("select public.respond_consultation($1,true,$2)", [id, "first response"]),
  );
  check("the first response succeeds inside its transaction", first.ok, first.error);

  await beginAs(c2, "authenticated", PROVIDER);
  await c2.query("set local lock_timeout = '400ms'");
  const blocked = await attempt(
    c2.query("select public.respond_consultation($1,false,$2)", [id, "second response"]),
  );
  check(
    "the concurrent response waits on the winner's row lock",
    !blocked.ok && blocked.code === "55P03",
    `${blocked.code ?? ""} ${blocked.error ?? ""}`,
  );
  await c2.query("rollback");
  await c1.query("commit");

  await beginAs(c2, "authenticated", PROVIDER);
  const rejected = await attempt(
    c2.query("select public.respond_consultation($1,false,$2)", [id, "second response"]),
  );
  check(
    "after the winner commits, the second response is rejected as already handled",
    !rejected.ok && rejected.code === "P0001" && /already handled/i.test(rejected.error),
    `${rejected.code ?? ""} ${rejected.error ?? ""}`,
  );
  await c2.query("rollback");

  const row = (
    await c1.query("select status, decline_reason from public.consultations where id=$1", [id])
  ).rows[0];
  check("final status is the winner's acceptance", row.status === "accepted", row.status);
  check(
    "no decline was recorded",
    row.decline_reason === null || row.decline_reason === "",
    String(row.decline_reason),
  );
  const events = (
    await c1.query(
      `select event, count(*)::int as n from public.consultation_events
        where consultation_id=$1 group by event`,
      [id],
    )
  ).rows;
  check(
    "exactly one accepted event and no declined event exist",
    events.length === 1 && events[0].event === "accepted" && events[0].n === 1,
    JSON.stringify(events),
  );
}

// ---------------------------------------------------------------------------
// 2. Concurrent stale expiry
// ---------------------------------------------------------------------------
async function scenarioExpiry(c1, c2) {
  await seedAccounts(c1);
  const { id } = await addConsultation(c1, grid(-61));

  await beginAs(c1, "service_role", null);
  const first = await attempt(c1.query("select public.expire_stale_consultations() as n"));
  check("the first expiry run expires the stale row", first.ok && first.value.rows[0].n === 1, first.error);

  await beginAs(c2, "service_role", null);
  await c2.query("set local lock_timeout = '400ms'");
  const blocked = await attempt(c2.query("select public.expire_stale_consultations() as n"));
  check(
    "the concurrent expiry waits on the updated row",
    !blocked.ok && blocked.code === "55P03",
    `${blocked.code ?? ""} ${blocked.error ?? ""}`,
  );
  await c2.query("rollback");
  await c1.query("commit");

  await beginAs(c2, "service_role", null);
  const second = await attempt(c2.query("select public.expire_stale_consultations() as n"));
  check(
    "the second expiry run after commit expires nothing",
    second.ok && second.value.rows[0].n === 0,
    second.error ?? String(second.value?.rows[0]?.n),
  );
  await c2.query("commit");

  await beginAs(c2, "authenticated", PATIENT);
  const forbidden = await attempt(c2.query("select public.expire_stale_consultations()"));
  check(
    "an authenticated caller cannot run system expiry",
    !forbidden.ok && (forbidden.code === "42501" || /service role required/i.test(forbidden.error)),
    `${forbidden.code ?? ""} ${forbidden.error ?? ""}`,
  );
  await c2.query("rollback");

  const row = (
    await c1.query("select status from public.consultations where id=$1", [id])
  ).rows[0];
  check("final status is expired", row.status === "expired", row.status);
  const events = (
    await c1.query(
      `select count(*)::int as n from public.consultation_events
        where consultation_id=$1 and event='expired'`,
      [id],
    )
  ).rows[0].n;
  check("exactly one expired audit event exists", events === 1, String(events));
}

// ---------------------------------------------------------------------------
// 3. SKIP LOCKED closure claiming
// ---------------------------------------------------------------------------
async function scenarioClaimBatch(c1, c2) {
  await seedAccounts(c1);
  const ids = [];
  for (const offset of [24 * 60, 25 * 60, 26 * 60]) {
    const { id } = await addConsultation(c1, grid(offset));
    await accept(c1, id);
    await openRoom(c1, id);
    await complete(c1, id);
    ids.push(id);
  }

  await beginAs(c1, "service_role", null);
  const first = await attempt(c1.query("select * from public.claim_room_closure_batch(2)"));
  check("the first claim takes two rows", first.ok && first.value.rows.length === 2, first.error);

  await beginAs(c2, "service_role", null);
  await c2.query("set local lock_timeout = '1s'");
  const second = await attempt(c2.query("select * from public.claim_room_closure_batch(10)"));
  check(
    "the overlapping claim does not wait and skips locked rows",
    second.ok && second.value.rows.length === 1,
    second.error ?? String(second.value?.rows.length),
  );

  const firstIds = (first.value?.rows ?? []).map((row) => row.consultation_id);
  const secondIds = (second.value?.rows ?? []).map((row) => row.consultation_id);
  check(
    "the two batches are disjoint",
    firstIds.every((id) => !secondIds.includes(id)),
    `${firstIds.join(",")} / ${secondIds.join(",")}`,
  );
  check(
    "the two batches cover all three rows",
    new Set([...firstIds, ...secondIds]).size === 3,
    String(new Set([...firstIds, ...secondIds]).size),
  );

  await c1.query("commit");
  await c2.query("commit");

  await beginAs(c2, "service_role", null);
  const again = await attempt(c2.query("select * from public.claim_room_closure_batch(10)"));
  await c2.query("commit");
  check(
    "an immediate re-claim honours the two-minute backoff",
    again.ok && again.value.rows.length === 0,
    again.error ?? String(again.value?.rows.length),
  );

  const state = (
    await c1.query(
      `select count(*)::int as rows,
              count(*) filter (where room_closure_attempts = 1)::int as once,
              count(*) filter (where room_closure_state = 'pending')::int as pending,
              count(distinct id)::int as distinct_ids
         from public.consultations`,
    )
  ).rows[0];
  check(
    "every row was claimed exactly once and remains pending",
    state.rows === 3 && state.once === 3 && state.pending === 3 && state.distinct_ids === 3,
    JSON.stringify(state),
  );
}

// ---------------------------------------------------------------------------
// 4. Concurrent join-token issuance
// ---------------------------------------------------------------------------
async function scenarioJoinToken(c1, c2) {
  await seedAccounts(c1);
  const a = await addConsultation(c1, grid(24 * 60));
  const b = await addConsultation(c1, grid(25 * 60));
  const contested = await addConsultation(c1, grid(26 * 60));
  for (const row of [a, b, contested]) await accept(c1, row.id);

  await beginAs(c1, "service_role", null);
  const independentA = await attempt(
    c1.query("select public.record_join_token_issued($1,'daily') as r", [a.id]),
  );
  await beginAs(c2, "service_role", null);
  const independentB = await attempt(
    c2.query("select public.record_join_token_issued($1,'daily') as r", [b.id]),
  );
  check(
    "issuance for two different consultations both succeed concurrently",
    independentA.ok &&
      independentA.value.rows[0].r === true &&
      independentB.ok &&
      independentB.value.rows[0].r === true,
    `${independentA.error ?? independentA.value?.rows[0]?.r} / ${independentB.error ?? independentB.value?.rows[0]?.r}`,
  );
  await c1.query("commit");
  await c2.query("commit");

  await beginAs(c1, "service_role", null);
  const winner = await attempt(
    c1.query("select public.record_join_token_issued($1,'daily') as r", [contested.id]),
  );
  check("the first issuance for the contested room succeeds", winner.ok && winner.value.rows[0].r === true, winner.error);

  await beginAs(c2, "service_role", null);
  await c2.query("set local lock_timeout = '400ms'");
  const blocked = await attempt(
    c2.query("select public.record_join_token_issued($1,'daily') as r", [contested.id]),
  );
  check(
    "the concurrent issuance waits on the consultation row lock",
    !blocked.ok && blocked.code === "55P03",
    `${blocked.code ?? ""} ${blocked.error ?? ""}`,
  );
  await c2.query("rollback");
  await c1.query("commit");

  await beginAs(c2, "service_role", null);
  const repeat = await attempt(
    c2.query("select public.record_join_token_issued($1,'daily') as r", [contested.id]),
  );
  check(
    "the retry is idempotent and returns false",
    repeat.ok && repeat.value.rows[0].r === false,
    repeat.error ?? String(repeat.value?.rows[0]?.r),
  );
  await c2.query("commit");

  const media = (
    await c1.query(
      `select consultation_id, count(*)::int as n
         from public.consultation_media_events
        where event='join_token_issued' and consultation_id = any($1::uuid[])
        group by consultation_id`,
      [[a.id, b.id, contested.id]],
    )
  ).rows;
  check(
    "each consultation has exactly one issuance row",
    media.length === 3 && media.every((row) => row.n === 1),
    JSON.stringify(media),
  );
  const opened = (
    await c1.query(
      "select count(*)::int as n from public.consultations where room_opened_at is not null and id = any($1::uuid[])",
      [[a.id, b.id, contested.id]],
    )
  ).rows[0].n;
  check("every consultation records a single room-opened timestamp", opened === 3, String(opened));
}

// ---------------------------------------------------------------------------
// 5. Concurrent participant-event dedupe
// ---------------------------------------------------------------------------
async function scenarioParticipantDedupe(c1, c2) {
  await seedAccounts(c1);
  const { id, room_name: room } = await addConsultation(c1, grid(24 * 60));
  await accept(c1, id);

  await beginAs(c1, "service_role", null);
  const first = await attempt(
    c1.query("select public.record_room_participant_event($1,'participant_joined','daily','sha-k1') as r", [room]),
  );
  check("the first delivery is recorded", first.ok && first.value.rows[0].r === "recorded", first.error);

  await beginAs(c2, "service_role", null);
  await c2.query("set local lock_timeout = '400ms'");
  const blocked = await attempt(
    c2.query("select public.record_room_participant_event($1,'participant_joined','daily','sha-k1') as r", [room]),
  );
  check(
    "a concurrent duplicate waits on the uncommitted unique index entry",
    !blocked.ok && blocked.code === "55P03",
    `${blocked.code ?? ""} ${blocked.error ?? ""}`,
  );
  await c2.query("rollback");
  await c1.query("commit");

  await beginAs(c2, "service_role", null);
  const duplicate = await attempt(
    c2.query("select public.record_room_participant_event($1,'participant_joined','daily','sha-k1') as r", [room]),
  );
  check(
    "the duplicate delivery is a clean no-op, not an SQL error",
    duplicate.ok && duplicate.value.rows[0].r === "duplicate",
    duplicate.error ?? String(duplicate.value?.rows[0]?.r),
  );
  const other = await attempt(
    c2.query("select public.record_room_participant_event($1,'participant_joined','daily','sha-k2') as r", [room]),
  );
  check("a different dedupe key is recorded", other.ok && other.value.rows[0].r === "recorded", other.error);
  await c2.query("commit");

  const rows = (
    await c1.query(
      `select dedupe_key, count(*)::int as n
         from public.consultation_media_events
        where consultation_id=$1 and event='participant_joined'
        group by dedupe_key`,
      [id],
    )
  ).rows;
  check(
    "the final table holds one row per dedupe key",
    rows.length === 2 &&
      rows.find((row) => row.dedupe_key === "sha-k1")?.n === 1 &&
      rows.find((row) => row.dedupe_key === "sha-k2")?.n === 1,
    JSON.stringify(rows),
  );
  const opened = (
    await c1.query("select room_opened_at from public.consultations where id=$1", [id])
  ).rows[0].room_opened_at;
  check("the confirmed connection set room_opened_at", opened !== null);
}

// ---------------------------------------------------------------------------
// 6. Concurrent reconciliation
// ---------------------------------------------------------------------------
async function scenarioReconcile(c1, c2) {
  await seedAccounts(c1);
  const { id } = await addConsultation(c1, grid(24 * 60));
  await accept(c1, id);
  await complete(c1, id);
  await c1.query(
    `insert into public.consultation_media_events
       (consultation_id, actor_id, actor_role, event, provider, detail)
     values ($1,$2,'patient','join_token_issued','daily','legacy-evidence')`,
    [id, PATIENT],
  );

  const initial = (
    await c1.query("select room_closure_state from public.consultations where id=$1", [id])
  ).rows[0].room_closure_state;
  check("the fixture is not yet queued for closure", initial === "not_required", initial);

  await beginAs(c1, "service_role", null);
  const first = await attempt(c1.query("select public.reconcile_room_closures() as r"));
  check(
    "the first reconciliation flags the row once",
    first.ok && first.value.rows[0].r.flagged === 1,
    first.error ?? JSON.stringify(first.value?.rows[0]?.r),
  );

  await beginAs(c2, "service_role", null);
  await c2.query("set local lock_timeout = '400ms'");
  const blocked = await attempt(c2.query("select public.reconcile_room_closures() as r"));
  check(
    "a concurrent reconciliation waits on the row lock",
    !blocked.ok && blocked.code === "55P03",
    `${blocked.code ?? ""} ${blocked.error ?? ""}`,
  );
  await c2.query("rollback");
  await c1.query("commit");

  await beginAs(c2, "service_role", null);
  const second = await attempt(c2.query("select public.reconcile_room_closures() as r"));
  check(
    "the retry flags nothing and raises no uniqueness error",
    second.ok && second.value.rows[0].r.flagged === 0,
    `${second.code ?? ""} ${second.error ?? JSON.stringify(second.value?.rows[0]?.r)}`,
  );
  await c2.query("commit");

  const flags = (
    await c1.query(
      `select count(*)::int as n from public.consultation_media_events
        where consultation_id=$1 and event='reconciliation_flagged'`,
      [id],
    )
  ).rows[0].n;
  check("exactly one reconciliation flag exists", flags === 1, String(flags));
  const state = (
    await c1.query("select room_closure_state from public.consultations where id=$1", [id])
  ).rows[0].room_closure_state;
  check("the row is queued as pending", state === "pending", state);
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function runScenario(control, base, slug, fn) {
  CURRENT = slug;
  const name = `cnb_conc_${slug}`;
  console.log(`\n== ${slug} ==`);
  await control.query(`drop database if exists ${name} with (force)`);
  await control.query(`create database ${name}`);

  const a = await connect(withDatabase(base, name));
  const b = await connect(withDatabase(base, name));
  console.log(`  backend PIDs: ${a.pid} and ${b.pid}`);
  check("the two sessions are independent backends", a.pid !== b.pid, `${a.pid} vs ${b.pid}`);
  try {
    await bootstrap(a.client);
    await fn(a.client, b.client);
  } finally {
    await a.client.end().catch(() => {});
    await b.client.end().catch(() => {});
  }
}

async function main() {
  const base = process.env.PGCONN?.trim();
  if (!base) {
    console.error("ABORT: PGCONN is required");
    process.exit(1);
  }
  let host;
  try {
    host = new URL(base).hostname;
  } catch {
    console.error("ABORT: PGCONN is not a valid connection URL");
    process.exit(1);
  }
  if (/supabase|pooler/i.test(base)) {
    console.error("ABORT: refusing a Supabase/pooler URL");
    process.exit(1);
  }
  const loopback = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
  if (!loopback.has(host) && process.env.ALLOW_NON_LOCAL_DATABASE !== "1") {
    console.error(`ABORT: refusing non-loopback host "${host}"`);
    process.exit(1);
  }
  try {
    require.resolve("pg");
  } catch {
    console.error('ABORT: "pg" is not installed');
    process.exit(1);
  }

  const control = (await connect(withDatabase(base, "postgres"))).client;
  try {
    console.log("=".repeat(78));
    console.log("EXTRA CONCURRENCY: two independent connections, real PostgreSQL");
    console.log("=".repeat(78));
    await runScenario(control, base, "respond", scenarioRespond);
    await runScenario(control, base, "expiry", scenarioExpiry);
    await runScenario(control, base, "claimbatch", scenarioClaimBatch);
    await runScenario(control, base, "jointoken", scenarioJoinToken);
    await runScenario(control, base, "presence", scenarioParticipantDedupe);
    await runScenario(control, base, "reconcile", scenarioReconcile);
  } finally {
    await control.end().catch(() => {});
  }

  CURRENT = "";
  const passed = checks.filter((entry) => entry.ok).length;
  console.log(`\nEXTRA CONCURRENCY RESULT: ${passed}/${checks.length} checks passed`);
  if (passed !== checks.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error("HARNESS ERROR:", describe(error));
  process.exitCode = 2;
});
