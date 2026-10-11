"use client";

import Link from "next/link";
import { Button, Card, Field, Screen, SectionHeader, inputClass, useToast } from "@/components/app-ui";
import { ActivityIcon, BrainIcon, CalendarIcon, MoonIcon, ZapIcon } from "@/components/icons";
import { SwitchRow } from "@/components/profile-settings";
import { useT } from "@/lib/i18n";
import { KEYS, useSession, useStoredCollection, useStoredValue, seedUsers } from "@/lib/storage";
import { DEFAULT_HEALTH_PREFERENCES } from "@/lib/types";

export default function DiaryPreferencesPage() {
  const t = useT();
  const { push } = useToast();
  const [session] = useSession();
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const [prefs, setPrefs] = useStoredValue(KEYS.healthPreferences, DEFAULT_HEALTH_PREFERENCES);

  const me = users.find((u) => u.id === session.userId);

  const set = <K extends keyof typeof prefs>(key: K, value: (typeof prefs)[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  if (!me) {
    return (
      <Screen>
        <Card className="mt-4 flex flex-col items-center gap-3 py-10 text-center">
          <h2 className="text-base font-semibold text-slate-900">
            {t("mh_guest_title", "Sign in to track your health")}
          </h2>
          <p className="max-w-[18rem] text-sm text-slate-500">
            {t("mh_guest_body", "Sign in and your diary, cycles and preferences follow you on every device.")}
          </p>
          <Link href="/auth/sign-in" className="mt-2 w-full max-w-[16rem]">
            <Button full>{t("mh_guest_cta", "Sign in or create account")}</Button>
          </Link>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionHeader
        title={t("hp_title", "Health tracking preferences")}
        subtitle={t("hp_sub", "Choose what you want to track. You can change this anytime.")}
      />

      <Card padded={false} className="mt-4 overflow-hidden divide-y divide-slate-100">
        <div className="px-4 py-1">
          <SwitchRow
            icon={<CalendarIcon className="h-5 w-5" />}
            tone="rose"
            title={t("hp_menstrual", "Menstrual cycle tracking")}
            subtitle={t("hp_menstrual_d", "Track periods, flow, symptoms and get cycle predictions.")}
            checked={prefs.menstrualTrackingEnabled}
            onChange={(next) => {
              set("menstrualTrackingEnabled", next);
              push(
                next
                  ? t("mh_cycle_on", "Cycle tracking turned on")
                  : t("mh_cycle_off", "Cycle tracking turned off"),
              );
            }}
          />
        </div>
        <div className="px-4 py-1">
          <SwitchRow
            icon={<BrainIcon className="h-5 w-5" />}
            tone="brand"
            title={t("hp_mood", "Mood tracking")}
            subtitle={t("hp_mood_d", "Log daily mood, sleep and energy levels.")}
            checked={prefs.moodTrackingEnabled}
            onChange={(next) => set("moodTrackingEnabled", next)}
          />
        </div>
        <div className="px-4 py-1">
          <SwitchRow
            icon={<ActivityIcon className="h-5 w-5" />}
            tone="green"
            title={t("hp_symptom", "Symptom tracking")}
            subtitle={t("hp_symptom_d", "Record symptoms, severity and trends over time.")}
            checked={prefs.symptomTrackingEnabled}
            onChange={(next) => set("symptomTrackingEnabled", next)}
          />
        </div>
        <div className="px-4 py-1">
          <SwitchRow
            icon={<MoonIcon className="h-5 w-5" />}
            tone="slate"
            title={t("hp_sleep", "Sleep tracking")}
            subtitle={t("hp_sleep_d", "Log sleep hours and quality.")}
            checked={prefs.sleepTrackingEnabled}
            onChange={(next) => set("sleepTrackingEnabled", next)}
          />
        </div>
        <div className="px-4 py-1">
          <SwitchRow
            icon={<ZapIcon className="h-5 w-5" />}
            tone="amber"
            title={t("hp_energy", "Energy tracking")}
            subtitle={t("hp_energy_d", "Track daily energy levels.")}
            checked={prefs.energyTrackingEnabled}
            onChange={(next) => set("energyTrackingEnabled", next)}
          />
        </div>
      </Card>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        {t(
          "hp_independent_note",
          "Menstrual tracking is independent of any profile field. Turn it on only if you want it — nothing else changes.",
        )}
      </p>

      {prefs.menstrualTrackingEnabled && (
        <Card className="mt-4">
          <SectionHeader title={t("hp_cycle_defaults", "Cycle defaults")} subtitle={t("hp_cycle_defaults_d", "Used only until your own history takes over.")} />
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <Field label={t("hp_cycle_length", "Average cycle length")}>
              <input
                type="number"
                inputMode="numeric"
                min={15}
                max={60}
                value={prefs.cycleLength ?? ""}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  set("cycleLength", Number.isFinite(v) ? v : undefined);
                }}
                placeholder={t("hp_cycle_length_ph", "e.g. 28")}
                className={`${inputClass} min-h-11`}
              />
            </Field>
            <Field label={t("hp_period_length", "Average period length")}>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={14}
                value={prefs.periodLength ?? ""}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  set("periodLength", Number.isFinite(v) ? v : undefined);
                }}
                placeholder={t("hp_period_length_ph", "e.g. 5")}
                className={`${inputClass} min-h-11`}
              />
            </Field>
          </div>
          <div className="mt-3">
            <Field label={t("hp_last_period", "Last period start")}>
              <input
                type="date"
                value={prefs.lastPeriodStart ?? ""}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => set("lastPeriodStart", e.target.value || undefined)}
                className={`${inputClass} min-h-11`}
              />
            </Field>
          </div>
        </Card>
      )}

      <Card className="mt-4">
        <SwitchRow
          icon={<CalendarIcon className="h-5 w-5" />}
          tone="brand"
          title={t("hp_reminders", "Daily reminders")}
          subtitle={t("hp_reminders_d", "Get a gentle nudge to log your day.")}
          checked={prefs.remindersEnabled}
          onChange={(next) => set("remindersEnabled", next)}
        />
        {prefs.remindersEnabled && (
          <div className="mt-1 px-1 pb-2">
            <Field label={t("hp_reminder_time", "Reminder time")}>
              <input
                type="time"
                value={prefs.reminderTime ?? "20:00"}
                onChange={(e) => set("reminderTime", e.target.value || undefined)}
                className={`${inputClass} min-h-11`}
              />
            </Field>
          </div>
        )}
      </Card>

      <div className="mt-4 flex gap-2">
        <Link href="/health/diary" className="flex-1">
          <Button full>{t("hp_done", "Done")}</Button>
        </Link>
      </div>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">
        {t("mh_disclaimer", "My Health Diary is for personal tracking only. It does not provide medical advice, diagnosis, or treatment. Always consult a healthcare professional for medical concerns.")}
      </p>
    </Screen>
  );
}
