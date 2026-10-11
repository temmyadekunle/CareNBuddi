/**
 * Menstrual Cycle Tracking Logic
 *
 * Pure functions for cycle calculations - no React, no DOM, no external deps.
 * All logic is testable and documented.
 */

export interface CycleCalculations {
  averageCycleLength: number | null;
  averagePeriodLength: number | null;
  nextPeriodStart: string | null;
  nextPeriodEnd: string | null;
  fertileWindowStart: string | null;
  fertileWindowEnd: string | null;
  ovulationDate: string | null;
  currentCycleDay: number | null;
  currentPhase: CyclePhase | null;
  cyclesUsed: number;
  isIrregular: boolean;
}

export type CyclePhase = "menstrual" | "follicular" | "ovulation" | "luteal";

/**
 * Calculate cycle statistics from recorded cycles.
 * Requires at least 2 completed cycles for estimates.
 */
export function calculateCycleStats(cycles: Array<{ startDate: string; endDate?: string }>): CycleCalculations {
  const completedCycles = cycles
    .filter((c) => c.endDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  if (completedCycles.length < 2) {
    return {
      averageCycleLength: null,
      averagePeriodLength: null,
      nextPeriodStart: null,
      nextPeriodEnd: null,
      fertileWindowStart: null,
      fertileWindowEnd: null,
      ovulationDate: null,
      currentCycleDay: null,
      currentPhase: null,
      cyclesUsed: completedCycles.length,
      isIrregular: false,
    };
  }

  // Calculate average cycle length (start to start)
  const cycleLengths: number[] = [];
  for (let i = 1; i < completedCycles.length; i++) {
    const prevStart = new Date(completedCycles[i - 1].startDate);
    const currStart = new Date(completedCycles[i].startDate);
    const diffDays = Math.round((currStart.getTime() - prevStart.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 0 && diffDays < 60) cycleLengths.push(diffDays);
  }

  // Calculate average period length
  const periodLengths: number[] = [];
  for (const cycle of completedCycles) {
    if (cycle.endDate) {
      const start = new Date(cycle.startDate);
      const end = new Date(cycle.endDate);
      const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (diffDays > 0 && diffDays <= 14) periodLengths.push(diffDays);
    }
  }

  const avgCycleLength = cycleLengths.length > 0
    ? Math.round(cycleLengths.reduce((a, b) => a + b, 0) / cycleLengths.length)
    : null;
  const avgPeriodLength = periodLengths.length > 0
    ? Math.round(periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length)
    : null;

  // Check for irregularity (cycle length variation > 7 days)
  const isIrregular = cycleLengths.length > 0 &&
    Math.max(...cycleLengths) - Math.min(...cycleLengths) > 7;

  // Predict next period based on last cycle start + average cycle length
  const lastCycle = completedCycles[completedCycles.length - 1];
  let nextPeriodStart: string | null = null;
  let nextPeriodEnd: string | null = null;
  let fertileWindowStart: string | null = null;
  let fertileWindowEnd: string | null = null;
  let ovulationDate: string | null = null;

  if (avgCycleLength && lastCycle) {
    const lastStart = new Date(lastCycle.startDate);
    const nextStart = new Date(lastStart);
    nextStart.setDate(nextStart.getDate() + avgCycleLength);
    nextPeriodStart = nextStart.toISOString().slice(0, 10);

    // Estimate period end
    const avgPeriod = avgPeriodLength ?? 5;
    const nextEnd = new Date(nextStart);
    nextEnd.setDate(nextEnd.getDate() + avgPeriod - 1);
    nextPeriodEnd = nextEnd.toISOString().slice(0, 10);

    // Estimate ovulation (typically 14 days before next period)
    const ovulation = new Date(nextStart);
    ovulation.setDate(ovulation.getDate() - 14);
    ovulationDate = ovulation.toISOString().slice(0, 10);

    // Fertile window: 5 days before ovulation to 1 day after
    const fwStart = new Date(ovulation);
    fwStart.setDate(fwStart.getDate() - 5);
    fertileWindowStart = fwStart.toISOString().slice(0, 10);

    const fwEnd = new Date(ovulation);
    fwEnd.setDate(fwEnd.getDate() + 1);
    fertileWindowEnd = fwEnd.toISOString().slice(0, 10);
  }

  // Calculate current cycle day and phase
  let currentCycleDay: number | null = null;
  let currentPhase: CyclePhase | null = null;

  if (lastCycle) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastStart = new Date(lastCycle.startDate);
    lastStart.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - lastStart.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays >= 0) {
      currentCycleDay = diffDays + 1;

      // Determine phase based on cycle day (using average cycle length or 28 as fallback)
      const cycleLen = avgCycleLength ?? 28;
      const periodLen = avgPeriodLength ?? 5;
      const ovulationDay = cycleLen - 14;

      if (currentCycleDay <= periodLen) {
        currentPhase = "menstrual";
      } else if (currentCycleDay === ovulationDay) {
        currentPhase = "ovulation";
      } else if (currentCycleDay > ovulationDay) {
        currentPhase = "luteal";
      } else {
        currentPhase = "follicular";
      }
    }
  }

  return {
    averageCycleLength: avgCycleLength,
    averagePeriodLength: avgPeriodLength,
    nextPeriodStart,
    nextPeriodEnd,
    fertileWindowStart,
    fertileWindowEnd,
    ovulationDate,
    currentCycleDay,
    currentPhase,
    cyclesUsed: completedCycles.length,
    isIrregular,
  };
}

/**
 * Get the current cycle phase label for display
 */
export function getPhaseLabel(phase: CyclePhase, t: (key: string, fallback: string) => string): string {
  switch (phase) {
    case "menstrual":
      return t("mh_phase_menstrual", "Menstrual");
    case "follicular":
      return t("mh_phase_follicular", "Follicular");
    case "ovulation":
      return t("mh_phase_ovulation", "Ovulation");
    case "luteal":
      return t("mh_phase_luteal", "Luteal");
    default:
      return t("mh_phase_unknown", "Unknown");
  }
}

/**
 * Get phase description for user education
 */
export function getPhaseDescription(phase: CyclePhase, t: (key: string, fallback: string) => string): string {
  switch (phase) {
    case "menstrual":
      return t("mh_phase_menstrual_d", "Your period has started. This is day 1 of your cycle.");
    case "follicular":
      return t("mh_phase_follicular_d", "Your body is preparing for ovulation. Estrogen is rising.");
    case "ovulation":
      return t("mh_phase_ovulation_d", "You are ovulating. This is your most fertile time.");
    case "luteal":
      return t("mh_phase_luteal_d", "After ovulation. Progesterone rises. PMS symptoms may appear.");
    default:
      return "";
  }
}

/**
 * Format date for display
 */
export function formatDate(dateStr: string, locale = "en-GB"): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format date with day of week
 */
export function formatDateWithDay(dateStr: string, locale = "en-GB"): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/**
 * Check if a date is today
 */
export function isToday(dateStr: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return dateStr === today;
}

/**
 * Check if a date is in the past
 */
export function isPast(dateStr: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return dateStr < today;
}

/**
 * Check if a date is in the future
 */
export function isFuture(dateStr: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return dateStr > today;
}