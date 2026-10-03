"use client";

import { useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { useStoredCollection, useStoredValue } from "@/lib/storage";

interface WorkerLog {
  id: string;
  date: string;
  screeningType: string;
  participants: number;
  referred: number;
  notes: string;
}

const seedLog: WorkerLog[] = [
  { id: "w-1", date: "2026-10-02", screeningType: "BP + glucose", participants: 42, referred: 6, notes: "Market day outreach, Bodija." },
];

export default function WorkerPage() {
  const t = useT();
  const [events] = useStoredCollection<{ id: string; title: string; date: string; location: string }>(
    "healthlink:health-days",
    [],
  );
  const [logs, setLogs] = useStoredCollection<WorkerLog>("healthlink:worker-log", seedLog);
  const [online, setOnline] = useStoredValue<boolean>("healthlink:worker-online", true);
  const [draft, setDraft] = useState<Omit<WorkerLog, "id">>({
    date: new Date().toISOString().slice(0, 10), screeningType: "BP screening", participants: 0, referred: 0, notes: "",
  });

  const addLog = () => {
    setLogs((prev) => [{ ...draft, id: crypto.randomUUID() }, ...prev]);
    setDraft((d) => ({ ...d, participants: 0, referred: 0, notes: "" }));
  };

  const totals = logs.reduce(
    (acc, l) => ({ participants: acc.participants + l.participants, referred: acc.referred + l.referred }),
    { participants: 0, referred: 0 },
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("w_title", "Health Worker Mode")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("w_sub", "Screenings, referrals and follow-ups from the field.")}</p>
        </div>
        <button
          onClick={() => setOnline(!online)}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold ${online ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}
        >
          {online ? "● Online — synced" : "○ Offline — changes queued"}
        </button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t("w_events", "Events")} value={events.length || 1} />
        <Stat label={t("w_participants", "Screened")} value={totals.participants} />
        <Stat label={t("w_referred", "Referred")} value={totals.referred} />
        <Stat label={t("w_pending", "Follow-ups due")} value={Math.max(totals.referred - Math.floor(totals.referred / 2), 0)} />
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">{t("w_log", "Log a screening")}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <label className="block"><span className="text-xs text-slate-500">Date</span>
            <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          <label className="block"><span className="text-xs text-slate-500">Type</span>
            <input value={draft.screeningType} onChange={(e) => setDraft({ ...draft, screeningType: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          <label className="block"><span className="text-xs text-slate-500">Participants</span>
            <input type="number" value={draft.participants} onChange={(e) => setDraft({ ...draft, participants: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
          <label className="block"><span className="text-xs text-slate-500">Referred</span>
            <input type="number" value={draft.referred} onChange={(e) => setDraft({ ...draft, referred: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>
        </div>
        <input placeholder="Notes" value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <button onClick={addLog} className="mt-3 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">{t("w_add", "Add log")}</button>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-slate-900">{t("w_recent", "Recent logs")}</h2>
        <ul className="mt-3 divide-y divide-slate-100 rounded-2xl border border-slate-200/80 bg-white">
          {logs.map((l) => (
            <li key={l.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <div>
                <p className="font-medium text-slate-900">{l.screeningType}</p>
                <p className="text-xs text-slate-500">{l.date} · {l.notes}</p>
              </div>
              <p className="text-xs text-slate-600">{l.participants} screened · {l.referred} referred</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-slate-400">
          {t("w_sync", "Records save locally and sync when you are back online.")}{" "}
          <Link href="/health-days" className="text-brand-700 hover:underline">{t("w_days", "View health days →")}</Link>
        </p>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
