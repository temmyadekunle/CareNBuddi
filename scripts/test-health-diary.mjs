// Pure-logic tests for My Health Diary: lib/cycle.ts + diary data model.
// Run with: node scripts/test-health-diary.mjs  (Node 22.6+ strips types)
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const cycle = await import("../lib/cycle.ts");
const types = await import("../lib/types.ts");
const {
  calculateCycleStats,
  formatDate,
  isToday,
  isPast,
  isFuture,
} = cycle;
const {
  DEFAULT_HEALTH_PREFERENCES,
  MOOD_TYPES,
  COMMON_SYMPTOMS,
} = types;

let passed = 0;
const failures = [];
function check(name, fn) {
  try {
    const out = fn();
    if (out instanceof Promise) return out.then(
      () => { passed += 1; console.log(`  ok   ${name}`); },
      (err) => { failures.push(name); console.log(`  FAIL ${name}\n       ${err.message}`); },
    );
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push(name);
    console.log(`  FAIL ${name}\n       ${err.message}`);
  }
}

const isoToday = () => new Date().toISOString().slice(0, 10);
const daysAgoIso = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
const plusDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

console.log("health-diary: cycle calculations");

check("fewer than 2 cycles yields no estimates", () => {
  const empty = calculateCycleStats([]);
  assert.equal(empty.nextPeriodStart, null);
  assert.equal(empty.ovulationDate, null);
  assert.equal(empty.cyclesUsed, 0);
  const one = calculateCycleStats([{ startDate: daysAgoIso(10), endDate: daysAgoIso(6) }]);
  assert.equal(one.nextPeriodStart, null);
  assert.equal(one.cyclesUsed, 1);
  assert.equal(one.averageCycleLength, null);
});

check("two regular 28-day cycles predict next period and ovulation", () => {
  const c1 = daysAgoIso(56);
  const c2 = daysAgoIso(28);
  const stats = calculateCycleStats([
    { startDate: c1, endDate: plusDays(c1, 4) },
    { startDate: c2, endDate: plusDays(c2, 4) },
  ]);
  assert.equal(stats.averageCycleLength, 28);
  assert.equal(stats.averagePeriodLength, 5);
  assert.equal(stats.nextPeriodStart, plusDays(c2, 28));
  assert.equal(stats.ovulationDate, plusDays(c2, 14));
  assert.equal(stats.fertileWindowStart, plusDays(c2, 9));
  assert.equal(stats.fertileWindowEnd, plusDays(c2, 15));
  assert.equal(stats.cyclesUsed, 2);
  assert.equal(stats.isIrregular, false);
});

check("irregular cycles are flagged, wild gaps ignored", () => {
  const c1 = daysAgoIso(70);
  const c2 = daysAgoIso(42);
  const c3 = daysAgoIso(28);
  const stats = calculateCycleStats([
    { startDate: c1, endDate: plusDays(c1, 4) },
    { startDate: c2, endDate: plusDays(c2, 4) },
    { startDate: c3, endDate: plusDays(c3, 4) },
  ]);
  // gaps: 28 and 14 -> spread 14 > 7
  assert.equal(stats.isIrregular, true);
  assert.equal(stats.cyclesUsed, 3);
  const far = calculateCycleStats([
    { startDate: "2020-01-01", endDate: "2020-01-05" },
    { startDate: daysAgoIso(28), endDate: plusDays(daysAgoIso(28), 4) },
  ]);
  assert.equal(far.averageCycleLength, null);
  assert.equal(far.nextPeriodStart, null);
});

check("current cycle day and phase derive from last start", () => {
  const start = daysAgoIso(2);
  const stats = calculateCycleStats([
    { startDate: daysAgoIso(30), endDate: plusDays(daysAgoIso(30), 4) },
    { startDate: start, endDate: plusDays(start, 4) },
  ]);
  assert.equal(stats.currentCycleDay, 3);
  assert.equal(stats.currentPhase, "menstrual");
  const old = calculateCycleStats([
    { startDate: daysAgoIso(41), endDate: plusDays(daysAgoIso(41), 4) },
    { startDate: daysAgoIso(13), endDate: plusDays(daysAgoIso(13), 4) },
  ]);
  assert.equal(old.currentCycleDay, 14);
  assert.equal(old.currentPhase, "ovulation");
});

check("date helpers behave", () => {
  assert.equal(isToday(isoToday()), true);
  assert.equal(isPast(daysAgoIso(1)), true);
  assert.equal(isPast(isoToday()), false);
  assert.equal(isFuture(plusDays(isoToday(), 1)), true);
  assert.equal(isFuture(isoToday()), false);
  assert.match(formatDate("2026-01-05"), /5 Jan 2026/);
});

console.log("health-diary: data model honesty");

check("menstrual tracking is opt-in and independent", () => {
  assert.equal(DEFAULT_HEALTH_PREFERENCES.menstrualTrackingEnabled, false);
  assert.equal(DEFAULT_HEALTH_PREFERENCES.moodTrackingEnabled, true);
  assert.equal(DEFAULT_HEALTH_PREFERENCES.symptomTrackingEnabled, true);
});

check("mood options cover the required set", () => {
  const values = MOOD_TYPES.map((m) => m.value);
  for (const need of ["happy", "calm", "sad", "anxious", "stressed", "irritable", "lonely", "tired", "overwhelmed", "hopeful", "other"]) {
    assert.ok(values.includes(need), `missing mood ${need}`);
  }
});

check("symptom suggestions exist and storage keys are wired", () => {
  assert.ok(COMMON_SYMPTOMS.length >= 10, "too few suggestions");
  const src = readFileSync(new URL("../lib/storage.ts", import.meta.url), "utf8");
  for (const key of ["menstrual-cycles", "mood-entries", "symptom-entries", "health-preferences"]) {
    assert.ok(src.includes(key), `missing storage key ${key}`);
  }
});

check("cycle page never invents predictions without history", async () => {
  const src = readFileSync(new URL("../app/(app)/health/diary/cycle/page.tsx", import.meta.url), "utf8");
  assert.ok(src.includes("Estimates only"), "missing estimates disclaimer");
  assert.ok(src.includes("must not be treated as reliable contraception"), "missing contraception warning");
  assert.ok(src.includes("Log at least two completed periods"), "missing insufficient-history copy");
  assert.ok(!src.includes("PMS") || src.includes("PMS symptoms may appear"), "unexpected diagnosis language");
});

/* ---------------------------------------------------------------- summary */

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
