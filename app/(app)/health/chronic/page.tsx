"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";
import { KEYS, daysAgo, seedJournal, useStoredCollection } from "@/lib/storage";
import type { JournalEntry } from "@/lib/types";

const PROGRAMS = [
  {
    key: "hypertension",
    title: "Your Hypertension Journey",
    condition: "Hypertension",
    tasks: ["Record blood pressure", "Take blood pressure medication", "Read a heart-health tip"],
    tip: "Less salt, more walking — small daily choices protect your heart.",
    metric: (j: JournalEntry) => j.vitals.systolic && j.vitals.diastolic ? `${j.vitals.systolic}/${j.vitals.diastolic} mmHg` : null,
  },
  {
    key: "diabetes",
    title: "Your Diabetes Journey",
    condition: "Diabetes",
    tasks: ["Record blood glucose", "Log meals and activity", "Check feet today"],
    tip: "Consistent meals and daily movement help keep blood sugar steady.",
    metric: () => null,
  },
  {
    key: "sickle-cell",
    title: "Your Sickle-Cell Journey",
    condition: "Sickle-cell disease",
    tasks: ["Record symptoms today", "Drink plenty of water", "Note pain level (0–10)"],
    tip: "Stay hydrated and avoid extreme heat or intense exertion.",
    metric: () => null,
  },
  {
    key: "asthma",
    title: "Your Asthma Journey",
    condition: "Asthma",
    tasks: ["Log peak flow / symptoms", "Carry your reliever inhaler", "Note any triggers"],
    tip: "Know your triggers and keep your inhaler within reach.",
    metric: () => null,
  },
] as const;

export default function ChronicPage() {
  const t = useT();
  const [journal] = useStoredCollection<JournalEntry>(KEYS.journal, seedJournal);
  const recent = journal.filter((j) => j.date >= daysAgo(30));
  const bpReadings = recent.filter((j) => j.vitals.systolic && j.vitals.diastolic);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("cc_title", "Chronic Care Companion")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("cc_sub", "Daily structure and monthly insight for ongoing conditions.")}</p>

      <div className="mt-6 grid gap-4">
        {PROGRAMS.map((p) => (
          <section key={p.key} className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">{t(`cc_${p.key}`, p.title)}</h2>
              <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-medium text-brand-700">{p.condition}</span>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t("cc_today", "Today")}</h3>
                <ul className="mt-2 space-y-1">
                  {p.tasks.map((task) => (
                    <li key={task} className="text-sm text-slate-700">• {task}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl bg-brand-50 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-800">{t("cc_month", "This month")}</h3>
                <p className="mt-2 text-sm text-brand-900">
                  {p.key === "hypertension"
                    ? `${bpReadings.length} BP readings logged`
                    : `${recent.length} journal entries logged`}
                </p>
                {p.key === "hypertension" && bpReadings.length > 0 && (
                  <p className="mt-1 text-sm font-semibold text-brand-900">
                    {t("cc_latest", "Latest")}: {p.metric(bpReadings[bpReadings.length - 1])}
                  </p>
                )}
              </div>
              <div className="rounded-xl bg-amber-50 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-800">{t("cc_care", "Care")}</h3>
                <p className="mt-2 text-sm text-amber-900">{p.tip}</p>
                <Link href="/find-care" className="mt-2 inline-block text-xs font-semibold text-brand-700 hover:underline">
                  {t("cc_find", "Find a nearby facility →")}
                </Link>
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
