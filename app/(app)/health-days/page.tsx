"use client";

import { useState } from "react";
import {
  Badge,
  BottomSheet,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  Screen,
  SectionHeader,
  inputClass,
  useToast,
} from "@/components/app-ui";
import { ActivityIcon, CalendarIcon, PinIcon, PlusIcon } from "@/components/icons";
import { fullDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useStoredCollection } from "@/lib/storage";

interface HealthDay {
  id: string;
  title: string;
  organizer: string;
  date: string;
  location: string;
  services: string[];
  screened: number;
  referred: number;
  followUpRequired: number;
  followUpDone: number;
}

const seedDays: HealthDay[] = [
  {
    id: "hd-1",
    title: "Know Your Numbers Screening",
    organizer: "St. Mary's Church, Ikeja",
    date: "2026-08-12",
    location: "Ikeja, Lagos",
    services: ["BP screening", "Blood glucose", "Health education"],
    screened: 183,
    referred: 21,
    followUpRequired: 34,
    followUpDone: 18,
  },
];

const SERVICES = [
  { key: "hdx_srv_bp", en: "BP screening" },
  { key: "hdx_srv_glucose", en: "Blood glucose" },
  { key: "hdx_srv_bmi", en: "BMI/weight" },
  { key: "hdx_srv_edu", en: "Health education" },
  { key: "hdx_srv_women", en: "Women's health" },
  { key: "hdx_srv_mental", en: "Mental health awareness" },
];

export default function HealthDaysPage() {
  const t = useT();
  const { push } = useToast();
  const [days, setDays] = useStoredCollection<HealthDay>("healthlink:health-days", seedDays);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    organizer: "",
    date: "",
    location: "",
    services: [] as string[],
  });

  const toggleService = (s: string) =>
    setDraft((d) => ({
      ...d,
      services: d.services.includes(s) ? d.services.filter((x) => x !== s) : [...d.services, s],
    }));

  const create = () => {
    if (!draft.title.trim() || !draft.date) return;
    setDays((prev) => [
      ...prev,
      { ...draft, id: crypto.randomUUID(), screened: 0, referred: 0, followUpRequired: 0, followUpDone: 0 },
    ]);
    setDraft({ title: "", organizer: "", date: "", location: "", services: [] });
    setOpen(false);
    push(t("hdx_created", "Health day created"), "success");
  };

  const stats = (d: HealthDay) => [
    { label: t("hdx_screened", "Screened"), value: d.screened, className: "bg-slate-50 text-slate-900" },
    { label: t("hdx_referred", "Referred"), value: d.referred, className: "bg-amber-50 text-amber-900" },
    { label: t("hdx_followup_due", "Follow-up due"), value: d.followUpRequired, className: "bg-rose-50 text-rose-900" },
    { label: t("hdx_followed", "Followed up"), value: d.followUpDone, className: "bg-emerald-50 text-emerald-900" },
  ];

  return (
    <Screen>
      <SectionHeader
        title={t("hd2_title", "Community Health Days")}
        subtitle={t("hd2_sub", "Screenings and education where people gather — followed through with real referrals.")}
      />

      <Button full className="mt-3" onClick={() => setOpen(true)}>
        <PlusIcon className="h-4 w-4" />
        {t("hd2_create", "Create a health day")}
      </Button>

      <div className="mt-4 space-y-3">
        {days.length === 0 ? (
          <EmptyState
            icon={<CalendarIcon className="h-6 w-6" />}
            title={t("hdx_empty", "No health days yet")}
            body={t("hdx_empty_d", "Create an outreach event to track screenings and referrals.")}
          />
        ) : (
          days.map((d) => (
            <Card key={d.id}>
              <h2 className="truncate text-sm font-semibold text-slate-900">{d.title}</h2>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {d.organizer} · {fullDate(d.date)} · {d.location}
              </p>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {d.services.map((s) => (
                  <Badge key={s} tone="brand">
                    <ActivityIcon className="mr-1 h-3 w-3" />
                    {s}
                  </Badge>
                ))}
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-2">
                {stats(d).map((s) => (
                  <div key={s.label} className={`rounded-xl px-3 py-2.5 text-center ${s.className}`}>
                    <dt className="text-[11px] opacity-80">{s.label}</dt>
                    <dd className="text-lg font-bold tabular-nums">{s.value}</dd>
                  </div>
                ))}
              </dl>

              <p className="mt-2.5 flex items-center gap-1 truncate text-[11px] text-slate-400">
                <PinIcon className="h-3 w-3 shrink-0" />
                {d.location}
              </p>
            </Card>
          ))
        )}
      </div>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("hd2_create", "Create a health day")}
        footer={
          <Button full onClick={create}>
            {t("hd2_save", "Create")}
          </Button>
        }
      >
        <div className="space-y-3">
          <Field label={t("hd2_f_title", "Title")}>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label={t("hd2_f_org", "Organizer (church, school, NGO…)")}>
            <input
              type="text"
              value={draft.organizer}
              onChange={(e) => setDraft({ ...draft, organizer: e.target.value })}
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("hd2_f_date", "Date")}>
              <input
                type="date"
                value={draft.date}
                onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label={t("hd2_f_loc", "Location")}>
              <input
                type="text"
                value={draft.location}
                onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-slate-600">{t("hd2_f_srv", "Services")}</span>
            <div className="flex flex-wrap gap-1.5">
              {SERVICES.map((s) => (
                <Chip
                  key={s.key}
                  active={draft.services.includes(s.en)}
                  onClick={() => toggleService(s.en)}
                >
                  {t(s.key, s.en)}
                </Chip>
              ))}
            </div>
          </div>
          <Button tone="secondary" full onClick={() => setOpen(false)}>
            {t("hd2_cancel", "Cancel")}
          </Button>
        </div>
      </BottomSheet>
    </Screen>
  );
}