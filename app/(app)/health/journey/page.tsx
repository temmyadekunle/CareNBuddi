"use client";

import { useT } from "@/lib/i18n";
import { KEYS, seedBookings, seedJournal, seedRecords, useStoredCollection } from "@/lib/storage";
import type { Booking, JournalEntry, MedicalRecord } from "@/lib/types";

interface JourneyEvent {
  date: string;
  title: string;
  detail: string;
  tone: "slate" | "brand" | "green" | "amber";
}

export default function JourneyPage() {
  const t = useT();
  const [journal] = useStoredCollection<JournalEntry>(KEYS.journal, seedJournal);
  const [records] = useStoredCollection<MedicalRecord>(KEYS.records, seedRecords);
  const [bookings] = useStoredCollection<Booking>(KEYS.bookings, seedBookings);

  const events: JourneyEvent[] = [];
  for (const j of journal) {
    const bp = j.vitals.systolic && j.vitals.diastolic ? ` · BP ${j.vitals.systolic}/${j.vitals.diastolic}` : "";
    events.push({ date: j.date, title: "Health journal", detail: `Mood: ${j.mood}${bp}${j.symptoms.length ? ` · ${j.symptoms.join(", ")}` : ""}`, tone: "brand" });
  }
  for (const r of records) {
    events.push({ date: r.date, title: r.title, detail: `${r.category} · ${r.provider}`, tone: "green" });
  }
  for (const b of bookings) {
    events.push({ date: b.date ?? b.createdAt, title: "Care request", detail: b.message, tone: "amber" });
  }
  events.push({ date: "2026-09-15", title: "Community screening", detail: "Know Your Numbers outreach event", tone: "green" });
  events.push({ date: "2026-09-15", title: "Referred to PHC", detail: "Flagged BP reading during screening", tone: "amber" });
  events.sort((a, b) => (a.date < b.date ? 1 : -1));

  const dot = { slate: "bg-slate-300", brand: "bg-brand-500", green: "bg-emerald-500", amber: "bg-amber-500" };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("jt_title", "Your Health Journey")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("jt_sub", "Everything that has happened, in one timeline.")}</p>

      <ol className="mt-8 border-l border-slate-200 pl-6">
        {events.map((e, i) => (
          <li key={i} className="relative mb-6">
            <span className={`absolute -left-[29px] top-1.5 h-3 w-3 rounded-full ${dot[e.tone]}`} />
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{e.date}</p>
            <p className="text-sm font-semibold text-slate-900">{e.title}</p>
            <p className="text-sm text-slate-600">{e.detail}</p>
          </li>
        ))}
      </ol>
    </main>
  );
}
