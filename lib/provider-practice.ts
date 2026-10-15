import { uid } from "./storage";

/**
 * Practice settings a provider controls: what they offer, where, when, and for
 * how long.
 *
 * Availability is deliberately opt-in. A provider who has never set hours is
 * shown as "not set" rather than "available", because telling a patient they
 * can be seen when nobody has said so is worse than saying nothing.
 */

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export const WEEKDAYS: { id: Weekday; key: string; fallback: string }[] = [
  { id: "mon", key: "prac_mon", fallback: "Mon" },
  { id: "tue", key: "prac_tue", fallback: "Tue" },
  { id: "wed", key: "prac_wed", fallback: "Wed" },
  { id: "thu", key: "prac_thu", fallback: "Thu" },
  { id: "fri", key: "prac_fri", fallback: "Fri" },
  { id: "sat", key: "prac_sat", fallback: "Sat" },
  { id: "sun", key: "prac_sun", fallback: "Sun" },
];

export interface OpeningWindow {
  /** 24h "HH:MM", stored as typed rather than parsed so bad input is visible. */
  from: string;
  to: string;
}

export interface PracticeLocation {
  id: string;
  label: string;
  address: string;
  city: string;
  state: string;
  kind: "clinic" | "home" | "online";
}

export interface PracticeSettings {
  providerId: string;
  /** Services this practice offers, as free text the provider writes. */
  services: string[];
  categories: string[];
  locations: PracticeLocation[];
  /** Undefined means the provider has not said, which is not the same as open. */
  availability?: Partial<Record<Weekday, OpeningWindow[]>>;
  appointmentMinutes: number;
  /** Null means "no fee configured", not "free". */
  consultationFee: number | null;
  currency: string;
  acceptingNewPatients: boolean;
  updatedAt: string;
}

export const DEFAULT_DURATIONS = [15, 20, 30, 45, 60];

export function emptyPractice(providerId: string): PracticeSettings {
  return {
    providerId,
    services: [],
    categories: [],
    locations: [],
    appointmentMinutes: 30,
    consultationFee: null,
    currency: "NGN",
    acceptingNewPatients: false,
    updatedAt: "",
  };
}

/** True only when the provider has explicitly given hours for that day. */
export function isOpenOn(settings: PracticeSettings, day: Weekday): boolean {
  const windows = settings.availability?.[day];
  return Array.isArray(windows) && windows.length > 0;
}

/**
 * Whether the practice is accepting requests at all.
 *
 * This is not "are they open right now": a closed practice on a Sunday may
 * still be taking bookings for next week. It answers whether the provider has
 * switched on booking, which they control.
 */
export function isAcceptingRequests(settings: PracticeSettings): boolean {
  return settings.acceptingNewPatients;
}

/**
 * Whether anything is known about opening hours at all.
 *
 * Used to decide between "Available" and "Hours not set" so the workspace never
 * claims availability the data does not support.
 */
export function hasAnyHours(settings: PracticeSettings): boolean {
  return WEEKDAYS.some(({ id }) => isOpenOn(settings, id));
}

/** The days the provider said they work, in week order. */
export function openDays(settings: PracticeSettings): Weekday[] {
  return WEEKDAYS.filter(({ id }) => isOpenOn(settings, id)).map(({ id }) => id);
}

export function newLocation(): PracticeLocation {
  return { id: uid(), label: "", address: "", city: "", state: "", kind: "clinic" };
}

/**
 * A readable summary of a day's hours, or null when the day was never set.
 */
export function describeDay(settings: PracticeSettings, day: Weekday): string | null {
  const windows = settings.availability?.[day];
  if (!Array.isArray(windows) || windows.length === 0) return null;
  return windows.map((w) => `${w.from}–${w.to}`).join(", ");
}

/* ------------------------------------------------------- storage */

export const PRACTICE_KEY = "healthlink:practice-settings";

export function writePracticeMap(map: Record<string, PracticeSettings>): boolean {
  try {
    localStorage.setItem(PRACTICE_KEY, JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
}

export function readPracticeMap(): Record<string, PracticeSettings> {
  try {
    const raw = localStorage.getItem(PRACTICE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, PracticeSettings>) : {};
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------- store
 *
 * Exposed through useSyncExternalStore rather than useState + useEffect:
 * practice settings live in device storage, which does not exist during the
 * static render, so the server has to be able to say "not loaded yet" while
 * the client reports the stored value. A cached snapshot keeps the identity
 * stable, which useSyncExternalStore requires or it loops forever.
 */

let cache: Record<string, PracticeSettings> | null = null;
const listeners = new Set<() => void>();

/** Defaults are memoised: useSyncExternalStore needs a stable identity, and
 *  emptyPractice() would otherwise hand back a new object on every read. */
const defaults = new Map<string, PracticeSettings>();

function defaultFor(providerId: string): PracticeSettings {
  let value = defaults.get(providerId);
  if (!value) {
    value = emptyPractice(providerId);
    defaults.set(providerId, value);
  }
  return value;
}

function snapshot(): Record<string, PracticeSettings> {
  if (!cache) cache = readPracticeMap();
  return cache;
}

/** Stable for a given stored value; null on the server. */
export function practiceSnapshot(providerId: string | null): PracticeSettings | null {
  if (!providerId) return null;
  const map = snapshot();
  return map[providerId] ?? defaultFor(providerId);
}

export function serverPracticeSnapshot(): null {
  return null;
}

export function subscribePractice(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** Writes, drops the cache and tells every reader. */
export function savePractice(settings: PracticeSettings): boolean {
  const map = { ...readPracticeMap(), [settings.providerId]: settings };
  const ok = writePracticeMap(map);
  if (ok) {
    cache = map;
    for (const fn of listeners) fn();
  }
  return ok;
}

export function practiceFor(map: Record<string, PracticeSettings>, providerId: string | null) {
  if (!providerId) return null;
  return map[providerId] ?? null;
}