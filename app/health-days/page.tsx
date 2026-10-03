"use client";

import { useState } from "react";
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
    id: "hd-1", title: "Know Your Numbers Screening", organizer: "St. Mary's Church, Ikeja",
    date: "2026-08-12", location: "Ikeja, Lagos", services: ["BP screening", "Blood glucose", "Health education"],
    screened: 183, referred: 21, followUpRequired: 34, followUpDone: 18,
  },
];

const SERVICE_OPTIONS = ["BP screening", "Blood glucose", "BMI/weight", "Health education", "Women's health", "Mental health awareness"];

export default function HealthDaysPage() {
  const t = useT();
  const [days, setDays] = useStoredCollection<HealthDay>("healthlink:health-days", seedDays);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ title: "", organizer: "", date: "", location: "", services: [] as string[] });

  const toggleService = (s: string) =>
    setDraft((d) => ({ ...d, services: d.services.includes(s) ? d.services.filter((x) => x !== s) : [...d.services, s] }));

  const create = () => {
    if (!draft.title.trim() || !draft.date) return;
    setDays((prev) => [...prev, { ...draft, id: crypto.randomUUID(), screened: 0, referred: 0, followUpRequired: 0, followUpDone: 0 }]);
    setDraft({ title: "", organizer: "", date: "", location: "", services: [] });
    setCreating(false);
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("hd2_title", "Community Health Days")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("hd2_sub", "Screenings and education where people gather — followed through with real referrals.")}</p>

      <div className="mt-6 space-y-4">
        {days.map((d) => (
          <section key={d.id} className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{d.title}</h2>
                <p className="text-xs text-slate-500">{d.organizer} · {d.date} · {d.location}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {d.services.map((s) => (
                  <span key={s} className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-medium text-brand-700">{s}</span>
                ))}
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-3 text-center"><dt className="text-xs text-slate-500">Screened</dt><dd className="text-xl font-bold text-slate-900">{d.screened}</dd></div>
              <div className="rounded-xl bg-amber-50 p-3 text-center"><dt className="text-xs text-amber-800">Referred</dt><dd className="text-xl font-bold text-amber-900">{d.referred}</dd></div>
              <div className="rounded-xl bg-rose-50 p-3 text-center"><dt className="text-xs text-rose-800">Follow-up due</dt><dd className="text-xl font-bold text-rose-900">{d.followUpRequired}</dd></div>
              <div className="rounded-xl bg-emerald-50 p-3 text-center"><dt className="text-xs text-emerald-800">Followed up</dt><dd className="text-xl font-bold text-emerald-900">{d.followUpDone}</dd></div>
            </dl>
          </section>
        ))}
      </div>

      {creating ? (
        <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold">{t("hd2_create", "Create a health day")}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {([["title", t("hd2_f_title", "Title")], ["organizer", t("hd2_f_org", "Organizer (church, school, NGO…)")], ["date", t("hd2_f_date", "Date")], ["location", t("hd2_f_loc", "Location")]] as const).map(([key, label]) => (
              <label key={key} className="block">
                <span className="text-xs font-medium text-slate-500">{label}</span>
                <input
                  type={key === "date" ? "date" : "text"}
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs font-medium text-slate-500">{t("hd2_f_srv", "Services")}</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {SERVICE_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => toggleService(s)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${draft.services.includes(s) ? "border-brand-700 bg-brand-50 text-brand-800" : "border-slate-200 text-slate-600"}`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={create} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">{t("hd2_save", "Create")}</button>
            <button onClick={() => setCreating(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">{t("hd2_cancel", "Cancel")}</button>
          </div>
        </section>
      ) : (
        <button onClick={() => setCreating(true)} className="mt-6 rounded-xl border border-dashed border-slate-300 px-5 py-3 text-sm font-medium text-slate-600 hover:border-brand-300">
          + {t("hd2_createb", "Create a health day")}
        </button>
      )}
    </main>
  );
}
