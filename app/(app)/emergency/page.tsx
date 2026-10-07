"use client";

import Link from "next/link";
import { Badge, Button, Card, Screen, SectionHeader } from "@/components/app-ui";
import { BookIcon, EmergencyIcon, PhoneIcon } from "@/components/icons";
import { EMERGENCY_CONTACTS } from "@/lib/content";
import { useT } from "@/lib/i18n";

export default function EmergencyPage() {
  const t = useT();

  return (
    <Screen>
      <SectionHeader title={t("em_title", "Emergency help")} subtitle={t("em_sub", "Get help fast. Call first, then use the steps below.")} />

      <Card className="mt-4 border-rose-200 bg-rose-50/70">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600 text-white">
            <EmergencyIcon className="h-5 w-5" />
          </span>
          <h2 className="text-base font-semibold text-rose-900">{t("em_call", "Call now")}</h2>
        </div>
        <p className="mt-1.5 text-sm text-rose-800">{t("em_call_d", "Do not wait. Call the number closest to you.")}</p>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          {EMERGENCY_CONTACTS.map((c) => (
            <a
              key={`${c.name}-${c.number}`}
              href={`tel:${c.number}`}
              className="tap flex min-h-28 flex-col items-center justify-center gap-0.5 rounded-2xl border border-rose-200 bg-white px-3 py-4 text-center shadow-sm transition-colors active:bg-rose-50"
            >
              <span className="text-2xl font-bold tracking-tight text-rose-700">{c.number}</span>
              <span className="mt-1 flex items-center gap-1 text-sm font-semibold text-slate-900">
                <PhoneIcon className="h-3.5 w-3.5 text-rose-600" />
                {c.name}
              </span>
              {c.note ? <span className="text-[11px] leading-tight text-slate-500">{c.note}</span> : null}
            </a>
          ))}
        </div>
      </Card>

      <Card className="mt-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t("em_while", "While you wait")}</h2>
        </div>
        <ol className="mt-3 space-y-2.5">
          {[t("em_s1", "Stay calm and keep the person lying down."), t("em_s2", "Loosen tight clothing."), t("em_s3", "If they are not breathing, start CPR if you know how."), t("em_s4", "Keep them warm and do not give food or drink."), t("em_s5", "Send someone to meet the ambulance.")].map(
            (step, i) => (
              <li key={step} className="flex gap-3 text-sm text-slate-700">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700">
                  {i + 1}
                </span>
                <span className="min-w-0">{step}</span>
              </li>
            ),
          )}
        </ol>
        <Link
          href="/explore?topic=first-aid"
          className="mt-4 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-700"
        >
          {t("hd_read_more", "Read more")}
          <BookIcon className="h-4 w-4" />
        </Link>
      </Card>

      <Card className="mt-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{t("em_find_care", "Find care after the emergency")}</h2>
        </div>
        <p className="mt-2 text-sm text-slate-600">{t("em_find_d", "Nearest hospitals and clinics, sorted by distance.")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/find-care?category=Hospital" className="min-h-11">
            <Button className="min-h-11">{t("em_find_hospital", "Find a hospital")}</Button>
          </Link>
          <Link href="/find-care?category=Clinic">
            <Button tone="secondary" className="min-h-11">
              {t("em_find_clinic", "Find a clinic")}
            </Button>
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="rose">{t("emx_national", "National emergency: 112")}</Badge>
        </div>
      </Card>

      <p className="mt-4 text-center text-xs text-slate-400">{t("em_footer", "CareNBuddi does not provide emergency medical care.")}</p>
    </Screen>
  );
}