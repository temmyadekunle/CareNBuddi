/**
 * Telemedicine consultations (0011, hardened by 0013, 0014 and 0015),
 * executed against real PostgreSQL with
 * check_function_bodies = on, as anon / authenticated / service_role — never
 * as the database owner.
 *
 * What is verified here:
 *   1. the full migration sequence 0001..0015 applies strictly;
 *   2. only verified providers appear in the directory and can receive a
 *      consultation request; pending/unverified providers cannot;
 *   3. a patient must be a consumer, must consent, and cannot book a slot the
 *      provider already has an active consultation in;
 *   4. only the assigned provider can accept/decline/start/complete; only
 *      participants can cancel; invalid lifecycle jumps are refused;
 *   5. join context returns only to the assigned patient/provider, only in
 *      the time window, and administrators cannot join at all;
 *   6. row level security isolates consultations and events from other users;
 *      clients have no write access to either table;
 *   7. expired sessions are moved by a caller-scoped RPC and logged as
 *      'system'; the service-role job expires every account's stale rows;
 *   8. overlapping bookings are refused by interval, not only by exact start;
 *   9. the Worker audit hook records a 'joined' event;
 *  10. completion is provider-only, role-checked, audited once and replay-safe;
 *  11. suspension after booking blocks join authorization for BOTH participants;
 *  12. room closure is a separate, provider-confirmed fact with an append-only
 *      media trail, an idempotent service-role queue and reconciliation;
 *  13. the (provider_id, slot) primary key blocks overlapping bookings at the
 *      database level, and terminal states release their claims.
 *
 * PGlite runs a single connection. The concurrency section proves the
 * constraint, the slot arithmetic and the release rules; it cannot interleave
 * two real transactions. The guarantee itself comes from the unique primary
 * key, which serialises concurrent inserts regardless of isolation level.
 *
 * No seed rows are inserted by the migration; fixtures live here only.
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
  "0010_community.sql",
  "0011_consultations.sql",
  "0012_integrity_hardening.sql",
  "0013_consultation_lifecycle.sql",
  "0014_consultation_authorization.sql",
  "0015_room_lifecycle.sql",
];

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
    return { ok: false, error: e.message.replace(/\s+/g, " ").trim().slice(0, 200), rowCount: 0 };
  } finally {
    await db.exec("reset role;");
    await db.exec("set request.jwt.claims = '';");
  }
};

function slot(daysAhead, hourUtc) {
  const d = new Date(Date.now() + daysAhead * 86400000);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d.toISOString();
}

// Fixtures are placed on the 15-minute booking grid the way the request RPC
// would place them; the guard rejects off-grid active rows by design.
function gridFloor(value) {
  const d = new Date(value);
  d.setUTCMinutes(Math.floor(d.getUTCMinutes() / 15) * 15, 0, 0);
  return d.toISOString();
}

(async () => {
  const checks = [];
  const check = (name, ok, detail) => {
    checks.push({ name, ok, detail: detail || "" });
    console.log(`  ${ok ? "OK  " : "FAIL"}  ${name}${detail && !ok ? `  -- ${detail}` : ""}`);
  };
  const section = (s) => console.log(`\n-- ${s} --`);

  const db = await PGlite.create();
  await db.exec(AUTH_STUB);
  await db.exec(SUPABASE_DEFAULTS);
  await db.exec(STORAGE_STUB);

  console.log("=".repeat(78));
  console.log("CONSULTATIONS: full sequence 0001..0015, strict");
  console.log("=".repeat(78));
  for (const f of MIGRATIONS) {
    const r = (await applyMigrations(db, [f]))[0];
    console.log(`  ${r.ok ? "APPLIED" : "FAILED "}  ${f}`);
    if (!r.ok) {
      console.log(`  FIRST FAILURE: ${r.error}`);
      await db.close();
      process.exitCode = 1;
      return;
    }
  }

  const U = {
    patientA: "10000000-0000-4000-8000-000000000a01",
    patientB: "10000000-0000-4000-8000-000000000b01",
    provider: "10000000-0000-4000-8000-000000000c01",
    providerOther: "10000000-0000-4000-8000-000000000c02",
    providerPending: "10000000-0000-4000-8000-000000000d01",
    admin: "10000000-0000-4000-8000-000000000e01",
  };
  for (const [key, email, meta] of [
    ["patientA", "cpatientA@qa.test", { name: "Ada Patient", role: "consumer" }],
    ["patientB", "cpatientB@qa.test", { name: "Bola Patient", role: "consumer" }],
    ["provider", "cprovider@qa.test", { name: "Dr Chidi", role: "provider" }],
    ["providerOther", "cother@qa.test", { name: "Dr Dara", role: "provider" }],
    ["providerPending", "cpending@qa.test", { name: "Dr Eze", role: "provider" }],
    ["admin", "cadmin@qa.test", { name: "Administrator", role: "consumer" }],
  ]) {
    await db.query("insert into auth.users (id,email,raw_user_meta_data) values ($1,$2,$3::jsonb)", [
      U[key],
      email,
      JSON.stringify(meta),
    ]);
  }

  await db.exec("set role service_role;");
  await db.exec(`set request.jwt.claims = '{"role":"service_role"}';`);
  await db.query("select public.grant_role($1, 'admin')", [U.admin]);
  for (const [id, email, name, status] of [
    [U.provider, "cprovider@qa.test", "Dr Chidi", "verified"],
    [U.providerOther, "cother@qa.test", "Dr Dara", "verified"],
    [U.providerPending, "cpending@qa.test", "Dr Eze", "submitted"],
  ]) {
    await db.query(
      `insert into public.provider_applications
         (user_id,email,full_name,status,submitted_at,category,speciality,state,city,facility)
       values ($1,$2,$3,$4,now(),'doctor','General practice','Lagos','Ikeja','Care Clinic')`,
      [id, email, name, status],
    );
  }
  await db.exec("reset request.jwt.claims;");
  await db.exec("reset role;");

  const rpc = (role, sub, name, args) =>
    as(db, role, sub, () =>
      db.query(`select * from public.${name}(${args.map((_, i) => `$${i + 1}`).join(",")})`, args),
    );

  const seedConsultation = async ({ patient, provider, scheduled, status = "requested", duration = 30, reason = "Persistent headache" }) => {
    await db.exec("set role service_role;");
    await db.exec(`set request.jwt.claims = '{"role":"service_role"}';`);
    const inserted = await db.query(
      `insert into public.consultations
         (patient_id,provider_id,scheduled_for,duration_minutes,status,reason,patient_consent)
       values ($1,$2,$3,$4,'requested',$5,true)
       returning id,room_name`,
      [patient, provider, gridFloor(scheduled), duration, reason],
    );
    const row = inserted.rows[0];
    if (status !== "requested") {
      await db.query("update public.consultations set status=$2 where id=$1", [row.id, status]);
    }
    await db.exec("reset request.jwt.claims;");
    await db.exec("reset role;");
    return row;
  };

  const readStatus = (role, sub, id) =>
    as(db, role, sub, () => db.query("select status,completion_note,decline_reason from public.consultations where id=$1", [id]));
  const events = (role, sub, id) =>
    as(db, role, sub, () =>
      db.query("select event,actor_role from public.consultation_events where consultation_id=$1 order by id", [id]),
    );

  const setProviderStatus = async (userId, status) => {
    await db.exec("set role service_role;");
    await db.exec(`set request.jwt.claims = '{"role":"service_role"}';`);
    try {
      await db.query("update public.provider_applications set status=$2 where user_id=$1", [
        userId,
        status,
      ]);
    } finally {
      await db.exec("reset request.jwt.claims;");
      await db.exec("reset role;");
    }
  };

  const directSchedule = (patient, provider, scheduled, duration, reason) =>
    as(db, "service_role", null, () =>
      db.query(
        `insert into public.consultations
           (patient_id,provider_id,scheduled_for,duration_minutes,reason,patient_consent)
         values ($1,$2,$3,$4,$5,true)
         returning id`,
        [patient, provider, scheduled, duration, reason],
      ),
    );

  const roomState = (id) =>
    as(db, "service_role", null, () =>
      db.query(
        `select room_opened_at, room_provider, room_closed_at, room_closure_state,
                room_closure_reason, room_closure_attempts, room_closure_last_error
           from public.consultations where id=$1`,
        [id],
      ),
    );
  const mediaEvents = (id) =>
    as(db, "service_role", null, () =>
      db.query(
        "select event,provider,actor_role from public.consultation_media_events where consultation_id=$1 order by id",
        [id],
      ),
    );
  const slotClaims = (id) =>
    as(db, "service_role", null, () =>
      db.query(
        "select slot from public.consultation_slot_claims where consultation_id=$1 order by slot",
        [id],
      ),
    );

  section("1. verified provider directory");
  const dir = await rpc("authenticated", U.patientA, "list_verified_providers", ["", ""]);
  check("patient reads verified providers", dir.ok && dir.rows.length === 2, dir.error);
  check(
    "directory excludes the pending provider",
    dir.ok && !dir.rows.some((r) => r.full_name === "Dr Eze"),
    JSON.stringify(dir.rows),
  );
  check(
    "directory exposes no contact columns",
    dir.ok && !("email" in (dir.rows[0] ?? {})) && !("phone" in (dir.rows[0] ?? {})),
    JSON.stringify(dir.rows[0]),
  );
  const dirAnon = await rpc("anon", null, "list_verified_providers", ["", ""]);
  check("anon cannot read the directory", !dirAnon.ok, dirAnon.error);

  section("2. requesting a consultation");
  const slotA = slot(2, 10);
  const request = await rpc("authenticated", U.patientA, "request_consultation", [
    U.provider,
    slotA,
    30,
    "Recurring headaches for a week",
    true,
  ]);
  check("consumer requests a consultation", request.ok, request.error);
  const consultId = request.rows?.[0]?.request_consultation;

  const rowA = await readStatus("authenticated", U.patientA, consultId);
  check("new consultation is requested", rowA.rows?.[0]?.status === "requested", JSON.stringify(rowA.rows));
  const eventsA = await events("authenticated", U.patientA, consultId);
  check(
    "requested event is recorded",
    eventsA.ok && eventsA.rows.length === 1 && eventsA.rows[0].event === "requested",
    JSON.stringify(eventsA.rows),
  );

  const noConsent = await rpc("authenticated", U.patientB, "request_consultation", [
    U.provider,
    slot(2, 11),
    30,
    "Second opinion",
    false,
  ]);
  check("request without consent is refused", !noConsent.ok && /consent required/i.test(noConsent.error), noConsent.error);

  const pending = await rpc("authenticated", U.patientB, "request_consultation", [
    U.providerPending,
    slot(2, 11),
    30,
    "Second opinion",
    true,
  ]);
  check("unverified provider cannot be booked", !pending.ok && /not verified/i.test(pending.error), pending.error);

  const self = await rpc("authenticated", U.provider, "request_consultation", [
    U.providerOther,
    slot(2, 11),
    30,
    "I need care too",
    true,
  ]);
  check("provider account cannot act as a patient", !self.ok && /patient account required/i.test(self.error), self.error);

  const badDuration = await rpc("authenticated", U.patientB, "request_consultation", [
    U.provider,
    slot(2, 11),
    20,
    "Second opinion",
    true,
  ]);
  check("unsupported duration is refused", !badDuration.ok && /unsupported duration/i.test(badDuration.error), badDuration.error);

  const past = await rpc("authenticated", U.patientB, "request_consultation", [
    U.provider,
    new Date(Date.now() - 3600000).toISOString(),
    30,
    "Second opinion",
    true,
  ]);
  check("past slot is refused", !past.ok && /invalid schedule/i.test(past.error), past.error);

  const conflict = await rpc("authenticated", U.patientB, "request_consultation", [
    U.provider,
    slotA,
    30,
    "Same time as Ada",
    true,
  ]);
  check("double booking is refused", !conflict.ok && /time no longer available/i.test(conflict.error), conflict.error);

  const overlapBase = slot(5, 9);
  const overlapBooked = await rpc("authenticated", U.patientA, "request_consultation", [
    U.provider,
    overlapBase,
    45,
    "Longer session",
    true,
  ]);
  check("a 45-minute booking is accepted", overlapBooked.ok, overlapBooked.error);

  const overlapping = await rpc("authenticated", U.patientB, "request_consultation", [
    U.provider,
    new Date(new Date(overlapBase).getTime() + 30 * 60000).toISOString(),
    15,
    "Overlapping session",
    true,
  ]);
  check(
    "a booking inside an existing session is refused",
    !overlapping.ok && /time no longer available/i.test(overlapping.error),
    overlapping.error,
  );

  const picker = await rpc("authenticated", U.patientB, "provider_open_slots", [
    U.provider,
    slot(5, 8),
    6,
  ]);
  const pickerSlots = (picker.rows ?? []).map((r) => new Date(r.slot).toISOString());
  check(
    "the picker does not offer a start inside an existing session",
    picker.ok &&
      !pickerSlots.includes(overlapBase) &&
      !pickerSlots.includes(new Date(new Date(overlapBase).getTime() + 30 * 60000).toISOString()),
    picker.error,
  );

  const adjacent = await rpc("authenticated", U.patientB, "request_consultation", [
    U.provider,
    new Date(new Date(overlapBase).getTime() + 45 * 60000).toISOString(),
    45,
    "Back-to-back session",
    true,
  ]);
  check("a start exactly when the previous session ends is allowed", adjacent.ok, adjacent.error);

  const adminRequest = await rpc("authenticated", U.admin, "request_consultation", [
    U.provider,
    slot(2, 12),
    30,
    "Admin trying to book",
    true,
  ]);
  check("administrator cannot request as a patient", !adminRequest.ok && /patient account required/i.test(adminRequest.error), adminRequest.error);

  section("3. provider response and assignment");
  const wrongRespond = await rpc("authenticated", U.providerOther, "respond_consultation", [consultId, true, ""]);
  check("unassigned provider cannot respond", !wrongRespond.ok && /not your consultation/i.test(wrongRespond.error), wrongRespond.error);

  const patientRespond = await rpc("authenticated", U.patientA, "respond_consultation", [consultId, true, ""]);
  check("patient cannot accept on the provider's behalf", !patientRespond.ok && /not your consultation/i.test(patientRespond.error), patientRespond.error);

  const accept = await rpc("authenticated", U.provider, "respond_consultation", [consultId, true, ""]);
  check("assigned provider accepts", accept.ok, accept.error);
  check("status is accepted", (await readStatus("authenticated", U.provider, consultId)).rows?.[0]?.status === "accepted");

  const respondAgain = await rpc("authenticated", U.provider, "respond_consultation", [consultId, false, ""]);
  check("accepted request cannot be answered twice", !respondAgain.ok && /already handled/i.test(respondAgain.error), respondAgain.error);

  const declinedId = (
    await rpc("authenticated", U.patientB, "request_consultation", [
      U.provider,
      slot(2, 12),
      30,
      "Second opinion",
      true,
    ])
  ).rows?.[0]?.request_consultation;
  const decline = await rpc("authenticated", U.provider, "respond_consultation", [declinedId, false, "Not my speciality"]);
  check("provider declines", decline.ok, decline.error);
  const declinedRow = await readStatus("authenticated", U.patientB, declinedId);
  check(
    "decline reason is stored",
    declinedRow.rows?.[0]?.status === "declined" && declinedRow.rows?.[0]?.decline_reason === "Not my speciality",
    JSON.stringify(declinedRow.rows),
  );

  section("4. row level security and direct writes");
  const ownRows = await as(db, "authenticated", U.patientA, () =>
    db.query("select id from public.consultations where id=$1", [consultId]),
  );
  check("patient reads own consultation", ownRows.ok && ownRows.rows.length === 1, ownRows.error);
  const otherRows = await as(db, "authenticated", U.patientB, () =>
    db.query("select id from public.consultations where id=$1", [consultId]),
  );
  check("other patient cannot read it", otherRows.ok && otherRows.rows.length === 0, otherRows.error);
  const unassignedRows = await as(db, "authenticated", U.providerOther, () =>
    db.query("select id from public.consultations where id=$1", [consultId]),
  );
  check("unassigned provider cannot read it", unassignedRows.ok && unassignedRows.rows.length === 0, unassignedRows.error);
  const adminRows = await as(db, "authenticated", U.admin, () =>
    db.query("select id from public.consultations where id=$1", [consultId]),
  );
  check("administrator reads for oversight", adminRows.ok && adminRows.rows.length === 1, adminRows.error);

  const directUpdate = await as(db, "authenticated", U.patientA, () =>
    db.query("update public.consultations set status='completed' where id=$1", [consultId]),
  );
  check("client cannot update a consultation", !directUpdate.ok, directUpdate.error);
  const directInsert = await as(db, "authenticated", U.patientA, () =>
    db.query(
      `insert into public.consultations
         (patient_id,provider_id,scheduled_for,duration_minutes,reason,patient_consent)
       values ($1,$2,$3,30,'x',true)`,
      [U.patientA, U.provider, slot(3, 10)],
    ),
  );
  check("client cannot insert a consultation", !directInsert.ok, directInsert.error);
  const directEvent = await as(db, "authenticated", U.patientA, () =>
    db.query("insert into public.consultation_events (consultation_id,actor_id,actor_role,event) values ($1,$2,'patient','completed')", [
      consultId,
      U.patientA,
    ]),
  );
  check("client cannot write the audit trail", !directEvent.ok, directEvent.error);

  section("5. cancellation rules");
  const cancelByOther = await rpc("authenticated", U.patientB, "cancel_consultation", [consultId, "nope"]);
  check("unrelated user cannot cancel", !cancelByOther.ok && /not a participant/i.test(cancelByOther.error), cancelByOther.error);

  const cancelAccepted = await rpc("authenticated", U.patientA, "cancel_consultation", [consultId, "Feeling better"]);
  check("patient cancels an accepted consultation", cancelAccepted.ok, cancelAccepted.error);
  check(
    "status is cancelled",
    (await readStatus("authenticated", U.patientA, consultId)).rows?.[0]?.status === "cancelled",
  );
  const startCancelled = await rpc("authenticated", U.provider, "start_consultation", [consultId]);
  check("cancelled consultation cannot start", !startCancelled.ok && /not ready to start/i.test(startCancelled.error), startCancelled.error);

  section("6. start, join context and completion");
  const live = await seedConsultation({
    patient: U.patientA,
    provider: U.provider,
    scheduled: new Date(Date.now() - 5 * 60000).toISOString(),
    status: "accepted",
    reason: "Follow-up",
  });
  const patientStart = await rpc("authenticated", U.patientA, "start_consultation", [live.id]);
  check("patient cannot start the session", !patientStart.ok && /not your consultation/i.test(patientStart.error), patientStart.error);

  const start = await rpc("authenticated", U.provider, "start_consultation", [live.id]);
  check("assigned provider starts the session", start.ok, start.error);
  check(
    "status is in_progress",
    (await readStatus("authenticated", U.provider, live.id)).rows?.[0]?.status === "in_progress",
  );

  const joinPatient = await rpc("authenticated", U.patientA, "consultation_join_context", [live.id]);
  check("patient gets join context", joinPatient.ok, joinPatient.error);
  const joinContext = joinPatient.rows?.[0]?.consultation_join_context;
  check(
    "join context has a private room and patient role",
    joinContext?.role === "patient" && /^cnb-[a-f0-9]{32}$/.test(joinContext?.room_name ?? ""),
    JSON.stringify(joinContext),
  );
  check(
    "join context exposes the provider name but not account identifiers",
    joinContext?.provider_name === "Dr Chidi" && !("provider_id" in (joinContext ?? {})),
    JSON.stringify(joinContext),
  );

  const joinProvider = await rpc("authenticated", U.provider, "consultation_join_context", [live.id]);
  check(
    "provider gets the patient briefing",
    joinProvider.ok &&
      joinProvider.rows?.[0]?.consultation_join_context?.role === "provider" &&
      joinProvider.rows?.[0]?.consultation_join_context?.patient_name === "Ada Patient",
    joinProvider.error,
  );

  const joinOther = await rpc("authenticated", U.patientB, "consultation_join_context", [live.id]);
  check("another patient cannot join", !joinOther.ok && /not a participant/i.test(joinOther.error), joinOther.error);
  const joinOtherProvider = await rpc("authenticated", U.providerOther, "consultation_join_context", [live.id]);
  check("unassigned provider cannot join", !joinOtherProvider.ok && /not a participant/i.test(joinOtherProvider.error), joinOtherProvider.error);
  const joinAdmin = await rpc("authenticated", U.admin, "consultation_join_context", [live.id]);
  check("administrator cannot join a session", !joinAdmin.ok && /not a participant/i.test(joinAdmin.error), joinAdmin.error);

  const logJoin = await rpc("authenticated", U.patientA, "log_consultation_join", [live.id]);
  check("join event is recorded", logJoin.ok, logJoin.error);
  const liveEvents = await events("authenticated", U.provider, live.id);
  check(
    "audit contains started and joined",
    liveEvents.ok &&
      liveEvents.rows.some((r) => r.event === "started") &&
      liveEvents.rows.some((r) => r.event === "joined"),
    JSON.stringify(liveEvents.rows),
  );

  const completeByPatient = await rpc("authenticated", U.patientA, "complete_consultation", [live.id, "note"]);
  check("patient cannot complete", !completeByPatient.ok && /not your consultation/i.test(completeByPatient.error), completeByPatient.error);
  const complete = await rpc("authenticated", U.provider, "complete_consultation", [live.id, "Advised hydration and review in 2 weeks."]);
  check("provider completes the session", complete.ok, complete.error);
  const completedRow = await readStatus("authenticated", U.patientA, live.id);
  check(
    "completion note is stored",
    completedRow.rows?.[0]?.status === "completed" &&
      /hydration/.test(completedRow.rows?.[0]?.completion_note ?? ""),
    JSON.stringify(completedRow.rows),
  );
  const joinCompleted = await rpc("authenticated", U.patientA, "consultation_join_context", [live.id]);
  check("completed session cannot be joined", !joinCompleted.ok && /not active/i.test(joinCompleted.error), joinCompleted.error);

  section("7. expiry");
  const stale = await seedConsultation({
    patient: U.patientB,
    provider: U.provider,
    scheduled: new Date(Date.now() - 3 * 3600000).toISOString(),
    status: "accepted",
    reason: "Missed session",
  });
  const expired = await rpc("authenticated", U.patientB, "expire_my_consultations", []);
  check("caller's stale session expires", expired.ok && expired.rows?.[0]?.expire_my_consultations >= 1, expired.error);
  check(
    "stale session is expired",
    (await readStatus("authenticated", U.patientB, stale.id)).rows?.[0]?.status === "expired",
  );
  const expiredEvents = await events("authenticated", U.patientB, stale.id);
  check(
    "expiry is logged as system",
    expiredEvents.ok && expiredEvents.rows.some((r) => r.event === "expired" && r.actor_role === "system"),
    JSON.stringify(expiredEvents.rows),
  );
  const staleJoin = await rpc("authenticated", U.patientB, "consultation_join_context", [stale.id]);
  check("expired session cannot be joined", !staleJoin.ok && /not active/i.test(staleJoin.error), staleJoin.error);

  section("8. system-wide expiry");
  const crossStale = await seedConsultation({
    patient: U.patientA,
    provider: U.providerOther,
    scheduled: new Date(Date.now() - 4 * 3600000).toISOString(),
    status: "accepted",
    reason: "Other pair missed session",
  });
  check(
    "a caller-scoped expiry leaves another account's stale row alone",
    (await readStatus("authenticated", U.patientA, crossStale.id)).rows?.[0]?.status === "accepted",
  );

  const future = await rpc("authenticated", U.patientB, "request_consultation", [
    U.providerOther,
    slot(6, 11),
    30,
    "Upcoming session",
    true,
  ]);
  check("a future consultation exists", future.ok, future.error);
  const futureId = future.rows?.[0]?.request_consultation;

  const anonExpire = await rpc("anon", null, "expire_stale_consultations", []);
  check(
    "anon cannot run the system expiry",
    !anonExpire.ok && /permission denied/i.test(anonExpire.error),
    anonExpire.error,
  );
  const userExpire = await rpc("authenticated", U.admin, "expire_stale_consultations", []);
  check(
    "a signed-in user cannot run the system expiry",
    !userExpire.ok && /permission denied/i.test(userExpire.error),
    userExpire.error,
  );

  const systemExpire = await rpc("service_role", null, "expire_stale_consultations", []);
  check("the service role runs the system expiry", systemExpire.ok, systemExpire.error);
  check(
    "it expires another account's stale row",
    systemExpire.ok && systemExpire.rows?.[0]?.expire_stale_consultations >= 1,
    JSON.stringify(systemExpire.rows),
  );
  check(
    "the cross-account stale row is expired",
    (await readStatus("authenticated", U.patientA, crossStale.id)).rows?.[0]?.status === "expired",
  );
  check(
    "a future consultation is untouched",
    future.ok &&
      (await readStatus("authenticated", U.patientB, futureId)).rows?.[0]?.status === "requested",
  );
  const systemEvents = await events("authenticated", U.patientA, crossStale.id);
  check(
    "system expiry is logged as system",
    systemEvents.ok &&
      systemEvents.rows.some((r) => r.event === "expired" && r.actor_role === "system"),
    JSON.stringify(systemEvents.rows),
  );
  const rerun = await rpc("service_role", null, "expire_stale_consultations", []);
  check(
    "the system expiry is idempotent",
    rerun.ok && rerun.rows?.[0]?.expire_stale_consultations === 0,
    JSON.stringify(rerun.rows),
  );

  section("9. server-derived open slots");
  const openSlots = await rpc("authenticated", U.patientA, "provider_open_slots", [U.provider, null, 5]);
  check("open slots are returned", openSlots.ok && openSlots.rows.length > 0, openSlots.error);
  const allSlots = openSlots.ok ? openSlots.rows.map((r) => r.slot) : [];
  check(
    "grid steps are 15 minutes",
    allSlots.length > 1 && (new Date(allSlots[1]) - new Date(allSlots[0])) % 900000 === 0,
  );
  const booked = await rpc("authenticated", U.patientA, "request_consultation", [
    U.provider,
    slot(3, 10),
    30,
    "Slot test",
    true,
  ]);
  check("book a slot for exclusion", booked.ok, booked.error);
  const afterBooking = await rpc("authenticated", U.patientA, "provider_open_slots", [U.provider, null, 5]);
  const bookedSlot = slot(3, 10);
  check(
    "booked slot is no longer offered",
    afterBooking.ok && !afterBooking.rows.some((r) => new Date(r.slot).toISOString() === bookedSlot),
    JSON.stringify(afterBooking.rows?.slice(0, 3)),
  );

  section("10. authentication boundary");
  const anonRequest = await rpc("anon", null, "request_consultation", [
    U.provider,
    slot(4, 10),
    30,
    "Anonymous",
    true,
  ]);
  check("anon cannot request", !anonRequest.ok, anonRequest.error);
  const anonJoin = await rpc("anon", null, "consultation_join_context", [live.id]);
  check("anon cannot read join context", !anonJoin.ok, anonJoin.error);

  section("11. completion authorization and idempotency");
  const completionRow = await seedConsultation({
    patient: U.patientA,
    provider: U.provider,
    scheduled: new Date(Date.now() - 4 * 60000).toISOString(),
    status: "accepted",
    reason: "Completion authorization",
  });
  const startCompletion = await rpc("authenticated", U.provider, "start_consultation", [completionRow.id]);
  check("the session starts for the completion checks", startCompletion.ok, startCompletion.error);

  const anonComplete = await rpc("anon", null, "complete_consultation", [completionRow.id, ""]);
  check("anon cannot complete", !anonComplete.ok, anonComplete.error);
  const adminComplete = await rpc("authenticated", U.admin, "complete_consultation", [completionRow.id, ""]);
  check(
    "administrator cannot complete as a participant",
    !adminComplete.ok && /not your consultation/i.test(adminComplete.error),
    adminComplete.error,
  );
  const otherProviderComplete = await rpc("authenticated", U.providerOther, "complete_consultation", [completionRow.id, ""]);
  check(
    "an unassigned provider cannot complete",
    !otherProviderComplete.ok && /not your consultation/i.test(otherProviderComplete.error),
    otherProviderComplete.error,
  );

  await as(db, "service_role", null, () =>
    db.query("update public.profiles set role='consumer' where id=$1", [U.provider]),
  );
  const demotedComplete = await rpc("authenticated", U.provider, "complete_consultation", [completionRow.id, ""]);
  check(
    "a caller without a provider profile cannot complete",
    !demotedComplete.ok && /provider account required/i.test(demotedComplete.error),
    demotedComplete.error,
  );
  await as(db, "service_role", null, () =>
    db.query("update public.profiles set role='provider' where id=$1", [U.provider]),
  );

  const completed = await rpc("authenticated", U.provider, "complete_consultation", [completionRow.id, "Plan recorded."]);
  check("the assigned provider completes the session", completed.ok, completed.error);
  const completionState = await as(db, "authenticated", U.patientA, () =>
    db.query("select status,ended_at,completion_note from public.consultations where id=$1", [completionRow.id]),
  );
  check(
    "completion stores the note and the end time",
    completionState.rows?.[0]?.status === "completed" &&
      completionState.rows?.[0]?.ended_at != null &&
      completionState.rows?.[0]?.completion_note === "Plan recorded.",
    JSON.stringify(completionState.rows),
  );
  const endedAt = completionState.rows?.[0]?.ended_at;
  const completedEvents = await as(db, "authenticated", U.patientA, () =>
    db.query(
      "select actor_role,event from public.consultation_events where consultation_id=$1 and event='completed'",
      [completionRow.id],
    ),
  );
  check(
    "completion is audited once with the provider role",
    completedEvents.ok && completedEvents.rows.length === 1 && completedEvents.rows[0].actor_role === "provider",
    JSON.stringify(completedEvents.rows),
  );

  const replay = await rpc("authenticated", U.provider, "complete_consultation", [completionRow.id, "A different note"]);
  check("a repeated completion is a safe no-op", replay.ok, replay.error);
  const replayState = await as(db, "authenticated", U.patientA, () =>
    db.query("select ended_at,completion_note from public.consultations where id=$1", [completionRow.id]),
  );
  check(
    "replay does not overwrite the note",
    replayState.rows?.[0]?.completion_note === "Plan recorded.",
    JSON.stringify(replayState.rows),
  );
  check(
    "replay does not move ended_at",
    String(replayState.rows?.[0]?.ended_at) === String(endedAt),
    JSON.stringify(replayState.rows),
  );
  const replayEvents = await as(db, "authenticated", U.patientA, () =>
    db.query("select id from public.consultation_events where consultation_id=$1 and event='completed'", [
      completionRow.id,
    ]),
  );
  check("replay does not duplicate the audit event", replayEvents.rows?.length === 1, JSON.stringify(replayEvents.rows));

  const notStarted = await seedConsultation({
    patient: U.patientB,
    provider: U.provider,
    scheduled: new Date(Date.now() + 3600000).toISOString(),
    status: "accepted",
    reason: "Accepted but unstarted",
  });
  const earlyComplete = await rpc("authenticated", U.provider, "complete_consultation", [notStarted.id, ""]);
  check(
    "an accepted but unstarted session cannot complete",
    !earlyComplete.ok && /not in progress/i.test(earlyComplete.error),
    earlyComplete.error,
  );

  section("12. provider verification revocation at join");
  const revoked = await seedConsultation({
    patient: U.patientB,
    provider: U.providerOther,
    scheduled: new Date(Date.now() - 2 * 60000).toISOString(),
    status: "accepted",
    reason: "Suspension after booking",
  });
  const beforeSuspension = await rpc("authenticated", U.patientB, "consultation_join_context", [revoked.id]);
  check("the patient can join while the provider is verified", beforeSuspension.ok, beforeSuspension.error);

  await setProviderStatus(U.providerOther, "suspended");
  const patientAfterSuspension = await rpc("authenticated", U.patientB, "consultation_join_context", [revoked.id]);
  check(
    "the patient's join is refused after suspension",
    !patientAfterSuspension.ok && /not verified/i.test(patientAfterSuspension.error),
    patientAfterSuspension.error,
  );
  const providerAfterSuspension = await rpc("authenticated", U.providerOther, "consultation_join_context", [revoked.id]);
  check(
    "the suspended provider cannot join either",
    !providerAfterSuspension.ok && /not verified/i.test(providerAfterSuspension.error),
    providerAfterSuspension.error,
  );
  const logAfterSuspension = await rpc("authenticated", U.patientB, "log_consultation_join", [revoked.id]);
  check(
    "the join audit hook is refused after suspension",
    !logAfterSuspension.ok && /not verified/i.test(logAfterSuspension.error),
    logAfterSuspension.error,
  );
  const slotsAfterSuspension = await rpc("authenticated", U.patientA, "provider_open_slots", [U.providerOther, null, 3]);
  check(
    "a suspended provider is no longer offered",
    !slotsAfterSuspension.ok && /not verified/i.test(slotsAfterSuspension.error),
    slotsAfterSuspension.error,
  );

  await setProviderStatus(U.providerOther, "verified");
  const afterReinstate = await rpc("authenticated", U.patientB, "consultation_join_context", [revoked.id]);
  check("reinstating the provider restores join authorization", afterReinstate.ok, afterReinstate.error);

  section("13. room lifecycle and closure");
  const roomLive = await seedConsultation({
    patient: U.patientA,
    provider: U.provider,
    scheduled: new Date(Date.now() - 3 * 60000).toISOString(),
    status: "accepted",
    reason: "Room lifecycle",
  });
  await rpc("authenticated", U.provider, "start_consultation", [roomLive.id]);
  const opened = await rpc("service_role", null, "record_room_opened", [roomLive.id, "daily"]);
  check(
    "the service role records an opened room",
    opened.ok && opened.rows?.[0]?.record_room_opened === true,
    JSON.stringify(opened.rows ?? opened.error),
  );
  const openedAgain = await rpc("service_role", null, "record_room_opened", [roomLive.id, "daily"]);
  check(
    "recording the room again is idempotent",
    openedAgain.ok && openedAgain.rows?.[0]?.record_room_opened === false,
    JSON.stringify(openedAgain.rows ?? openedAgain.error),
  );
  const openedMedia = await mediaEvents(roomLive.id);
  check(
    "the room opening is appended once",
    openedMedia.ok &&
      openedMedia.rows.filter((r) => r.event === "room_opened").length === 1 &&
      openedMedia.rows[0].provider === "daily",
    JSON.stringify(openedMedia.rows),
  );
  const clientOpened = await rpc("authenticated", U.patientA, "record_room_opened", [roomLive.id, "daily"]);
  check("clients cannot record room lifecycle", !clientOpened.ok && /permission denied/i.test(clientOpened.error), clientOpened.error);
  const anonOpened = await rpc("anon", null, "record_room_opened", [roomLive.id, "daily"]);
  check("anon cannot record room lifecycle", !anonOpened.ok, anonOpened.error);

  const completeRoom = await rpc("authenticated", U.provider, "complete_consultation", [roomLive.id, "Room done"]);
  check("the room consultation completes", completeRoom.ok, completeRoom.error);
  const afterComplete = await roomState(roomLive.id);
  check(
    "completion queues closure but does not claim it",
    afterComplete.rows?.[0]?.room_closure_state === "pending" &&
      afterComplete.rows?.[0]?.room_closed_at == null &&
      afterComplete.rows?.[0]?.room_closure_reason === "consultation_completed",
    JSON.stringify(afterComplete.rows),
  );
  const releasedRoomClaims = await slotClaims(roomLive.id);
  check("a terminal state releases its slot claims", releasedRoomClaims.ok && releasedRoomClaims.rows.length === 0, JSON.stringify(releasedRoomClaims.rows));

  const patientClose = await rpc("authenticated", U.patientA, "request_room_closure", [roomLive.id, ""]);
  check("clients cannot request room closure", !patientClose.ok && /permission denied/i.test(patientClose.error), patientClose.error);
  const anonClose = await rpc("anon", null, "request_room_closure", [roomLive.id, ""]);
  check("anon cannot request room closure", !anonClose.ok, anonClose.error);

  const requestAgain = await rpc("service_role", null, "request_room_closure", [roomLive.id, "operator"]);
  check(
    "re-requesting a pending closure is idempotent",
    requestAgain.ok && requestAgain.rows?.[0]?.request_room_closure?.changed === false,
    JSON.stringify(requestAgain.rows ?? requestAgain.error),
  );

  const claimOnce = await rpc("service_role", null, "claim_room_closure_batch", [10]);
  const claimed = (claimOnce.rows ?? []).find((r) => r.consultation_id === roomLive.id);
  check("a pending room is claimed", claimOnce.ok && Boolean(claimed), JSON.stringify(claimOnce.rows ?? claimOnce.error));
  check("the claim increments attempts", claimed?.attempts === 1, JSON.stringify(claimed));
  const claimTwice = await rpc("service_role", null, "claim_room_closure_batch", [10]);
  check(
    "an immediate duplicate tick does not re-claim the room",
    claimTwice.ok && !(claimTwice.rows ?? []).some((r) => r.consultation_id === roomLive.id),
    JSON.stringify(claimTwice.rows),
  );

  const confirm = await rpc("service_role", null, "record_room_closure_result", [roomLive.id, true, "closed"]);
  check(
    "provider confirmation closes the room",
    confirm.ok && confirm.rows?.[0]?.record_room_closure_result === "closed",
    JSON.stringify(confirm.rows ?? confirm.error),
  );
  const confirmAgain = await rpc("service_role", null, "record_room_closure_result", [roomLive.id, true, "closed"]);
  check(
    "repeated confirmation is idempotent",
    confirmAgain.ok && confirmAgain.rows?.[0]?.record_room_closure_result === "closed",
    JSON.stringify(confirmAgain.rows ?? confirmAgain.error),
  );
  const closedState = await roomState(roomLive.id);
  check(
    "room_closed_at is only set by a confirmed result",
    closedState.rows?.[0]?.room_closed_at != null && closedState.rows?.[0]?.room_closure_state === "closed",
    JSON.stringify(closedState.rows),
  );
  const closedMedia = await mediaEvents(roomLive.id);
  check(
    "closure is appended once",
    closedMedia.ok && closedMedia.rows.filter((r) => r.event === "closure_confirmed").length === 1,
    JSON.stringify(closedMedia.rows),
  );

  const roomRetry = await seedConsultation({
    patient: U.patientB,
    provider: U.provider,
    scheduled: new Date(Date.now() - 60000).toISOString(),
    status: "accepted",
    reason: "Closure retry",
  });
  await rpc("authenticated", U.provider, "start_consultation", [roomRetry.id]);
  await rpc("service_role", null, "record_room_opened", [roomRetry.id, "daily"]);
  await rpc("authenticated", U.provider, "complete_consultation", [roomRetry.id, "Retry room"]);
  const claimRetry = await rpc("service_role", null, "claim_room_closure_batch", [10]);
  check(
    "the second room is claimed",
    claimRetry.ok && (claimRetry.rows ?? []).some((r) => r.consultation_id === roomRetry.id),
    JSON.stringify(claimRetry.rows ?? claimRetry.error),
  );
  const failClose = await rpc("service_role", null, "record_room_closure_result", [roomRetry.id, false, "provider_error"]);
  check(
    "a provider failure is recorded as failed",
    failClose.ok && failClose.rows?.[0]?.record_room_closure_result === "failed",
    JSON.stringify(failClose.rows ?? failClose.error),
  );
  const failedState = await roomState(roomRetry.id);
  check(
    "the failed attempt keeps the room unclosed",
    failedState.rows?.[0]?.room_closure_state === "failed" &&
      failedState.rows?.[0]?.room_closed_at == null &&
      failedState.rows?.[0]?.room_closure_last_error === "provider_error",
    JSON.stringify(failedState.rows),
  );
  const retryRequest = await rpc("service_role", null, "request_room_closure", [roomRetry.id, ""]);
  check(
    "a failed closure can be re-requested",
    retryRequest.ok && retryRequest.rows?.[0]?.request_room_closure?.changed === true,
    JSON.stringify(retryRequest.rows ?? retryRequest.error),
  );
  const claimRetryAgain = await rpc("service_role", null, "claim_room_closure_batch", [10]);
  const retried = (claimRetryAgain.rows ?? []).find((r) => r.consultation_id === roomRetry.id);
  check("the retried room is claimable immediately", Boolean(retried), JSON.stringify(claimRetryAgain.rows));
  const confirmRetry = await rpc("service_role", null, "record_room_closure_result", [roomRetry.id, true, "closed"]);
  check(
    "the retry confirms closure",
    confirmRetry.ok && confirmRetry.rows?.[0]?.record_room_closure_result === "closed",
    JSON.stringify(confirmRetry.rows ?? confirmRetry.error),
  );

  const neverOpened = await seedConsultation({
    patient: U.patientB,
    provider: U.provider,
    scheduled: new Date(Date.now() - 4 * 3600000).toISOString(),
    status: "accepted",
    reason: "Expired without a room",
  });
  const openedThenExpired = await seedConsultation({
    patient: U.patientA,
    provider: U.providerOther,
    scheduled: new Date(Date.now() - 5 * 3600000).toISOString(),
    status: "accepted",
    reason: "Expired with a room",
  });
  const legacyJoined = await seedConsultation({
    patient: U.patientA,
    provider: U.providerOther,
    scheduled: new Date(Date.now() - 6 * 3600000).toISOString(),
    status: "accepted",
    reason: "Legacy joined row",
  });
  const openExpiredRoom = await rpc("service_role", null, "record_room_opened", [openedThenExpired.id, "daily"]);
  check("the expired-room fixture records an opened room", openExpiredRoom.ok, openExpiredRoom.error);
  const expireRooms = await rpc("service_role", null, "expire_stale_consultations", []);
  check("the system expiry runs for the room fixtures", expireRooms.ok, expireRooms.error);

  const neverState = await roomState(neverOpened.id);
  check(
    "expiry without an opened room does not claim closure",
    neverState.rows?.[0]?.room_closure_state === "not_required" && neverState.rows?.[0]?.room_closed_at == null,
    JSON.stringify(neverState.rows),
  );
  const expiredRoomState = await roomState(openedThenExpired.id);
  check(
    "expiry queues an opened room but does not close it",
    expiredRoomState.rows?.[0]?.room_closure_state === "pending" &&
      expiredRoomState.rows?.[0]?.room_closed_at == null,
    JSON.stringify(expiredRoomState.rows),
  );

  const legacyBefore = await roomState(legacyJoined.id);
  check(
    "a legacy terminal row with no recorded room is not queued automatically",
    legacyBefore.rows?.[0]?.room_closure_state === "not_required",
    JSON.stringify(legacyBefore.rows),
  );
  const legacyJoinEvent = await as(db, "service_role", null, () =>
    db.query(
      "insert into public.consultation_events (consultation_id,actor_id,actor_role,event) values ($1,$2,'patient','joined')",
      [legacyJoined.id, U.patientA],
    ),
  );
  check("the legacy joined event is recorded", legacyJoinEvent.ok, legacyJoinEvent.error);
  const reconcile = await rpc("service_role", null, "reconcile_room_closures", []);
  check(
    "reconciliation flags a room that should have been queued",
    reconcile.ok && (reconcile.rows?.[0]?.reconcile_room_closures?.flagged ?? 0) >= 1,
    JSON.stringify(reconcile.rows ?? reconcile.error),
  );
  const legacyAfter = await roomState(legacyJoined.id);
  check(
    "the reconciled room becomes pending",
    legacyAfter.rows?.[0]?.room_closure_state === "pending" &&
      legacyAfter.rows?.[0]?.room_closed_at == null,
    JSON.stringify(legacyAfter.rows),
  );
  const legacyMediaAfter = await mediaEvents(legacyJoined.id);
  check(
    "reconciliation is appended to the media trail",
    legacyMediaAfter.ok && legacyMediaAfter.rows.some((r) => r.event === "reconciliation_flagged"),
    JSON.stringify(legacyMediaAfter.rows),
  );
  const reconcileAgain = await rpc("service_role", null, "reconcile_room_closures", []);
  check(
    "reconciliation is idempotent",
    reconcileAgain.ok && reconcileAgain.rows?.[0]?.reconcile_room_closures?.flagged === 0,
    JSON.stringify(reconcileAgain.rows ?? reconcileAgain.error),
  );

  const anonReconcile = await rpc("anon", null, "reconcile_room_closures", []);
  check("anon cannot reconcile closures", !anonReconcile.ok && /permission denied/i.test(anonReconcile.error), anonReconcile.error);
  const userReconcile = await rpc("authenticated", U.patientA, "reconcile_room_closures", []);
  check("a signed-in user cannot reconcile closures", !userReconcile.ok && /permission denied/i.test(userReconcile.error), userReconcile.error);
  const anonClaim = await rpc("anon", null, "claim_room_closure_batch", [10]);
  check("anon cannot claim closures", !anonClaim.ok && /permission denied/i.test(anonClaim.error), anonClaim.error);

  const otherMedia = await as(db, "authenticated", U.patientB, () =>
    db.query("select id from public.consultation_media_events where consultation_id=$1", [roomLive.id]),
  );
  check("another patient cannot read the media trail", otherMedia.ok && otherMedia.rows.length === 0, otherMedia.error);
  const adminMedia = await as(db, "authenticated", U.admin, () =>
    db.query("select id from public.consultation_media_events where consultation_id=$1", [roomLive.id]),
  );
  check("an administrator reads the media trail", adminMedia.ok && adminMedia.rows.length >= 1, adminMedia.error);
  const clientMediaInsert = await as(db, "authenticated", U.patientA, () =>
    db.query(
      "insert into public.consultation_media_events (consultation_id,actor_id,actor_role,event) values ($1,$2,'patient','closure_confirmed')",
      [roomLive.id, U.patientA],
    ),
  );
  check("clients cannot write the media trail", !clientMediaInsert.ok, clientMediaInsert.error);
  const mediaUpdate = await as(db, "service_role", null, () =>
    db.query("update public.consultation_media_events set detail='rewritten' where consultation_id=$1", [roomLive.id]),
  );
  check("even the service role cannot rewrite the media trail", !mediaUpdate.ok && /append-only/i.test(mediaUpdate.error), mediaUpdate.error);
  const mediaDelete = await as(db, "service_role", null, () =>
    db.query("delete from public.consultation_media_events where consultation_id=$1", [roomLive.id]),
  );
  check("even the service role cannot delete the media trail", !mediaDelete.ok && /append-only/i.test(mediaDelete.error), mediaDelete.error);

  section("14. concurrent booking protection");
  // PGlite is single-connection, so this cannot interleave two transactions.
  // The guarantee is the (provider_id, slot) primary key: concurrent inserts
  // of the same slot serialise on that unique index and the loser aborts.
  const concurrentBase = slot(8, 9);
  const firstBooking = await directSchedule(U.patientA, U.provider, concurrentBase, 45, "Concurrency base");
  check("a 45-minute booking is accepted", firstBooking.ok, firstBooking.error);
  const baseClaims = await slotClaims(firstBooking.rows?.[0]?.id);
  check("a 45-minute booking owns three slot claims", baseClaims.ok && baseClaims.rows.length === 3, JSON.stringify(baseClaims.rows));
  const misaligned = await directSchedule(
    U.patientB,
    U.provider,
    new Date(new Date(concurrentBase).getTime() + 7 * 60000).toISOString(),
    15,
    "Misaligned direct insert",
  );
  check(
    "a direct insert outside the 15-minute grid is refused",
    !misaligned.ok && /invalid schedule/i.test(misaligned.error),
    misaligned.error,
  );
  const overlappingDirect = await directSchedule(
    U.patientB,
    U.provider,
    new Date(new Date(concurrentBase).getTime() + 30 * 60000).toISOString(),
    15,
    "Direct overlap",
  );
  check(
    "a direct overlapping insert is refused by the database",
    !overlappingDirect.ok && /time no longer available/i.test(overlappingDirect.error),
    overlappingDirect.error,
  );
  const adjacentDirect = await directSchedule(
    U.patientB,
    U.provider,
    new Date(new Date(concurrentBase).getTime() + 45 * 60000).toISOString(),
    15,
    "Direct adjacent",
  );
  check("a direct adjacent insert remains valid", adjacentDirect.ok, adjacentDirect.error);
  const otherProviderDirect = await directSchedule(U.patientB, U.providerOther, concurrentBase, 15, "Other provider");
  check("another provider may use the same wall-clock slot", otherProviderDirect.ok, otherProviderDirect.error);
  const duplicateClaim = await as(db, "service_role", null, () =>
    db.query(
      "insert into public.consultation_slot_claims (provider_id,slot,consultation_id) values ($1,$2,$3)",
      [U.provider, concurrentBase, adjacentDirect.rows?.[0]?.id],
    ),
  );
  check(
    "the slot primary key blocks a duplicate claim",
    !duplicateClaim.ok && /duplicate key|unique/i.test(duplicateClaim.error),
    duplicateClaim.error,
  );
  const primaryKey = await as(db, "service_role", null, () =>
    db.query(
      "select contype from pg_constraint where conrelid='public.consultation_slot_claims'::regclass and contype='p'",
    ),
  );
  check("the slot claim table has a primary key", primaryKey.ok && primaryKey.rows.length === 1, JSON.stringify(primaryKey.rows));
  const cancelFirst = await as(db, "service_role", null, () =>
    db.query("update public.consultations set status='cancelled' where id=$1", [firstBooking.rows?.[0]?.id]),
  );
  check("the base booking is cancelled for the release check", cancelFirst.ok, cancelFirst.error);
  const releasedBaseClaims = await slotClaims(firstBooking.rows?.[0]?.id);
  check("cancellation releases every slot claim", releasedBaseClaims.ok && releasedBaseClaims.rows.length === 0, JSON.stringify(releasedBaseClaims.rows));
  const reuseSlot = await directSchedule(U.patientB, U.provider, concurrentBase, 45, "Reused slot");
  check("a released slot can be booked again", reuseSlot.ok, reuseSlot.error);
  const clientClaims = await as(db, "authenticated", U.patientA, () =>
    db.query("select slot from public.consultation_slot_claims"),
  );
  check("clients cannot read internal slot claims", !clientClaims.ok && /permission denied/i.test(clientClaims.error), clientClaims.error);

  const passed = checks.filter((c) => c.ok).length;
  console.log(`\nCONSULTATIONS RESULT: ${passed}/${checks.length} checks passed`);
  await db.close();
  if (passed !== checks.length) process.exitCode = 1;
})().catch(async (e) => {
  console.error("HARNESS ERROR:", e.message);
  process.exitCode = 1;
});
