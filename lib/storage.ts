"use client";

import { useSyncExternalStore } from "react";
import type { JournalEntry, MedicalRecord, Reminder } from "./types";

export const KEYS = {
  journal: "healthlink:journal",
  records: "healthlink:records",
  reminders: "healthlink:reminders",
  fitnessProfile: "healthlink:fitness-profile",
  workouts: "healthlink:workouts",
  weighIns: "healthlink:weigh-ins",
  exerciseReminder: "healthlink:exercise-reminder",
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

function notify(key: string) {
  listeners.get(key)?.forEach((cb) => cb());
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

export { todayIso };