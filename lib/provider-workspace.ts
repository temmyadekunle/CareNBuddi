import type { Booking } from "./types";
import type { ProviderApplication } from "./provider-application";
import type { Provider } from "./content";

/**
 * The rules that decide what a provider is allowed to see.
 *
 * Everything the provider workspace shows is derived from records that already
 * exist in the app. Nothing here invents a patient, a consultation, an alert or
 * a statistic, and nothing here widens access beyond an appointment that
 * actually connects the two accounts.
 */

/* ------------------------------------------------------- identity */

/**
 * The provider record this account owns, if any.
 *
 * Mirrors how the existing workspace resolved it: a facility registration that
 * has been approved, otherwise the seeded facility for the same email. Returns
 * null rather than guessing, so the caller can show the "no facility linked"
 * state instead of someone else's practice.
 */
export function providerIdFor(args: {
  email: string | undefined;
  requests: { id: string; email: string; status: string }[];
  providers: Provider[];
  /** The seeded demonstration facility, when the account owns it. */
  seededFor?: (email: string) => Provider | undefined;
}): string | null {
  const email = args.email?.toLowerCase() ?? "";
  if (!email) return null;
  const approved = args.requests.find(
    (r) => r.email.toLowerCase() === email && r.status === "approved",
  );
  if (approved) return `prv-${approved.id}`;
  return args.seededFor?.(args.email ?? "")?.id ?? null;
}

/* ------------------------------------------------- care relationship */

/**
 * A patient this provider is allowed to see, and why.
 *
 * The only thing that creates the relationship is a booking that names both
 * this provider and a real signed-in user. That is the whole access model: no
 * directory, no search-by-name, and no way to reach a patient who has never
 * booked with you.
 */
export interface CareRelationship {
  patientId: string;
  /** Every booking connecting the two, newest first. */
  bookings: Booking[];
  /** True while a booking is still open; false once they are all cancelled. */
  active: boolean;
  /** ISO timestamp of the most recent booking. */
  lastActivityAt: string;
  /** Statuses of the open bookings, for the "care requested" badges. */
  openStatuses: Booking["status"][];
}

/**
 * Bookings that name this provider. A null providerId means the booking is an
 * unassigned facility request and belongs to nobody's care list.
 */
export function bookingsForProvider(bookings: Booking[], providerId: string | null): Booking[] {
  if (!providerId) return [];
  return bookings.filter((b) => b.providerId === providerId);
}

const byNewest = (a: Booking, b: Booking) => b.createdAt.localeCompare(a.createdAt);

/**
 * The patients this provider has a legitimate care relationship with.
 *
 * A booking with no userId is a request from someone who never signed in. It is
 * a real care request and belongs in the requests queue, but it is not a
 * patient account and must never become a patient record.
 */
export function careRelationships(
  bookings: Booking[],
  providerId: string | null,
): CareRelationship[] {
  const mine = bookingsForProvider(bookings, providerId);

  const byPatient = new Map<string, Booking[]>();
  for (const booking of mine) {
    if (!booking.userId) continue;
    const list = byPatient.get(booking.userId);
    if (list) list.push(booking);
    else byPatient.set(booking.userId, [booking]);
  }

  const out: CareRelationship[] = [];
  for (const [patientId, list] of byPatient) {
    const sorted = [...list].sort(byNewest);
    const open = sorted.filter((b) => b.status !== "cancelled");
    out.push({
      patientId,
      bookings: sorted,
      active: open.length > 0,
      lastActivityAt: sorted[0]?.createdAt ?? "",
      openStatuses: open.map((b) => b.status),
    });
  }
  return out.sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
}

/**
 * Whether a provider may open a patient's care details.
 *
 * Cancelling a booking ends the relationship. This is the check every patient
 * screen must run before rendering anything, and it deliberately takes the
 * booking list rather than trusting the caller to have filtered it.
 */
export function canAccessCare(
  providerId: string | null,
  patientUserId: string | null,
  bookings: Booking[],
): boolean {
  if (!providerId || !patientUserId) return false;
  return bookings.some(
    (b) =>
      b.providerId === providerId && b.userId === patientUserId && b.status !== "cancelled",
  );
}

/**
 * Requests from people who are not signed in. These are requests to be
 * contacted, not patients: there is no account behind them and so no records.
 */
export function unassignedRequests(bookings: Booking[]): Booking[] {
  return bookings
    .filter((b) => !b.userId && b.status !== "cancelled" && b.status !== "completed")
    .sort(byNewest);
}

/* ----------------------------------------------------- dashboard */

/**
 * Everything the dashboard counts, derived from the same booking list the
 * screens list. A count of 0 means "none in your records", never a placeholder.
 */
export interface DashboardCounts {
  newRequests: number;
  awaitingConfirmation: number;
  upcoming: number;
  followUpsDue: number;
  patients: number;
}

/** Booking statuses that mean an appointment still needs the provider to act. */
const OPEN_STATUSES: Booking["status"][] = ["new", "contacted", "confirmed"];

/**
 * Upcoming means today or later, using the booking's own date. Bookings with no
 * date are not counted: we have no reliable information about when they are.
 */
export function isUpcoming(booking: Booking, today: string): boolean {
  if (!booking.date) return false;
  return OPEN_STATUSES.includes(booking.status) && booking.date >= today;
}

export function dashboardCounts(args: {
  bookings: Booking[];
  providerId: string | null;
  today: string;
}): DashboardCounts {
  const { bookings, providerId, today } = args;
  const mine = bookingsForProvider(bookings, providerId);
  const open = mine.filter((b) => OPEN_STATUSES.includes(b.status));

  return {
    newRequests: open.filter((b) => b.status === "new").length,
    awaitingConfirmation: open.filter((b) => b.status === "contacted").length,
    upcoming: open.filter((b) => isUpcoming(b, today)).length,
    followUpsDue: open.filter((b) => b.status === "confirmed").length,
    patients: careRelationships(bookings, providerId).filter((r) => r.active).length,
  };
}

/* ----------------------------------------------- verification */

/**
 * Whether the workspace should be open at all.
 *
 * A provider with an application that has not been verified belongs on the
 * status screen. An account with no application record - the seeded
 * demonstration facility and admins - keeps working, so the guard does not lock
 * anyone out of a screen they could already use.
 */
export function workspaceAccess(args: {
  role: string | undefined;
  application: ProviderApplication | null | undefined;
}): "open" | "locked" | "not-a-provider" {
  const { role, application } = args;
  if (role !== "provider" && role !== "admin") return "not-a-provider";
  if (role === "provider" && application && application.status !== "verified") return "locked";
  return "open";
}