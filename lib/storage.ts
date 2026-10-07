"use client";

import { useSyncExternalStore } from "react";
import type { JournalEntry, MedicalRecord, Reminder } from "./types";
import type { Booking, ProviderRequest, Report, User } from "./types";
import type { Lang } from "./lang";
import { PROVIDERS, PROVIDER_SEED_ID, TOPICS } from "./content";

export interface Session {
  userId: string | null;
  lang: Lang;
}

export const seedSession: Session = { userId: null, lang: "en" };

export const KEYS = {
  journal: "healthlink:journal",
  records: "healthlink:records",
  reminders: "healthlink:reminders",
  fitnessProfile: "healthlink:fitness-profile",
  workouts: "healthlink:workouts",
  weighIns: "healthlink:weigh-ins",
  exerciseReminder: "healthlink:exercise-reminder",
  careCircle: "healthlink:care-circle",
  passport: "healthlink:passport",
  profilePhotos: "healthlink:profile-photos",
  session: "healthlink:session",
  users: "healthlink:users",
  providers: "healthlink:providers",
  topics: "healthlink:topics",
  providerRequests: "healthlink:provider-requests",
  bookings: "healthlink:bookings",
  reports: "healthlink:reports",
} as const;

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export const seedJournal: JournalEntry[] = [
  {
    id: "seed-j1",
    date: daysAgo(13),
    mood: "good",
    symptoms: ["Fatigue"],
    vitals: { weightKg: 74.1, heartRate: 71, steps: 5200, sleepHours: 6.5 },
    note: "Felt reasonably energised in the morning.",
  },
  {
    id: "seed-j2",
    date: daysAgo(11),
    mood: "okay",
    symptoms: ["Headache", "Fatigue"],
    vitals: { weightKg: 74.0, heartRate: 76, systolic: 124, diastolic: 82, sleepHours: 6.0 },
    note: "Slight headache after a late night.",
  },
  {
    id: "seed-j3",
    date: daysAgo(9),
    mood: "low",
    symptoms: ["Headache", "Nausea", "Insomnia"],
    vitals: { weightKg: 74.4, heartRate: 82, systolic: 128, diastolic: 84, sleepHours: 5.0, steps: 3400 },
    note: "Rough night, worked late.",
  },
  {
    id: "seed-j4",
    date: daysAgo(7),
    mood: "okay",
    symptoms: ["Fatigue", "Anxiety"],
    vitals: { weightKg: 74.2, heartRate: 79, sleepHours: 6.2, steps: 6100 },
    note: "Feeling a bit anxious but improved during the day.",
  },
  {
    id: "seed-j5",
    date: daysAgo(5),
    mood: "good",
    symptoms: [],
    vitals: { weightKg: 73.9, heartRate: 72, systolic: 122, diastolic: 80, sleepHours: 7.3, steps: 8700 },
    note: "Better focus, went for a run.",
  },
  {
    id: "seed-j6",
    date: daysAgo(3),
    mood: "great",
    symptoms: [],
    vitals: { weightKg: 73.7, heartRate: 68, systolic: 119, diastolic: 78, sleepHours: 7.8, steps: 10400 },
    note: "Slept well and stayed active all day.",
  },
  {
    id: "seed-j7",
    date: daysAgo(1),
    mood: "good",
    symptoms: ["Cough"],
    vitals: { weightKg: 73.6, heartRate: 70, sleepHours: 7.0, steps: 7200 },
    note: "Mild dry cough, otherwise fine.",
  },
];

export const seedRecords: MedicalRecord[] = [
  {
    id: "seed-r1",
    title: "Annual physical",
    provider: "Dr. Adebayo, Abuja Care Clinic",
    date: daysAgo(40),
    category: "visit",
    summary: "Routine physical. All vitals within normal range.",
    link: "",
  },
  {
    id: "seed-r2",
    title: "Complete blood count",
    provider: "Lagos Diagnostics Lab",
    date: daysAgo(32),
    category: "lab",
    summary: "FBC normal. Mildly elevated cholesterol.",
    link: "",
  },
  {
    id: "seed-r3",
    title: "COVID-19 vaccination",
    provider: "City Health Centre",
    date: daysAgo(90),
    category: "vaccination",
    summary: "Booster dose administered, no adverse reaction.",
    link: "",
  },
];

export const seedReminders: Reminder[] = [
  {
    id: "seed-m1",
    title: "Morning medication",
    time: "08:00",
    type: "medication",
    days: [0, 1, 2, 3, 4, 5, 6],
    notes: "Vitamin D + blood pressure tablet.",
    enabled: true,
  },
  {
    id: "seed-m2",
    title: "Drink water",
    time: "12:30",
    type: "hydration",
    days: [1, 2, 3, 4, 5],
    notes: "Hydration break.",
    enabled: true,
  },
  {
    id: "seed-m3",
    title: "Evening walk",
    time: "18:00",
    type: "activity",
    days: [1, 3, 5],
    notes: "30 minute brisk walk.",
    enabled: true,
  },
];

const listeners = new Map<string, Set<() => void>>();
const cache = new Map<string, unknown>();
const changeListeners = new Set<(key: string) => void>();

function notify(key: string) {
  listeners.get(key)?.forEach((cb) => cb());
  changeListeners.forEach((cb) => cb(key));
}

/** Notified whenever any stored collection or value is written. */
export function onLocalChange(cb: (key: string) => void): () => void {
  changeListeners.add(cb);
  return () => {
    changeListeners.delete(cb);
  };
}

/**
 * Drops the in-memory copy of a value so the next read comes from storage
 * again, then wakes subscribers. Used by pull-to-refresh style buttons.
 */
