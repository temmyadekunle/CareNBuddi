"use client";

import { Badge, Card, EmptyState, Screen, SectionHeader } from "@/components/app-ui";
import { ActivityIcon, CalendarIcon, FileTextIcon } from "@/components/icons";
import { fullDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { KEYS, seedBookings, seedJournal, seedRecords, useStoredCollection } from "@/lib/storage";
import type { Booking, JournalEntry, MedicalRecord } from "@/lib/types";
import { RECORD_CATEGORIES } from "@/lib/types";

interface JourneyEvent {
  date: string;
  title: string;
  detail: string;
  tone: "slate" | "brand" | "green" | "amber";
}

const DOT: Record<JourneyEvent["tone"], string> = {
  slate: "bg-slate-300",
  brand: "bg-brand-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
};

const CAT_LABEL: Record<string, string> = Object.fromEntries(
  RECORD_CATEGORIES.map((c) => [c.value, c.label]),
);

export default function JourneyPage() {
  const t = useT();
  const [journal] = useStoredCollection<JournalEntry>(KEYS.journal, seedJournal);
  const [records] = useStoredCollection<MedicalRecord>(KEYS.records, seedRecords);
  const [bookings] = useStoredCollection<Booking>(KEYS.bookings, seedBookings);

  const events: JourneyEvent[] = [];
  for (const j of journal) {
    const bp =
      j.vitals.systolic && j.vitals.diastolic ? ` · BP ${j.vitals.systolic}/${j.vitals.diastolic}` : "";
    events.push({
      date: j.date,
      title: t("jyx_journal", "Health journal"),
      detail: `${t("jyx_mood", "Mood")}: ${j.mood}${bp}${j.symptoms.length ? ` · ${j.symptoms.join(", ")}` : ""}`,
      tone: "brand",
    });
  }
  for (const r of records) {
    events.push({
      date: r.date,
      title: r.title,
      detail: `${t(`rc2_cat_${r.category}`, CAT_LABEL[r.category] ?? r.category)} · ${r.provider}`,
      tone: "green",
    });
  }
  for (const b of bookings) {
    events.push({
      date: b.date ?? b.createdAt,
      title: t("jyx_request", "Care request"),
      detail: b.message,
      tone: "amber",
    });
  }
  events.push({
    date: "2026-09-15",
    title: t("jyx_screening", "Community screening"),
    detail: t("jyx_screening_d", "Know Your Numbers outreach event"),
    tone: "green",
  });
  events.push({
    date: "2026-09-15",
    title: t("jyx_referred", "Referred to PHC"),
    detail: t("jyx_referred_d", "Flagged BP reading during screening"),
    tone: "amber",
  });
  events.sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <Screen>
      <SectionHeader
        title={t("jt_title", "Your health journey")}
        subtitle={t("jt_sub", "Everything that has happened, in one timeline.")}
      />

      {events.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={<ActivityIcon className="h-6 w-6" />}
            title={t("jyx_empty", "Your timeline is empty")}
            body={t("jyx_empty_d", "Journal entries, records and care requests appear here as you add them.")}
          />
        </div>
      ) : (
        <ol className="mt-5 space-y-2.5">
          {events.map((e, i) => (
            <li key={`${e.date}-${i}`}>
              <Card className="relative pl-5">
                <span className={`absolute left-2 top-5 h-2.5 w-2.5 rounded-full ${DOT[e.tone]}`} />
                <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  <CalendarIcon className="h-3 w-3" />
                  {fullDate(e.date)}
                </div>
                <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{e.title}</p>
                <p className="mt-0.5 text-xs text-slate-600">{e.detail}</p>
              </Card>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5">
        <Badge tone="brand">
          <FileTextIcon className="mr-1 h-3 w-3" />
          {t("jyx_legend_records", "Records")}
        </Badge>
        <Badge tone="green">{t("jyx_legend_care", "Care")}</Badge>
        <Badge tone="amber">{t("jyx_legend_requests", "Requests")}</Badge>
      </div>
    </Screen>
  );
}