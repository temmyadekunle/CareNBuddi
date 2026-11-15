#!/usr/bin/env node
/**
 * Real two-connection concurrency test for consultation booking exclusion.
 *
 * WHY THIS FILE EXISTS
 * tests/pglite/consultations.js proves the constraints and the slot arithmetic,
 * but PGlite runs a single connection, so it cannot interleave two
 * transactions. This script uses two independent PostgreSQL connections to
 * prove the guarantee that the PGlite harness can only describe:
 *
 *   1. two simultaneous overlapping bookings for one provider: the second
 *      INSERT blocks on the first transaction's uncommitted slot claim, and
 *      fails once the first commits;
 *   2. only one of the two conflicting requests exists afterwards;
 *   3. adjacent bookings both succeed;
 *   4. two providers can hold the same wall-clock slot;
 *   5. cancelling and completing a consultation release its claims, so the
 *      slot can be booked again.
 *
 * STATUS: executed against a disposable PostgreSQL 17.11 container. The
 * 30-minute probe occupies exactly two 15-minute slots, so the first real run
 * exposed an incorrect expected count of three; the expectation was corrected
 * (and tightened to assert the two covered slots) without changing the
 * migration or removing any concurrency check.
 *
 * PREREQUISITES (all operator-supplied; nothing here installs a server)
 *   1. A disposable database on a local PostgreSQL instance:
 *        createdb cnb_concurrency
 *   2. The PostgreSQL client for Node, without touching package.json:
 *        npm install --no-save pg
 *   3. Run:
 *        PGCONN=postgres://postgres:postgres@127.0.0.1:5432/cnb_concurrency \
 *          node tests/postgres/booking-concurrency.mjs
 *
 * SAFETY
 *   - The script refuses any host other than loopback unless
 *     ALLOW_NON_LOCAL_DATABASE=1, and refuses any URL mentioning supabase or
 *     a pooler outright. It never connects to the live project.
 *   - It refuses to run against a database that already has
 *     public.consultations, so it cannot touch existing data.
 *   - It applies the real migrations 0001..0017 unmodified, with the same
 *     auth/storage stubs the PGlite harness uses.
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..");
const { AUTH_STUB } = require("../pglite/migrate.js");
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

// Mirrors tests/pglite/consultations.js. Only 0006 and 0009 need it.
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
returns text[] language sql immutable
as $$
  select (string_to_array(name, '/'))[1:coalesce(array_length(string_to_array(name, '/'), 1), 1) - 1]
$$;
grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;
`;

const U = {
  patientA: "10000000-0000-4000-8000-000000000a01",
  patientB: "10000000-0000-4000-8000-000000000b01",
  provider: "10000000-0000-4000-8000-000000000c01",
  providerOther: "10000000-0000-4000-8000-000000000c02",
};

const BASE = "2031-03-04T09:00:00.000Z";
const at = (minutes) => new Date(new Date(BASE).getTime() + minutes * 60000).toISOString();

const INSERT = `insert into public.consultations
  (patient_id, provider_id, scheduled_for, duration_minutes, reason, patient_consent)
  values ($1, $2, $3, $4, $5, true)
  returning id`;

const checks = [];
function check(name, ok, detail = "") {
  checks.push({ name, ok });
  console.log(`  ${ok ? "OK  " : "FAIL"}  ${name}${detail && !ok ? `  -- ${detail}` : ""}`);
}
function fatal(message) {
  console.error(`\nABORT: ${message}`);
  process.exit(1);
}

function settleWithin(promise, ms) {
  let timer;
  const timeout = new Promise((resolveTimeout) => {
    timer = setTimeout(() => resolveTimeout({ pending: true }), ms);
  });
  return Promise.race([
    promise.then(
      (value) => ({ pending: false, value }),
      (error) => ({ pending: false, error }),
    ),
    timeout,
  ]).finally(() => clearTimeout(timer));
}

async function connect(Client, connectionString, label) {
  const client = new Client({ connectionString });
  await client.connect();
  await client.query("set statement_timeout = 0");
  await client.query("set lock_timeout = 0");
  const pid = await client.query("select pg_backend_pid() as pid");
  return { client, label, pid: pid.rows[0].pid };
}

async function main() {
  const connectionString = process.env.PGCONN?.trim();
  if (!connectionString) {
    fatal(
      "PGCONN is required. Example:\n" +
        "  PGCONN=postgres://postgres:postgres@127.0.0.1:5432/cnb_concurrency \\\n" +
        "    node tests/postgres/booking-concurrency.mjs",
    );
  }

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
    fatal(
      `refusing non-loopback host "${host}". Set ALLOW_NON_LOCAL_DATABASE=1 only ` +
        "for a disposable local instance.",
    );
  }

  let Client;
  try {
    ({ Client } = require("pg"));
  } catch {
    fatal(
      'the "pg" client is not installed. Install it without changing package.json:\n' +
        "  npm install --no-save pg",
    );
  }

  const admin = await connect(Client, connectionString, "setup");
  try {
    const existing = await admin.client.query("select to_regclass('public.consultations') as t");
    if (existing.rows[0].t) {
      fatal("the database already has public.consultations; point PGCONN at a disposable database");
    }

    console.log("=".repeat(78));
    console.log("BOOKING CONCURRENCY: two connections, real PostgreSQL");
    console.log("=".repeat(78));

    await admin.client.query(AUTH_STUB);
    await admin.client.query(SUPABASE_DEFAULTS);
    await admin.client.query(STORAGE_STUB);
    for (const file of MIGRATIONS) {
      const sql = readFileSync(join(REPO, "supabase", "migrations", file), "utf8");
      try {
        await admin.client.query(sql);
        console.log(`  APPLIED  ${file}`);
      } catch (error) {
        fatal(`${file}: ${error.message}`);
      }
    }

    for (const [id, email, meta] of [
      [U.patientA, "conc-patient-a@qa.test", { name: "Ada Patient", role: "consumer" }],
      [U.patientB, "conc-patient-b@qa.test", { name: "Bola Patient", role: "consumer" }],
      [U.provider, "conc-provider@qa.test", { name: "Dr Chidi", role: "provider" }],
      [U.providerOther, "conc-provider-b@qa.test", { name: "Dr Dara", role: "provider" }],
    ]) {
      await admin.client.query(
        "insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3::jsonb)",
        [id, email, JSON.stringify(meta)],
      );
    }
    for (const [id, email, name] of [
      [U.provider, "conc-provider@qa.test", "Dr Chidi"],
      [U.providerOther, "conc-provider-b@qa.test", "Dr Dara"],
    ]) {
      await admin.client.query(
        `insert into public.provider_applications
           (user_id,email,full_name,status,submitted_at,category,speciality,state,city,facility)
         values ($1,$2,$3,'verified',now(),'doctor','General practice','Lagos','Ikeja','Care Clinic')`,
        [id, email, name],
      );
    }

    const c1 = await connect(Client, connectionString, "c1");
    const c2 = await connect(Client, connectionString, "c2");
    check("the two sessions are independent backends", c1.pid !== c2.pid, `${c1.pid} vs ${c2.pid}`);

    // 1. Overlapping writes: the loser must wait for the winner, then fail.
    await c1.client.query("begin");
    const t1Insert = await c1.client.query(INSERT, [
      U.patientA,
      U.provider,
      BASE,
      30,
      "Winner",
    ]);
    const winnerId = t1Insert.rows[0].id;

    const overlapAttempt = (async () => {
      await c2.client.query("begin");
      return c2.client.query(INSERT, [U.patientB, U.provider, at(15), 30, "Loser"]);
    })();
    const firstObservation = await settleWithin(overlapAttempt, 600);
    check(
      "a simultaneous overlapping insert blocks on the uncommitted claim",
      firstObservation.pending === true,
      firstObservation.error ? `settled early with ${firstObservation.error.message}` : "settled early",
    );

    await c1.client.query("commit");
    const loser = await overlapAttempt.then(
      (value) => ({ ok: true, value }),
      (error) => ({ ok: false, error }),
    );
    check(
      "the blocked request fails once the winner commits",
      !loser.ok && /time no longer available|duplicate key/i.test(loser.error.message),
      loser.ok ? "the second insert unexpectedly succeeded" : loser.error.code,
    );
    await c2.client.query("rollback");

    const holder = await admin.client.query(
      `select count(*)::int as n from public.consultations
        where provider_id = $1 and status in ('requested','accepted','in_progress')`,
      [U.provider],
    );
    check("exactly one of the conflicting bookings exists", holder.rows[0].n === 1, String(holder.rows[0].n));

    const claims = await admin.client.query(
      "select slot from public.consultation_slot_claims where consultation_id = $1 order by slot",
      [winnerId],
    );
    const slots = claims.rows.map((row) => new Date(row.slot).getTime());
    check(
      "the winner owns the two 15-minute slots its 30-minute booking covers",
      slots.length === 2 &&
        slots[0] === new Date(BASE).getTime() &&
        slots[1] === new Date(at(15)).getTime(),
      slots.map((time) => new Date(time).toISOString()).join(","),
    );

    // 2. Adjacent bookings both succeed.
    const adjacent = await admin.client.query(INSERT, [
      U.patientB,
      U.provider,
      at(30),
      15,
      "Adjacent",
    ]);
    check("an adjacent booking succeeds", Boolean(adjacent.rows[0]?.id));

    // 3. Different providers may hold the same wall-clock slot.
    const otherProvider = await admin.client.query(INSERT, [
      U.patientB,
      U.providerOther,
      BASE,
      30,
      "Other provider",
    ]);
    check("a different provider accepts the same time", Boolean(otherProvider.rows[0]?.id));

    // 4. Cancellation releases claims.
    await admin.client.query("update public.consultations set status='cancelled' where id=$1", [
      winnerId,
    ]);
    const cancelledClaims = await admin.client.query(
      "select count(*)::int as n from public.consultation_slot_claims where consultation_id = $1",
      [winnerId],
    );
    check("cancellation releases the slot claims", cancelledClaims.rows[0].n === 0, String(cancelledClaims.rows[0].n));
    const reuseAfterCancel = await admin.client.query(INSERT, [
      U.patientA,
      U.provider,
      at(15),
      15,
      "Reused after cancel",
    ]);
    check("a cancelled slot can be booked again", Boolean(reuseAfterCancel.rows[0]?.id));

    // 5. Completion releases claims too.
    const toComplete = await admin.client.query(INSERT, [
      U.patientA,
      U.providerOther,
      at(60),
      30,
      "Completed booking",
    ]);
    const completedId = toComplete.rows[0].id;
    for (const status of ["accepted", "in_progress", "completed"]) {
      await admin.client.query("update public.consultations set status=$2 where id=$1", [
        completedId,
        status,
      ]);
    }
    const completedClaims = await admin.client.query(
      "select count(*)::int as n from public.consultation_slot_claims where consultation_id = $1",
      [completedId],
    );
    check("completion releases the slot claims", completedClaims.rows[0].n === 0, String(completedClaims.rows[0].n));
    const reuseAfterComplete = await admin.client.query(INSERT, [
      U.patientB,
      U.providerOther,
      at(60),
      15,
      "Reused after completion",
    ]);
    check("a completed slot can be booked again", Boolean(reuseAfterComplete.rows[0]?.id));

    await c1.client.end();
    await c2.client.end();
  } finally {
    await admin.client.end().catch(() => {});
  }

  const passed = checks.filter((entry) => entry.ok).length;
  console.log(`\nBOOKING CONCURRENCY RESULT: ${passed}/${checks.length} checks passed`);
  if (passed !== checks.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error("HARNESS ERROR:", error.message);
  process.exitCode = 1;
});
