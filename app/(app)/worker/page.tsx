"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Badge,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  Field,
  Screen,
  SectionHeader,
  inputClass,
  useToast,
} from "@/components/app-ui";
import { ActivityIcon, PlusIcon, RefreshIcon, StethoscopeIcon } from "@/components/icons";
import { fullDate } from "@/lib/format";
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
  {
    id: "w-1",
    date: "2026-10-02",
    screeningType: "BP + glucose",
    participants: 42,
    referred: 6,
    notes: "Market day outreach, Bodija.",
  },
];

export default function WorkerPage() {
  const t = useT();
  const { push } = useToast();
  const [events] = useStoredCollection<{ id: string; title: string; date: string; location: string }>(
    "healthlink:health-days",
    [],
  );
  const [logs, setLogs] = useStoredCollection<WorkerLog>("healthlink:worker-log", seedLog);
  const [online, setOnline] = useStoredValue<boolean>("healthlink:worker-online", true);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Omit<WorkerLog, "id">>({
    date: new Date().toISOString().slice(0, 10),
    screeningType: "BP screening",
    participants: 0,
    referred: 0,
    notes: "",
  });

  const addLog = () => {
    setLogs((prev) => [{ ...draft, id: crypto.randomUUID() }, ...prev]);
    setDraft((d) => ({ ...d, participants: 0, referred: 0, notes: "" }));
    setOpen(false);
    push(t("wkr_saved", "Screening logged"), "success");
  };

  const totals = logs.reduce(
    (acc, l) => ({ participants: acc.participants + l.participants, referred: acc.referred + l.referred }),
    { participants: 0, referred: 0 },
  );

  const stats = [
    { label: t("w_events", "Events"), value: events.length || 1 },
    { label: t("w_participants", "Screened"), value: totals.participants },
    { label: t("w_referred", "Referred"), value: totals.referred },
    { label: t("w_pending", "Follow-ups due"), value: Math.max(totals.referred - Math.floor(totals.referred / 2), 0) },
  ];

  return (
    <Screen>
      <SectionHeader
        title={t("w_title", "Health Worker Mode")}
        subtitle={t("w_sub", "Screenings, referrals and follow-ups from the field.")}
      />

      <button
        onClick={() => setOnline(!online)}
        aria-pressed={online}
        className="tap mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-xs font-semibold"
      >
        <Badge tone={online ? "green" : "slate"}>
          <RefreshIcon className="mr-1 h-3 w-3" />
          {online ? t("wkr_online", "Online — synced") : t("wkr_offline", "Offline — changes queued")}
        </Badge>
      </button>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {stats.map((s) => (
          <Card key={s.label} className="px-3 py-3 text-center">
            <p className="text-xl font-bold tabular-nums text-slate-900">{s.value}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{s.label}</p>
          </Card>
        ))}
      </div>

      <Button full className="mt-4" onClick={() => setOpen(true)}>
        <PlusIcon className="h-4 w-4" />
        {t("w_log", "Log a screening")}
      </Button>

      <section className="mt-5">
        <h2 className="text-sm font-semibold text-slate-900">{t("w_recent", "Recent logs")}</h2>
        <div className="mt-2 space-y-2.5">
          {logs.length === 0 ? (
            <EmptyState
              icon={<StethoscopeIcon className="h-6 w-6" />}
              title={t("wkr_empty", "No screenings logged")}
              body={t("wkr_empty_d", "Log a screening after an outreach so follow-ups are not lost.")}
            />
          ) : (
            logs.map((l) => (
              <Card key={l.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{l.screeningType}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {fullDate(l.date)} · {l.notes}
                    </p>
                  </div>
                  <Badge tone="brand">
                    <ActivityIcon className="mr-1 h-3 w-3" />
                    {`${l.participants} / ${l.referred}`}
                  </Badge>
                </div>
              </Card>
            ))
          )}
        </div>

        <p className="mt-4 text-xs text-slate-400">
          {t("w_sync", "Records save locally and sync when you are back online.")}{" "}
          <Link href="/health-days" className="inline-flex min-h-9 items-center font-semibold text-brand-700">
            {t("w_days", "View health days")}
          </Link>
        </p>
      </section>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("w_log", "Log a screening")}
        footer={
          <Button full onClick={addLog}>
            {t("w_add", "Add log")}
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("wkr_f_date", "Date")}>
              <input
                type="date"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label={t("wkr_f_type", "Type")}>
              <input
                value={draft.screeningType}
                onChange={(e) => setDraft({ ...draft, screeningType: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("wkr_f_participants", "Participants")}>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={draft.participants}
                onChange={(e) => setDraft({ ...draft, participants: Number(e.target.value) })}
                className={inputClass}
              />
            </Field>
            <Field label={t("wkr_f_referred", "Referred")}>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={draft.referred}
                onChange={(e) => setDraft({ ...draft, referred: Number(e.target.value) })}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label={t("wkr_f_notes", "Notes")}>
            <input
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
      </BottomSheet>
    </Screen>
  );
}