import assert from "node:assert/strict";
import test from "node:test";

import {
  CONSULTATION_DURATIONS,
  JOIN_CLOSES_AFTER_MINUTES,
  JOIN_OPENS_MINUTES,
  canCancel,
  canComplete,
  canJoin,
  canRespond,
  canStart,
  formatConsultationWhen,
  formatSlotTime,
  groupConsultations,
  groupSlots,
  isActiveStatus,
  isTerminalStatus,
  joinState,
  joinWindow,
  slotDayKey,
  sortConsultations,
  validateRequest,
  type Consultation,
} from "../lib/consultation-core";

/**
 * These are the same rules the 0011 RPCs enforce, expressed for the UI. The
 * database remains the authority; the point of these tests is that the screen
 * never offers an action the server will refuse, and never hides one it would
 * allow.
 */

const START = "2026-06-01T10:00:00.000Z";

function consultation(over: Partial<Consultation> & { id: string }): Consultation {
  return {
    patient_id: "patient-1",
    provider_id: "provider-1",
    patient_name: "Amina Yusuf",
    provider_name: "Dr Mensah",
    scheduled_for: START,
    duration_minutes: 30,
    status: "requested",
    reason: "Recurring headaches",
    patient_consent: true,
    consented_at: START,
    started_at: null,
    ended_at: null,
    completion_note: "",
    decline_reason: "",
    created_at: "2026-05-30T09:00:00.000Z",
    updated_at: "2026-05-30T09:00:00.000Z",
    ...over,
  };
}

test("supported durations are 15, 30 and 45 minutes", () => {
  assert.deepEqual([...CONSULTATION_DURATIONS], [15, 30, 45]);
});

test("the join window opens before the appointment and closes after it ends", () => {
  const { opensAt, closesAt } = joinWindow(START, 30);
  const start = new Date(START).getTime();
  assert.equal(opensAt.getTime(), start - JOIN_OPENS_MINUTES * 60_000);
  assert.equal(closesAt.getTime(), start + (30 + JOIN_CLOSES_AFTER_MINUTES) * 60_000);
});

test("joinState only opens for accepted or in-progress sessions", () => {
  const now = new Date("2026-06-01T10:05:00.000Z");
  assert.equal(joinState(consultation({ id: "c1", status: "requested" }), now), "closed");
  assert.equal(joinState(consultation({ id: "c2", status: "completed" }), now), "closed");
  assert.equal(joinState(consultation({ id: "c3", status: "cancelled" }), now), "closed");
  assert.equal(joinState(consultation({ id: "c4", status: "accepted" }), now), "open");
  assert.equal(joinState(consultation({ id: "c5", status: "in_progress" }), now), "open");
});

test("joinState reports waiting before the window and ended after it", () => {
  const accepted = consultation({ id: "c1", status: "accepted" });
  assert.equal(joinState(accepted, new Date("2026-06-01T09:40:00.000Z")), "waiting");
  assert.equal(joinState(accepted, new Date("2026-06-01T11:05:00.000Z")), "ended");
});

test("canJoin follows joinState, and canStart needs an accepted session", () => {
  const now = new Date("2026-06-01T10:05:00.000Z");
  assert.equal(canJoin(consultation({ id: "a", status: "accepted" }), now), true);
  assert.equal(canStart(consultation({ id: "a", status: "accepted" }), now), true);
  assert.equal(canStart(consultation({ id: "b", status: "in_progress" }), now), false);
  assert.equal(canStart(consultation({ id: "c", status: "requested" }), now), false);
});

test("cancellation, response and completion are limited to their statuses", () => {
  assert.equal(canCancel("requested"), true);
  assert.equal(canCancel("accepted"), true);
  assert.equal(canCancel("in_progress"), false);
  assert.equal(canRespond("requested"), true);
  assert.equal(canRespond("accepted"), false);
  assert.equal(canComplete("in_progress"), true);
  assert.equal(canComplete("accepted"), false);
  assert.equal(isActiveStatus("requested"), true);
  assert.equal(isActiveStatus("in_progress"), true);
  assert.equal(isActiveStatus("completed"), false);
  assert.equal(isTerminalStatus("expired"), true);
  assert.equal(isTerminalStatus("accepted"), false);
});

