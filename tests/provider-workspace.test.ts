import assert from "node:assert/strict";
import test from "node:test";

import {
  bookingsForProvider,
  canAccessCare,
  careRelationships,
  dashboardCounts,
  isUpcoming,
  unassignedRequests,
  workspaceAccess,
} from "../lib/provider-workspace";
import type { Booking } from "../lib/types";

/**
 * The provider workspace must never widen access beyond an appointment that
 * actually connects two accounts. These tests are the guard rail for that:
 * a provider who knows a patient's name or id must not be able to reach them.
 */

const DR = "dr-mensah";
const OTHER = "dr-okafor";

function booking(over: Partial<Booking> & { id: string }): Booking {
  return {
    providerId: DR,
    userId: "patient-1",
    name: "Amina Yusuf",
    phone: "+234 802 333 4444",
    message: "",
    status: "new",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

const LIST: Booking[] = [
  booking({ id: "b1", userId: "patient-1", status: "new", createdAt: "2026-01-03T00:00:00.000Z" }),
  booking({ id: "b2", userId: "patient-1", status: "confirmed", createdAt: "2026-01-01T00:00:00.000Z" }),
  // Same patient, but booked with a different provider: no relationship here.
  booking({ id: "b3", userId: "patient-2", providerId: OTHER, createdAt: "2026-01-05T00:00:00.000Z" }),
  // No userId: a contact request from someone who never signed in.
  booking({ id: "b4", userId: null, name: "Walk-in", status: "new", createdAt: "2026-01-06T00:00:00.000Z" }),
  // Unassigned facility request, belongs to no provider.
  booking({ id: "b5", providerId: null, userId: "patient-3", status: "new", createdAt: "2026-01-07T00:00:00.000Z" }),
];

test("a provider only sees bookings naming them", () => {
  const ids = bookingsForProvider(LIST, DR).map((b) => b.id);
  assert.deepEqual(ids, ["b1", "b2", "b4"]);
});

test("a provider with no identity sees nothing", () => {
  assert.deepEqual(bookingsForProvider(LIST, null), []);
  assert.deepEqual(careRelationships(LIST, null), []);
});

test("an unassigned request is not a patient", () => {
  // patient-3 booked with nobody and has no provider; dr-mensah must not see
  // them, because there is no appointment connecting the two.
  assert.equal(canAccessCare(DR, "patient-3", LIST), false);
});

test("a booking with no userId does not create a patient record", () => {
  // b4 is a real request from a real caller, but there is no account behind
  // it, so it must appear as a request and never as a patient.
  const patients = careRelationships(LIST, DR).map((r) => r.patientId);
  assert.deepEqual(patients, ["patient-1"]);
  assert.ok(!patients.includes("guest"));
  const requests = unassignedRequests(LIST).map((b) => b.id);
  assert.ok(requests.includes("b4"));
});

test("a patient of another provider is out of reach", () => {
  assert.equal(canAccessCare(DR, "patient-2", LIST), false);
  assert.equal(canAccessCare(OTHER, "patient-2", LIST), true);
});

test("knowing an id or a name grants nothing", () => {
  // The patient exists in the store but has no booking with this provider.
  assert.equal(canAccessCare(DR, "patient-9", LIST), false);
  assert.equal(canAccessCare(DR, "", LIST), false);
  assert.equal(canAccessCare(DR, null, LIST), false);
  assert.equal(canAccessCare(null, "patient-1", LIST), false);
});

test("cancelling every booking ends the relationship", () => {
  const cancelled = [
    booking({ id: "c1", userId: "patient-1", status: "cancelled" }),
    booking({ id: "c2", userId: "patient-1", status: "cancelled" }),
  ];
  assert.equal(canAccessCare(DR, "patient-1", cancelled), false);
  const rel = careRelationships(cancelled, DR)[0];
  assert.equal(rel.active, false);
  assert.deepEqual(rel.openStatuses, []);
  // The history is kept so the provider can see it, it is just no longer open.
  assert.equal(rel.bookings.length, 2);
});

test("a relationship stays open while one booking is live", () => {
  const mixed = [
    booking({ id: "m1", userId: "patient-1", status: "cancelled" }),
    booking({ id: "m2", userId: "patient-1", status: "confirmed" }),
  ];
  assert.equal(canAccessCare(DR, "patient-1", mixed), true);
  assert.equal(careRelationships(mixed, DR)[0].active, true);
});

test("relationships come back newest first", () => {
  const many = [
    booking({ id: "n1", userId: "p-a", createdAt: "2026-01-01T00:00:00.000Z" }),
    booking({ id: "n2", userId: "p-b", createdAt: "2026-03-01T00:00:00.000Z" }),
    booking({ id: "n3", userId: "p-c", createdAt: "2026-02-01T00:00:00.000Z" }),
  ];
  assert.deepEqual(careRelationships(many, DR).map((r) => r.patientId), ["p-b", "p-c", "p-a"]);
});

/* ------------------------------------------------------------ counts */

test("counts come from the provider's own bookings", () => {
  const list = [
    booking({ id: "d1", status: "new", date: "2026-05-10" }),
    booking({ id: "d2", status: "contacted", date: "2026-05-11" }),
    booking({ id: "d3", status: "confirmed", date: "2026-05-12" }),
    booking({ id: "d4", status: "completed", date: "2026-05-01" }),
    booking({ id: "d5", status: "cancelled", date: "2026-05-02" }),
    // Someone else's booking: must not be counted anywhere.
    booking({ id: "d6", providerId: OTHER, status: "new", date: "2026-05-10" }),
    // Unassigned: must not be counted either.
    booking({ id: "d7", providerId: null, status: "new", date: "2026-05-10" }),
  ];
  const c = dashboardCounts({ bookings: list, providerId: DR, today: "2026-05-05" });
  assert.equal(c.newRequests, 1);
  assert.equal(c.awaitingConfirmation, 1);
  assert.equal(c.followUpsDue, 1);
  assert.equal(c.upcoming, 3);
  assert.equal(c.patients, 1);
});

test("an empty workspace reports zeros rather than placeholders", () => {
  const c = dashboardCounts({ bookings: [], providerId: DR, today: "2026-05-05" });
  assert.deepEqual(c, {
    newRequests: 0,
    awaitingConfirmation: 0,
    upcoming: 0,
    followUpsDue: 0,
    patients: 0,
  });
});

test("a booking with no date is never counted as upcoming", () => {
  // We do not know when it is, so we must not imply that we do.
  assert.equal(isUpcoming(booking({ id: "u1", status: "confirmed" }), "2026-05-05"), false);
  const c = dashboardCounts({
    bookings: [booking({ id: "u2", status: "confirmed" })],
    providerId: DR,
    today: "2026-05-05",
  });
  assert.equal(c.upcoming, 0);
});

test("a past or closed booking is not upcoming", () => {
  assert.equal(
    isUpcoming(booking({ id: "p1", date: "2026-05-04", status: "confirmed" }), "2026-05-05"),
    false,
  );
  assert.equal(
    isUpcoming(booking({ id: "p2", date: "2026-05-06", status: "confirmed" }), "2026-05-05"),
    true,
  );
  assert.equal(
    isUpcoming(booking({ id: "p3", date: "2026-05-20", status: "completed" }), "2026-05-05"),
    false,
  );
  assert.equal(
    isUpcoming(booking({ id: "p4", date: "2026-05-20", status: "cancelled" }), "2026-05-05"),
    false,
  );
  // Today itself still counts.
  assert.equal(
    isUpcoming(booking({ id: "p5", date: "2026-05-05", status: "confirmed" }), "2026-05-05"),
    true,
  );
});

/* --------------------------------------------------------- access */

test("the workspace is closed to unverified applicants", () => {
  const app = { status: "submitted" } as never;
  assert.equal(workspaceAccess({ role: "provider", application: app }), "locked");
  assert.equal(
    workspaceAccess({ role: "provider", application: { status: "verified" } as never }),
    "open",
  );
});

test("no application record does not lock anyone out", () => {
  // The seeded demonstration facility and admins never apply, so the workspace
  // has to stay open for them.
  assert.equal(workspaceAccess({ role: "provider", application: null }), "open");
  assert.equal(workspaceAccess({ role: "admin", application: null }), "open");
});

test("patients are not staff", () => {
  assert.equal(workspaceAccess({ role: "consumer", application: null }), "not-a-provider");
  assert.equal(workspaceAccess({ role: undefined, application: null }), "not-a-provider");
});