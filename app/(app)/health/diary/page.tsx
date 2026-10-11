"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  Badge,
  Button,
  Card,
  Screen,
  SectionHeader,
} from "@/components/app-ui";
import {
  ActivityIcon,
  BrainIcon,
  CalendarIcon,
  ChevronRightIcon,
  PlusIcon,
  SparklesIcon,
} from "@/components/icons";
import { useT } from "@/lib/i18n";
import { KEYS, seedMenstrualCycles, seedMoodEntries, seedSymptomEntries, seedUsers, useSession, useStoredCollection, useStoredValue } from "@/lib/storage";
import { DEFAULT_HEALTH_PREFERENCES } from "@/lib/types";
import { calculateCycleStats } from "@/lib/cycle";

export default function MyHealthDiaryPage() {
  const t = useT();
  const [session] = useSession();
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const [cycles] = useStoredCollection(KEYS.menstrualCycles, seedMenstrualCycles);
  const [moodEntries] = useStoredCollection(KEYS.moodEntries, seedMoodEntries);
  const [symptomEntries] = useStoredCollection(KEYS.symptomEntries, seedSymptomEntries);
  const [preferences] = useStoredValue(KEYS.healthPreferences, DEFAULT_HEALTH_PREFERENCES);

  const me = users.find((u) => u.id === session.userId);

  // Calculate cycle stats
  const cycleStats = useMemo(() => calculateCycleStats(cycles), [cycles]);

  // Get recent entries
  const recentMoods = useMemo(
    () => [...moodEntries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3),
    [moodEntries]
  );
  const recentSymptoms = useMemo(
    () => [...symptomEntries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3),
    [symptomEntries]
  );
  const recentCycles = useMemo(
    () => [...cycles].sort((a, b) => b.startDate.localeCompare(a.startDate)).slice(0, 2),
    [cycles]
  );

  if (!me) {
    return (
      <Screen>
        <Card className="mt-4 flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            <SparklesIcon className="h-6 w-6" />
          </span>
          <h2 className="text-base font-semibold text-slate-900">
            {t("mh_guest_title", "Sign in to track your health")}
          </h2>
          <p className="max-w-[18rem] text-sm text-slate-500">
            {t("mh_guest_body", "Sign in and your diary, cycles and preferences follow you on every device.")}
          </p>
          <Link href="/auth/sign-in" className="mt-2 w-full max-w-[16rem]">
            <Button full>{t("mh_guest_cta", "Sign in or create account")}</Button>
          </Link>
          <Link href="/app" className="text-xs font-semibold text-slate-500">
            {t("mh_continue_guest", "Continue as guest")}
          </Link>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionHeader
        title={t("mh_title", "My Health Diary")}
        subtitle={t("mh_sub", "Track your cycle, mood, symptoms and wellbeing in one place.")}
        action={t("mh_prefs", "Preferences")}
        href="/health/diary/preferences"
      />

      {/* Tracking overview cards */}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <Link href="/health/diary/mood" className="block">
          <Card className="p-3.5 hover:border-brand-300 transition-colors">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <BrainIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {t("mh_mood_title", "Mood")}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {recentMoods.length > 0
                    ? t("mh_recent_entries", "{n} recent").replace("{n}", String(recentMoods.length))
                    : t("mh_no_entries", "No entries yet")}
                </p>
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between">
              <Badge tone={preferences.moodTrackingEnabled ? "green" : "slate"}>
                {preferences.moodTrackingEnabled ? t("mh_enabled", "On") : t("mh_disabled", "Off")}
              </Badge>
              <span className="text-xs text-slate-400">{t("mh_tap_to_log", "Tap to log")}</span>
            </div>
          </Card>
        </Link>

        <Link href="/health/diary/symptoms" className="block">
          <Card className="p-3.5 hover:border-brand-300 transition-colors">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                <ActivityIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {t("mh_symptoms_title", "Symptoms")}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {recentSymptoms.length > 0
                    ? t("mh_recent_entries", "{n} recent").replace("{n}", String(recentSymptoms.length))
                    : t("mh_no_entries", "No entries yet")}
                </p>
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between">
              <Badge tone={preferences.symptomTrackingEnabled ? "green" : "slate"}>
                {preferences.symptomTrackingEnabled ? t("mh_enabled", "On") : t("mh_disabled", "Off")}
              </Badge>
              <span className="text-xs text-slate-400">{t("mh_tap_to_log", "Tap to log")}</span>
            </div>
          </Card>
        </Link>

        <Link href="/health/diary/cycle" className="block">
          <Card className="p-3.5 hover:border-brand-300 transition-colors">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-50 text-pink-700">
                <CalendarIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {t("mh_cycle_title", "Cycle")}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {cycleStats.currentCycleDay
                    ? t("mh_day_of_cycle", "Day {n}").replace("{n}", String(cycleStats.currentCycleDay))
                    : recentCycles.length > 0
                    ? t("mh_recent_cycles", "{n} recorded").replace("{n}", String(cycles.length))
                    : t("mh_no_cycles", "Not started")}
                </p>
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between">
              <Badge tone={preferences.menstrualTrackingEnabled ? "green" : "slate"}>
                {preferences.menstrualTrackingEnabled ? t("mh_enabled", "On") : t("mh_disabled", "Off")}
              </Badge>
              <span className="text-xs text-slate-400">{t("mh_tap_to_log", "Tap to log")}</span>
            </div>
          </Card>
        </Link>

        <Link href="/health/diary/preferences" className="block">
          <Card className="p-3.5 hover:border-brand-300 transition-colors">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                <SparklesIcon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {t("mh_prefs_title", "Preferences")}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {t("mh_prefs_sub", "Customize what you track")}
                </p>
              </div>
            </div>
            <div className="mt-2.5 flex items-center justify-between">
              <Badge tone="brand">{t("mh_manage", "Manage")}</Badge>
              <span className="text-xs text-slate-400">{t("mh_tap_to_open", "Tap to open")}</span>
            </div>
          </Card>
        </Link>
      </div>

      {/* Cycle insights */}
      {preferences.menstrualTrackingEnabled && (cycles.length > 0 || cycleStats.nextPeriodStart) && (
        <Card className="mt-4 border-pink-200 bg-pink-50/70">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-600 text-white">
              <CalendarIcon className="h-5 w-5" />
            </span>
            <h2 className="text-base font-semibold text-pink-900">{t("mh_cycle_insights", "Cycle insights")}</h2>
          </div>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {cycleStats.nextPeriodStart && (
              <div className="rounded-xl border border-pink-100 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-pink-600">
                  {t("mh_next_period", "Next period")}
                </p>
                <p className="mt-1 text-lg font-bold text-pink-800">
                  {new Date(cycleStats.nextPeriodStart).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                </p>
                {cycleStats.nextPeriodEnd && (
                  <p className="mt-0.5 text-[11px] text-pink-600">
                    {t("mh_until", "Until")} {new Date(cycleStats.nextPeriodEnd).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </p>
                )}
              </div>
            )}

            {/* Ovulation */}
            {cycleStats.ovulationDate && (
              <div className="rounded-xl border border-green-100 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-green-600">
                  {t("mh_ovulation", "Estimated ovulation")}
                </p>
                <p className="mt-1 text-lg font-bold text-green-800">
                  {new Date(cycleStats.ovulationDate).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                </p>
                <p className="mt-0.5 text-[11px] text-green-600">
                  {t("mh_fertile_window", "Fertile window")} {cycleStats.fertileWindowStart && cycleStats.fertileWindowEnd ? `${new Date(cycleStats.fertileWindowStart).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${new Date(cycleStats.fertileWindowEnd).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}
                </p>
              </div>
            )}

            {cycleStats.currentCycleDay && cycleStats.currentPhase && (
              <div className="rounded-xl border border-slate-100 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  {t("mh_current_phase", "Current phase")}
                </p>
                <p className="mt-1 text-lg font-bold text-slate-900">
                  {cycleStats.currentPhase.charAt(0).toUpperCase() + cycleStats.currentPhase.slice(1)}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {t("mh_day_of_cycle", "Day {n}").replace("{n}", String(cycleStats.currentCycleDay))}
                </p>
              </div>
            )}

            {cycleStats.averageCycleLength && (
              <div className="rounded-xl border border-slate-100 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  {t("mh_avg_cycle", "Avg cycle")}
                </p>
                <p className="mt-1 text-lg font-bold text-slate-900">
                  {cycleStats.averageCycleLength} {t("mh_days", "days")}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {cycleStats.isIrregular ? t("mh_irregular", "Irregular pattern detected") : t("mh_regular", "Regular pattern")}
                </p>
              </div>
            )}
          </div>

          {cycleStats.isIrregular && (
            <p className="mt-3 text-[11px] text-amber-700 bg-amber-50 rounded-xl p-2.5">
              ⚠ {t("mh_irregular_note", "Your cycles vary by more than 7 days. Consider discussing with a healthcare provider.")}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/health/diary/cycle">
              <Button className="min-h-11">{t("mh_view_cycle", "View cycle tracker")}</Button>
            </Link>
            <Link href="/health/diary/cycle">
              <Button tone="secondary" className="min-h-11">
                <PlusIcon className="h-4 w-4 mr-1" />
                {t("mh_add_period", "Log period")}
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Recent mood entries */}
      {preferences.moodTrackingEnabled && recentMoods.length > 0 && (
        <Card className="mt-4">
          <SectionHeader
            title={t("mh_recent_moods", "Recent moods")}
            action={t("mh_view_all", "View all")}
            href="/health/diary/mood"
          />
          <div className="space-y-2">
            {recentMoods.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                  <BrainIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {entry.mood.charAt(0).toUpperCase() + entry.mood.slice(1)}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {new Date(entry.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                    {entry.time && ` · ${entry.time}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                    {entry.intensity}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <Link href="/health/diary/mood" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
              {t("mh_view_all", "View all")}
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </Card>
      )}

      {/* Recent symptom entries */}
      {preferences.symptomTrackingEnabled && recentSymptoms.length > 0 && (
        <Card className="mt-4">
          <SectionHeader
            title={t("mh_recent_symptoms", "Recent symptoms")}
            action={t("mh_view_all", "View all")}
            href="/health/diary/symptoms"
          />
          <div className="space-y-2">
            {recentSymptoms.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${entry.severity === "severe" ? "bg-red-50 text-red-700" : entry.severity === "moderate" ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"}`}>
                  <ActivityIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">{entry.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {new Date(entry.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                    {entry.time && ` · ${entry.time}`}
                  </p>
                </div>
                <Badge tone={entry.severity === "severe" ? "rose" : entry.severity === "moderate" ? "amber" : "green"}>
                  {entry.severity.charAt(0).toUpperCase() + entry.severity.slice(1)}
                </Badge>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <Link href="/health/diary/symptoms" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
              {t("mh_view_all", "View all")}
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </Card>
      )}

      {/* Quick actions */}
      <SectionHeader title={t("mh_quick_actions", "Quick actions")} />
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Link href="/health/diary/mood" className="block">
          <Card className="p-3.5 text-center hover:border-brand-300">
            <span className="flex h-10 w-10 mx-auto items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <PlusIcon className="h-5 w-5" />
            </span>
            <p className="mt-2 text-sm font-semibold text-slate-900">{t("mh_log_mood", "Log mood")}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{t("mh_log_mood_d", "How are you feeling?")}</p>
          </Card>
        </Link>
        <Link href="/health/diary/symptoms" className="block">
          <Card className="p-3.5 text-center hover:border-brand-300">
            <span className="flex h-10 w-10 mx-auto items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <PlusIcon className="h-5 w-5" />
            </span>
            <p className="mt-2 text-sm font-semibold text-slate-900">{t("mh_log_symptom", "Log symptom")}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{t("mh_log_symptom_d", "Record a symptom")}</p>
          </Card>
        </Link>
        <Link href="/health/diary/cycle" className="block">
          <Card className="p-3.5 text-center hover:border-brand-300">
            <span className="flex h-10 w-10 mx-auto items-center justify-center rounded-xl bg-pink-50 text-pink-700">
              <PlusIcon className="h-5 w-5" />
            </span>
            <p className="mt-2 text-sm font-semibold text-slate-900">{t("mh_log_period", "Log period")}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{t("mh_log_period_d", "Start or end period")}</p>
          </Card>
        </Link>
      </div>

      {/* Disclaimer */}
      <p className="mt-6 text-center text-[11px] leading-relaxed text-slate-400">
        {t("mh_disclaimer", "My Health Diary is for personal tracking only. It does not provide medical advice, diagnosis, or treatment. Always consult a healthcare professional for medical concerns.")}
      </p>
    </Screen>
  );
}