export function refreshLocal(key: string) {
  cache.delete(key);
  notify(key);
}

export function readLocal<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

/** Writes straight to storage (used by cloud sync) and refreshes subscribers. */
export function writeLocal<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    cache.delete(key);
    notify(key);
  } catch {
    // storage may be unavailable
  }
}

function subscribe(key: string, cb: () => void): () => void {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === key) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    set!.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function readCollection<T extends { id: string }>(key: string, seed: T[]): T[] {
  if (cache.has(key)) return cache.get(key) as T[];
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as T[];
      if (Array.isArray(parsed)) {
        cache.set(key, parsed);
        return parsed;
      }
    }
  } catch {
    // ignore malformed storage
  }
  cache.set(key, seed);
  return seed;
}

function writeCollection<T extends { id: string }>(key: string, items: T[]) {
  cache.set(key, items);
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // storage may be unavailable
  }
  notify(key);
}

/**
 * Reads a stored collection straight from storage, bypassing the in-memory
 * copy. Used to render user-supplied images, which are far too large to keep
 * in a module-level cache.
 */
export function readCollectionFresh<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? null;
  } catch {
    return null;
  }
}

/**
 * Writes a value and reports whether it actually persisted.
 *
 * `writeValue` swallows failures so the rest of the app can keep working, but
 * that is no good for a profile photo: the user needs to be told when the
 * device has run out of room rather than being shown a picture that will be
 * gone after a reload.
 */
export function writeValueChecked<T>(key: string, value: T): boolean {
  cache.set(key, value);
  try {
    localStorage.setItem(key, JSON.stringify(value));
    notify(key);
    return true;
  } catch {
    cache.delete(key);
    return false;
  }
}

export function useStoredCollection<T extends { id: string }>(
  key: string,
  seed: T[],
): [T[], (next: T[] | ((prev: T[]) => T[])) => void] {
  const items = useSyncExternalStore(
    (cb) => subscribe(key, cb),
    () => readCollection(key, seed),
    () => seed,
  );

  const update = (next: T[] | ((prev: T[]) => T[])) => {
    const prev = readCollection(key, seed);
    const result = typeof next === "function" ? (next as (p: T[]) => T[])(prev) : next;
    writeCollection(key, result);
  };

  return [items, update];
}

function readValue<T>(key: string, seed: T): T {
  if (cache.has(key)) return cache.get(key) as T;
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      const parsed = JSON.parse(raw) as T;
      cache.set(key, parsed);
      return parsed;
    }
  } catch {
    // ignore malformed storage
  }
  cache.set(key, seed);
  return seed;
}

function writeValue<T>(key: string, value: T) {
  cache.set(key, value);
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage may be unavailable
  }
  notify(key);
}

export function useStoredValue<T>(
  key: string,
  seed: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const value = useSyncExternalStore(
    (cb) => subscribe(key, cb),
    () => readValue(key, seed),
    () => seed,
  );

  const update = (next: T | ((prev: T) => T)) => {
    const prev = readValue(key, seed);
    const result = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
    writeValue(key, result);
  };

  return [value, update];
}

export function useSession(): [Session, (next: Session | ((prev: Session) => Session)) => void] {
  return useStoredValue<Session>(KEYS.session, seedSession);
}

export type ContentItem = (typeof TOPICS)[number] & { id: string; status: "published" | "draft" };

export const seedUsers: User[] = [
  {
    id: "u-admin", name: "CareNBuddi Admin", email: "admin@healthlink.ng", role: "admin",
    lang: "en", createdAt: `2026-08-01T09:00:00.000Z`,
  },
  {
    id: "u-provider", name: "Patience Ogunleye", email: "patience@provider.healthlink.ng", role: "provider",
    phone: "+234 809 000 0025", lang: "en", createdAt: `2026-08-05T09:00:00.000Z`,
  },
  {
    id: "u-consumer", name: "Demo Patient", email: "demo@user.healthlink.ng", role: "consumer",
    phone: "+234 800 000 0000", lang: "en", createdAt: `2026-08-10T09:00:00.000Z`,
  },
];

export const seedTopics: ContentItem[] = TOPICS.map((t) => ({
  ...t,
  id: t.slug,
  status: "published" as const,
}));

export const seedProviders = PROVIDERS;

export const seedProviderRequests: ProviderRequest[] = [
  {
    id: "req-1", name: "Dr. Ngozi Eze", email: "ngozi@sunriseeye.ng",
    facility: "Sunrise Eye Clinic", category: "Clinic", state: "Lagos", lga: "Lagos Island",
    address: "8 Broad Street, Lagos Island", phone: "+234 810 123 4567",
    status: "pending", createdAt: `2026-09-25T09:00:00.000Z`,
  },
];

export const seedBookings: Booking[] = [
  {
    id: "bk-1", providerId: PROVIDER_SEED_ID, userId: "u-consumer",
    name: "Demo Patient", phone: "+234 800 000 0000",
    message: "I would like a BP check and routine consult.", date: todayIso(),
    status: "new", createdAt: todayIso(),
  },
  {
    id: "bk-2", providerId: null, userId: null, name: "Amina Yusuf",
    phone: "+234 802 333 4444", message: "Mobile clinic visit for my neighbourhood.",
    status: "new", createdAt: daysAgo(1),
  },
];

export const seedReports: Report[] = [
  {
    id: "rep-1", targetType: "provider", targetId: "lag-07",
    reason: "Outdated contact details", detail: "Phone number is no longer reachable.",
    status: "open", createdAt: daysAgo(2),
  },
];

export { todayIso };