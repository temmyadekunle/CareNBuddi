/**
 * Telemedicine types and pure rules.
 *
 * Nothing here talks to a server. The database (0011_consultations.sql) is
 * the authority for who may do what; these helpers only render the same rules
 * so the UI does not offer an action the server will refuse.
 */

export type ConsultationStatus =
  | "requested"
  | "accepted"
  | "declined"
  | "cancelled"
  | "in_progress"
  | "completed"
  | "expired";

export type ConsultationRole = "patient" | "provider";

export const CONSULTATION_DURATIONS = [15, 30, 45] as const;
export type ConsultationDuration = (typeof CONSULTATION_DURATIONS)[number];

/** Join opens this many minutes before the scheduled start. */
export const JOIN_OPENS_MINUTES = 15;
/** Join/start closes this many minutes after the scheduled end. */
export const JOIN_CLOSES_AFTER_MINUTES = 30;

export interface Consultation {
  id: string;
  patient_id: string;
  provider_id: string;
  patient_name: string;
  provider_name: string;
  scheduled_for: string;
  duration_minutes: number;
  status: ConsultationStatus;
  reason: string;
  patient_consent: boolean;
  consented_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  completion_note: string;
  decline_reason: string;
  created_at: string;
  updated_at: string;
}

export interface ConsultationEvent {
  id: number;
  consultation_id: string;
  actor_id: string | null;
  actor_role: "patient" | "provider" | "admin" | "system";
  event:
    | "requested"
    | "accepted"
    | "declined"
    | "cancelled"
    | "started"
    | "completed"
    | "expired"
    | "joined";
  note: string;
  created_at: string;
}

export interface VerifiedProvider {
  user_id: string;
  full_name: string;
  category: string;
  speciality: string;
  state: string;
  city: string;
  facility: string;
  bio: string;
}

export interface ConsultationJoinContext {
  id: string;
  status: ConsultationStatus;
  room_name: string;
  scheduled_for: string;
  duration_minutes: number;
  patient_name: string;
  provider_name: string;
  reason: string;
  role: ConsultationRole;
  join_opens_at: string;
  join_closes_at: string;
}

export interface ConsultationJoinTicket {
  url: string;
  token: string;
  expiresAt: string;
  role: ConsultationRole;
}

export type JoinState = "closed" | "waiting" | "open" | "ended";

export function isActiveStatus(status: ConsultationStatus): boolean {
  return status === "requested" || status === "accepted" || status === "in_progress";
}

export function isTerminalStatus(status: ConsultationStatus): boolean {
  return status === "declined" || status === "cancelled" || status === "completed" || status === "expired";
}

export function joinWindow(
  scheduledFor: string,
  durationMinutes: number,
): { opensAt: Date; closesAt: Date } {
  const start = new Date(scheduledFor).getTime();
  return {
    opensAt: new Date(start - JOIN_OPENS_MINUTES * 60_000),
    closesAt: new Date(start + (durationMinutes + JOIN_CLOSES_AFTER_MINUTES) * 60_000),
  };
}

/**
 * Where a session is relative to its wall-clock window. This mirrors the
 * database join window exactly; it is not a substitute for the server check.
 */
export function joinState(
  consultation: Pick<Consultation, "status" | "scheduled_for" | "duration_minutes">,
  now: Date = new Date(),
): JoinState {
  if (consultation.status !== "accepted" && consultation.status !== "in_progress") {
    return "closed";
  }
  const { opensAt, closesAt } = joinWindow(
    consultation.scheduled_for,
    consultation.duration_minutes,
  );
  if (now.getTime() < opensAt.getTime()) return "waiting";
  if (now.getTime() > closesAt.getTime()) return "ended";
  return "open";
}

export function canJoin(
  consultation: Pick<Consultation, "status" | "scheduled_for" | "duration_minutes">,
  now: Date = new Date(),
): boolean {
  return joinState(consultation, now) === "open";
}

export function canStart(
  consultation: Pick<Consultation, "status" | "scheduled_for" | "duration_minutes">,
  now: Date = new Date(),
): boolean {
  return consultation.status === "accepted" && canJoin(consultation, now);
}

export function canCancel(status: ConsultationStatus): boolean {
  return status === "requested" || status === "accepted";
}

export function canRespond(status: ConsultationStatus): boolean {
  return status === "requested";
}

export function canComplete(status: ConsultationStatus): boolean {
  return status === "in_progress";
}

export function validateRequest(args: {
  providerId: string;
  scheduledFor: string;
  durationMinutes: number;
  reason: string;
  consent: boolean;
  now?: Date;
}): "provider" | "slot" | "duration" | "reason" | "consent" | null {
  if (!args.providerId) return "provider";
  if (!CONSULTATION_DURATIONS.includes(args.durationMinutes as ConsultationDuration)) {
    return "duration";
  }
  const when = new Date(args.scheduledFor).getTime();
  const now = (args.now ?? new Date()).getTime();
  if (!Number.isFinite(when) || when < now + 10 * 60_000) return "slot";
  const reason = args.reason.trim();
  if (reason.length < 3 || reason.length > 1000) return "reason";
  if (!args.consent) return "consent";
  return null;
}

/** Upcoming work first, then recently finished sessions. */
export function sortConsultations(rows: Consultation[]): Consultation[] {
  return [...rows].sort(
    (a, b) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime(),
  );
}

export interface ConsultationGroups {
  current: Consultation[];
  upcoming: Consultation[];
  history: Consultation[];
}

/**
 * A provider's actionable list, a patient's active list and both histories in
 * one pass. `current` is in progress; `upcoming` is requested/accepted with a
 * future window; everything else is history (newest first).
 */
export function groupConsultations(rows: Consultation[], now: Date = new Date()): ConsultationGroups {
  const current: Consultation[] = [];
  const upcoming: Consultation[] = [];
  const history: Consultation[] = [];

  for (const row of rows) {
    if (row.status === "in_progress") {
      current.push(row);
      continue;
    }
    const future = new Date(row.scheduled_for).getTime() > now.getTime() - 60 * 60_000;
    if (
      future &&
      (row.status === "requested" || row.status === "accepted")
    ) {
      upcoming.push(row);
    } else {
      history.push(row);
    }
  }

  upcoming.sort((a, b) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime());
  history.sort((a, b) => new Date(b.scheduled_for).getTime() - new Date(a.scheduled_for).getTime());
  return { current, upcoming, history };
}

const LOCALES: Record<string, string> = {
  en: "en-NG",
  yo: "yo-NG",
  ha: "ha-NG",
  ig: "ig-NG",
};

export function formatConsultationWhen(iso: string, lang = "en"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(LOCALES[lang] ?? "en-NG", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 16).replace("T", " ");
  }
}

export function formatSlotDay(iso: string, lang = "en"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(LOCALES[lang] ?? "en-NG", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(date);
  } catch {
    return iso.slice(0, 10);
  }
}

export function formatSlotTime(iso: string, lang = "en"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(LOCALES[lang] ?? "en-NG", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return iso.slice(11, 16);
  }
}

/** Stable local day key for grouping a slot list. */
export function slotDayKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface SlotDay {
  key: string;
  label: string;
  slots: string[];
}

export function groupSlots(slots: string[], lang = "en"): SlotDay[] {
  const days = new Map<string, string[]>();
  for (const slot of slots) {
    const key = slotDayKey(slot);
    if (!key) continue;
    const list = days.get(key) ?? [];
    list.push(slot);
    days.set(key, list);
  }
  return Array.from(days.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, list]) => ({
      key,
      label: formatSlotDay(list[0], lang),
      slots: list.sort(),
    }));
}
