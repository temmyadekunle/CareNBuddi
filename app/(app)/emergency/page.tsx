"use client";

import Link from "next/link";
import { Badge, Button, Card, Screen, SectionHeader } from "@/components/app-ui";
import { BookIcon, EmergencyIcon, PhoneIcon } from "@/components/icons";
import { NearbyEmergency } from "@/components/nearby-emergency";
import { useT } from "@/lib/i18n";
import { activeEmergencyContacts, PRIMARY_EMERGENCY_NUMBER } from "@/lib/rapid-response";

function verifiedOn(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function EmergencyPage() {
  const t = useT();
  const contacts = activeEmergencyContacts();
  const primary = contacts.find((c) => c.number === PRIMARY_EMERGENCY_NUMBER) ?? contacts[0];
  const secondary = contacts.filter((c) => c.id !== primary.id);
  const ogunLine = contacts.find((c) => c.id === "og-state-emergency");

  return (
    <Screen>
      <SectionHeader
        title={t("em_title", "Emergency help")}
        subtitle={t("em_sub", "Emergency guidance and where to call for help right now.")}
      />

      <Card className="mt-4 border-rose-200 bg-rose-50/70">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600 text-white">
            <EmergencyIcon className="h-5 w-5" />
          </span>
          <h2 className="text-base font-semibold text-rose-900">
            {t("em_call", "Call an emergency number immediately")}
          </h2>
        </div>
        <p className="mt-1.5 text-sm text-rose-800">{t("em_call_d", "Do not wait. Call the number closest to you.")}</p>

        <a
          href={`tel:${primary.number}`}
          className="tap mt-4 flex items-center justify-between gap-3 rounded-2xl bg-rose-600 px-4 py-4 text-white shadow-sm active:bg-rose-700"
        >
          <span className="min-w-0">
            <span className="block text-2xl font-bold tracking-tight">{primary.number}</span>
            <span className="mt-0.5 block text-xs leading-snug text-rose-100">
              {t("em_112_cover", "Police · Ambulance · Fire · Road safety — nationwide, toll-free")}
            </span>
          </span>
          <PhoneIcon className="h-6 w-6 shrink-0" />
        </a>

        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {secondary.map((c) => (
            <a
              key={c.id}
              href={`tel:${c.number}`}
              className="tap flex min-h-24 flex-col justify-center rounded-2xl border border-rose-200 bg-white px-3.5 py-3 shadow-sm active:bg-rose-50"
            >
              <span className="text-xl font-bold tracking-tight text-rose-700">{c.number}</span>
              <span className="mt-1 text-sm font-semibold text-slate-900">{c.name}</span>
              <span className="mt-0.5 text-[11px] leading-tight text-slate-500">{c.coverage}</span>
            </a>
          ))}
        </div>

        <details className="mt-3 rounded-2xl border border-rose-100 bg-white/80 px-3.5 py-2.5">
          <summary className="cursor-pointer select-none text-sm font-semibold text-slate-700">
            {t("em_sources", "Sources & verification")} ({contacts.length})
          </summary>
          <ul className="mt-2 space-y-2.5">
            {contacts.map((c) => (
              <li key={c.id} className="text-xs leading-relaxed text-slate-600">
                <span className="font-semibold text-slate-800">
                  {c.name} ({c.number})
                </span>{" "}
                — {c.instructions}
                <br />
                <a
                  href={c.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-brand-700 underline"
                >
                  {t("em_source", "Source")}
                </a>
                {" · "}
                {t("em_verified_on", "Verified")} {verifiedOn(c.lastVerified)} · {c.coverage}
              </li>
            ))}
          </ul>
        </details>
      </Card>

      <Card className="mt-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          {t("em_amb_title", "Need an ambulance?")}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {t(
            "em_amb_d",
            "CareNBuddi cannot send one — there is no dispatch here. Dial 112 and give your exact location first. In Ogun State you can also call the state emergency line.",
          )}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a
            href={`tel:${primary.number}`}
            className="tap inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white active:bg-rose-700"
          >
            <PhoneIcon className="h-4 w-4" />
            {primary.number}
          </a>
          {ogunLine && (
            <a
              href={`tel:${ogunLine.number}`}
              className="tap inline-flex min-h-11 items-center gap-2 rounded-xl border border-rose-300 bg-white px-4 text-sm font-semibold text-rose-700"
            >
              {ogunLine.number}
              <span className="text-[11px] font-normal text-rose-500">
                {t("em_state_line", "Ogun State line")}
              </span>
            </a>
          )}
          <Badge tone="rose">{t("em_no_dispatch", "Call only — no dispatch")}</Badge>
        </div>
      </Card>

      <div id="nearby" className="mt-6 scroll-mt-4">
        <SectionHeader
          title={t("er_title", "Nearby emergency care")}
          subtitle={t("er_sub", "Hospitals and clinics that handle emergencies — list and map.")}
        />
        <NearbyEmergency />
      </div>

      <Card className="mt-6">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("em_while", "While you wait")}
          </h2>
        </div>
        <ol className="mt-3 space-y-2.5">
          {[
            t("em_s1", "Stay calm and keep the person lying down."),
            t("em_s2", "Loosen tight clothing."),
            t("em_s3", "If they are not breathing, start CPR if you know how."),
            t("em_s4", "Keep them warm and do not give food or drink."),
            t("em_s5", "Send someone to meet the ambulance."),
          ].map((step, i) => (
            <li key={step} className="flex gap-3 text-sm text-slate-700">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-700">
                {i + 1}
              </span>
              <span className="min-w-0">{step}</span>
            </li>
          ))}
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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            {t("em_find_care", "Find care after the emergency")}
          </h2>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          {t("em_find_d", "Nearest hospitals and clinics, sorted by distance.")}
        </p>
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
      </Card>

      <p className="mt-4 text-center text-xs text-slate-400">
        {t(
          "em_footer",
          "In a medical emergency, always contact emergency services first. CareNBuddi is educational and navigational only.",
        )}
      </p>
    </Screen>
  );
}
