"use client";

import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  ListRow,
  Screen,
  SectionHeader,
  useToast,
} from "@/components/app-ui";
import { ActivityIcon, ClockIcon, HeartPulseIcon, PillIcon, StethoscopeIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { KEYS, daysAgo, seedJournal, useStoredCollection } from "@/lib/storage";
import type { JournalEntry } from "@/lib/types";

const PROGRAMS = [
  {
    key: "hypertension",
    icon: HeartPulseIcon,
    journeyKey: "chx_journey_hypertension",
    journey: "Your hypertension journey",
    condKey: "chx_cond_hypertension",
    cond: "Hypertension",
    badgeKey: "chx_badge_hypertension",
    badge: "BP Care",
    tasks: [
      { key: "chx_task_hypertension_bp", en: "Record blood pressure" },
      { key: "chx_task_hypertension_med", en: "Take blood pressure medication" },
      { key: "chx_task_hypertension_tip", en: "Read a heart-health tip" },
    ],
    tipKey: "chx_tip_hypertension",
    tip: "Less salt, more walking — small daily choices protect your heart.",
    metric: (j: JournalEntry) =>
      j.vitals.systolic && j.vitals.diastolic
        ? `${j.vitals.systolic}/${j.vitals.diastolic} mmHg`
        : null,
  },
  {
    key: "diabetes",
    icon: ActivityIcon,
    journeyKey: "chx_journey_diabetes",
    journey: "Your diabetes journey",
    condKey: "chx_cond_diabetes",
    cond: "Diabetes",
    badgeKey: "chx_badge_diabetes",
    badge: "Sugar Care",
    tasks: [
      { key: "chx_task_diabetes_glucose", en: "Record blood glucose" },
      { key: "chx_task_diabetes_meals", en: "Log meals and activity" },
      { key: "chx_task_diabetes_feet", en: "Check feet today" },
    ],
    tipKey: "chx_tip_diabetes",
    tip: "Consistent meals and daily movement help keep blood sugar steady.",
    metric: () => null,
  },
  {
    key: "sickle-cell",
    icon: ClockIcon,
    journeyKey: "chx_journey_sickle",
    journey: "Your sickle-cell journey",
    condKey: "chx_cond_sickle",
    cond: "Sickle-cell disease",
    badgeKey: "chx_badge_sickle",
    badge: "Symptom Care",
    tasks: [
      { key: "chx_task_sickle_symp", en: "Record symptoms today" },
      { key: "chx_task_sickle_water", en: "Drink plenty of water" },
      { key: "chx_task_sickle_pain", en: "Note pain level (0–10)" },
    ],
    tipKey: "chx_tip_sickle",
    tip: "Stay hydrated and avoid extreme heat or intense exertion.",
    metric: () => null,
  },
  {
    key: "asthma",
    icon: StethoscopeIcon,
    journeyKey: "chx_journey_asthma",
    journey: "Your asthma journey",
    condKey: "chx_cond_asthma",
    cond: "Asthma",
    badgeKey: "chx_badge_asthma",
    badge: "Breathing Care",
    tasks: [
      { key: "chx_task_asthma_peak", en: "Log peak flow / symptoms" },
      { key: "chx_task_asthma_inhaler", en: "Carry your reliever inhaler" },
      { key: "chx_task_asthma_trigger", en: "Note any triggers" },
    ],
    tipKey: "chx_tip_asthma",
    tip: "Know your triggers and keep your inhaler within reach.",
    metric: () => null,
  },
] as const;

export default function ChronicPage() {
  const t = useT();
  const { push } = useToast();
  const [journal] = useStoredCollection<JournalEntry>(KEYS.journal, seedJournal);
  const recent = journal.filter((j) => j.date >= daysAgo(30));
  const bpReadings = recent.filter((j) => j.vitals.systolic && j.vitals.diastolic);

  return (
    <Screen>
      <SectionHeader
        title={t("chx_title", "Chronic Care Companion")}
        subtitle={t("chx_sub", "Daily structure and monthly insight for ongoing conditions.")}
      />

      <div className="mt-4 grid gap-3">
        {PROGRAMS.map((p) => {
          const Icon = p.icon;
          const latestBp = bpReadings.length > 0 ? p.metric(bpReadings[bpReadings.length - 1]) : null;
          return (
            <Card key={p.key} className="overflow-hidden">
              <div className="flex items-start gap-3 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold text-slate-900">{t(p.journeyKey, p.journey)}</h2>
                      <p className="mt-0.5 text-xs text-slate-500">{t(p.condKey, p.cond)}</p>
                    </div>
                    <Badge tone="brand">{t(p.badgeKey, p.badge)}</Badge>
                  </div>

                  <div className="mt-3 grid gap-2">
                    <ListRow
                      icon={<ClockIcon className="h-5 w-5 text-slate-400" />}
                      title={t("chx_today", "Today")}
                      meta={
                        <ul className="space-y-0.5 text-right text-xs text-slate-500">
                          {p.tasks.map((task) => (
                            <li key={task.key}>• {t(task.key, task.en)}</li>
                          ))}
                        </ul>
                      }
                    />
                    <ListRow
                      icon={<PillIcon className="h-5 w-5 text-slate-400" />}
                      title={t("chx_month", "This month")}
                      meta={
                        <div className="text-right text-xs text-slate-600">
                          <p>
                            {p.key === "hypertension"
                              ? `${bpReadings.length} ${t("chx_bp_logged", "BP readings logged")}`
                              : `${recent.length} ${t("chx_entries_logged", "journal entries logged")}`}
                          </p>
                          {latestBp && (
                            <p className="mt-0.5 font-medium">
                              {t("chx_latest", "Latest")}: {latestBp}
                            </p>
                          )}
                        </div>
                      }
                    />
                    <ListRow
                      icon={<StethoscopeIcon className="h-5 w-5 text-slate-400" />}
                      title={t("chx_care", "Care")}
                      meta={
                        <p className="max-w-[180px] text-right text-xs text-slate-600">{t(p.tipKey, p.tip)}</p>
                      }
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href="/find-care">
                      <Button tone="secondary" className="min-h-11 px-4 text-sm">
                        {t("chx_find", "Find a nearby facility")}
                      </Button>
                    </Link>
                    <Button
                      tone="ghost"
                      className="min-h-11 px-4 text-sm"
                      onClick={() => push(t("chx_reminder_set", "Reminder set for this plan"))}
                    >
                      {t("chx_remind", "Remind me")}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </Screen>
  );
}