test("validateRequest reports the first real problem in form order", () => {
  const now = new Date("2026-06-01T09:00:00.000Z");
  const base = {
    providerId: "provider-1",
    scheduledFor: "2026-06-01T10:00:00.000Z",
    durationMinutes: 30,
    reason: "Recurring headaches",
    consent: true,
    now,
  };
  assert.equal(validateRequest(base), null);
  assert.equal(validateRequest({ ...base, providerId: "" }), "provider");
  assert.equal(validateRequest({ ...base, durationMinutes: 20 }), "duration");
  assert.equal(validateRequest({ ...base, scheduledFor: "2026-06-01T09:05:00.000Z" }), "slot");
  assert.equal(validateRequest({ ...base, scheduledFor: "not a date" }), "slot");
  assert.equal(validateRequest({ ...base, reason: "  a  " }), "reason");
  assert.equal(validateRequest({ ...base, reason: "x".repeat(1001) }), "reason");
  assert.equal(validateRequest({ ...base, consent: false }), "consent");
});

test("groupConsultations separates current, upcoming and history", () => {
  const now = new Date("2026-06-01T10:00:00.000Z");
  const rows = [
    consultation({ id: "progress", status: "in_progress", scheduled_for: "2026-06-01T09:45:00.000Z" }),
    consultation({ id: "later", status: "accepted", scheduled_for: "2026-06-02T10:00:00.000Z" }),
    consultation({ id: "soon", status: "requested", scheduled_for: "2026-06-01T13:00:00.000Z" }),
    consultation({ id: "done", status: "completed", scheduled_for: "2026-05-20T10:00:00.000Z" }),
    consultation({ id: "declined", status: "declined", scheduled_for: "2026-06-03T10:00:00.000Z" }),
    consultation({ id: "stale", status: "accepted", scheduled_for: "2026-05-01T10:00:00.000Z" }),
  ];

  const groups = groupConsultations(rows, now);
  assert.deepEqual(groups.current.map((r) => r.id), ["progress"]);
  assert.deepEqual(groups.upcoming.map((r) => r.id), ["soon", "later"]);
  assert.deepEqual(groups.history.map((r) => r.id), ["declined", "done", "stale"]);
});

test("sortConsultations orders ascending by scheduled time without mutating input", () => {
  const rows = [
    consultation({ id: "b", scheduled_for: "2026-06-02T10:00:00.000Z" }),
    consultation({ id: "a", scheduled_for: "2026-06-01T10:00:00.000Z" }),
  ];
  const sorted = sortConsultations(rows);
  assert.deepEqual(sorted.map((r) => r.id), ["a", "b"]);
  assert.deepEqual(rows.map((r) => r.id), ["b", "a"]);
});

test("groupSlots groups by local day in ascending order", () => {
  const slots = [
    "2026-06-02T12:00:00.000Z",
    "2026-06-02T11:15:00.000Z",
    "2026-06-01T12:00:00.000Z",
  ];
  const days = groupSlots(slots, "en");
  assert.equal(days.length, 2);
  assert.deepEqual(days[0].slots, ["2026-06-01T12:00:00.000Z"]);
  assert.deepEqual(days[1].slots, ["2026-06-02T11:15:00.000Z", "2026-06-02T12:00:00.000Z"]);
  assert.equal(days[0].key, slotDayKey(slots[2]));
});

test("date formatters fail quietly on invalid input", () => {
  assert.equal(formatConsultationWhen("nope"), "");
  assert.equal(formatSlotTime("nope"), "");
  assert.equal(slotDayKey("nope"), "");
  assert.match(formatConsultationWhen(START, "en"), /\d/);
  assert.match(formatSlotTime(START, "en"), /\d/);
});
