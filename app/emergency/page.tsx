"use client";

import Link from "next/link";
import { EMERGENCY_CONTACTS } from "@/lib/content";
import { useT } from "@/lib/i18n";

export default function EmergencyPage() {
  const t = useT();
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("em_title")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("em_sub")}</p>
      </div>

      <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <h2 className="text-base font-semibold text-red-900">🚨 {t("em_call")}</h2>
        <p className="mt-1 text-sm text-red-800">{t("em_call_d")}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {EMERGENCY_CONTACTS.map((c) => (
            <a
              key={`${c.name}-${c.number}`}
              href={`tel:${c.number}`}
              className="rounded-xl border border-red-200 bg-white p-4 text-center shadow-sm transition-colors hover:border-red-300"
            >
              <p className="text-2xl font-bold text-red-700">{c.number}</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{c.name}</p>
              {c.note && <p className="mt-0.5 text-xs text-slate-500">{c.note}</p>}
            </a>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
          {t("em_while")}
        </h2>
        <ul className="mt-4 space-y-2.5">
          {[
            t("em_s1"),
            t("em_s2"),
            t("em_s3"),
            t("em_s4"),
            t("em_s5"),
          ].map((step) => (
            <li key={step} className="flex gap-2 text-sm text-slate-700">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
              {step}
            </li>
          ))}
        </ul>
        <Link
          href="/explore?topic=first-aid"
          className="mt-4 inline-block text-sm font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800"
        >
          {t("hd_read_more")} →
        </Link>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
          {t("em_find_care")}
        </h2>
        <p className="mt-3 text-sm text-slate-600">{t("em_find_d")}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/find-care?category=Hospital"
            className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
          >
            {t("em_find_hospital")} →
          </Link>
          <Link
            href="/find-care?category=Clinic"
            className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            {t("em_find_clinic")}
          </Link>
        </div>
      </section>

      <p className="mt-6 text-center text-xs text-slate-400">{t("em_footer")}</p>
    </main>
  );
}