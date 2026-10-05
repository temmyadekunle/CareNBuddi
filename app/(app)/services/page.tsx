"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Card,
  Field,
  Screen,
  SectionHeader,
  inputClass,
  useToast,
} from "@/components/app-ui";
import {
  ActivityIcon,
  BookIcon,
  CalendarIcon,
  CameraIcon,
  ChartIcon,
  CheckIcon as CheckGlyph,
  HeartPulseIcon,
  PinIcon,
  StethoscopeIcon,
  WalletIcon,
} from "@/components/icons";
import { useT } from "@/lib/i18n";
import { KEYS, seedBookings, uid, useSession, useStoredCollection } from "@/lib/storage";
import type { Booking } from "@/lib/types";
import type { ReactNode } from "react";

interface ServiceDef {
  key: string;
  nameKey: string;
  descKey: string;
  icon: ReactNode;
  tone: string;
}

const CHECK_ITEMS: ServiceDef[] = [
  { key: "bp", nameKey: "sc_bp", descKey: "sc_bp_d", icon: <HeartPulseIcon className="h-5 w-5" />, tone: "bg-brand-50 text-brand-700" },
  { key: "glucose", nameKey: "sc_glu", descKey: "sc_glu_d", icon: <ActivityIcon className="h-5 w-5" />, tone: "bg-green-50 text-green-700" },
  { key: "wellness", nameKey: "sc_well", descKey: "sc_well_d", icon: <StethoscopeIcon className="h-5 w-5" />, tone: "bg-coral-50 text-coral-600" },
];

const SERVICES: ServiceDef[] = [
  { key: "education", nameKey: "srv_education", descKey: "srv_education_d", icon: <BookIcon className="h-5 w-5" />, tone: "bg-brand-50 text-brand-700" },
  { key: "outreach", nameKey: "srv_outreach", descKey: "srv_outreach_d", icon: <PinIcon className="h-5 w-5" />, tone: "bg-green-50 text-green-700" },
  { key: "corporate", nameKey: "srv_corporate", descKey: "srv_corporate_d", icon: <WalletIcon className="h-5 w-5" />, tone: "bg-coral-50 text-coral-600" },
  { key: "mobile", nameKey: "srv_mobile", descKey: "srv_mobile_d", icon: <CameraIcon className="h-5 w-5" />, tone: "bg-brand-50 text-brand-700" },
  { key: "referral", nameKey: "srv_referral", descKey: "srv_referral_d", icon: <StethoscopeIcon className="h-5 w-5" />, tone: "bg-green-50 text-green-700" },
  { key: "campaigns", nameKey: "srv_campaigns", descKey: "srv_campaigns_d", icon: <ChartIcon className="h-5 w-5" />, tone: "bg-coral-50 text-coral-600" },
];

export default function ServicesPage() {
  const t = useT();
  const { push } = useToast();
  const [session] = useSession();
  const [, setBookings] = useStoredCollection(KEYS.bookings, seedBookings);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [service, setService] = useState(SERVICES[0].nameKey);
  const [date, setDate] = useState("");
  const [area, setArea] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const booking: Booking = {
      id: uid(),
      providerId: null,
      userId: session.userId,
      name: name.trim() || "Guest",
      phone: phone.trim(),
      message: `${t(service, "Service")} · ${area}`,
      date: date || undefined,
      status: "new",
      createdAt: new Date().toISOString(),
    };
    setBookings((prev) => [...prev, booking]);
    setSubmitted(true);
    push(t("s_received", "Request received"), "success");
  };

  const successText = t("s_success", "Thanks {name} — we will call {phone} about {service}{date}.")
    .replace("{name}", name.split(" ")[0] || "")
    .replace("{phone}", phone)
    .replace("{service}", t(service).toLowerCase())
    .replace("{date}", date ? ` ${t("s_on", "on")} ${date}` : "");

  return (
    <Screen>
      <SectionHeader title={t("s_title", "Services")} subtitle={t("s_sub", "")} />

      <Card className="mt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">{t("s_check_head", "Check your health")}</h2>
            <p className="mt-1 text-xs text-slate-500">{t("h_check_d", "Screening, clinics, and your personal health dashboard.")}</p>
          </div>
          <Link href="/health" className="shrink-0">
            <Button tone="secondary" className="min-h-9 px-3 text-xs">
              {t("s_open_health", "Open")}
            </Button>
          </Link>
        </div>

        <div className="mt-3 space-y-2">
          {CHECK_ITEMS.map((s) => (
            <div key={s.key} className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${s.tone}`}>
                {s.icon}
              </span>
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-slate-900">{t(s.nameKey, "")}</h3>
                <p className="mt-0.5 text-xs text-slate-600">{t(s.descKey, "")}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <h2 className="mt-5 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {t("s_we_provide", "What we provide")}
      </h2>
      <div className="mt-2 space-y-2.5">
        {SERVICES.map((s) => (
          <Card key={s.key}>
            <div className="flex items-start gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.tone}`}>
                {s.icon}
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900">{t(s.nameKey, "")}</h3>
                <p className="mt-0.5 text-xs text-slate-600">{t(s.descKey, "")}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <h2 className="mt-5 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {t("s_book", "Book a service")}
      </h2>

      {submitted ? (
        <Card className="mt-2 border-emerald-200 bg-emerald-50 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white">
            <CheckGlyph className="h-6 w-6" />
          </span>
          <p className="mt-3 text-base font-semibold text-emerald-900">{t("s_received", "Request received")}</p>
          <p className="mt-1.5 text-sm text-emerald-800">{successText}</p>
          <Button
            className="mt-4"
            onClick={() => {
              setSubmitted(false);
              setName("");
              setPhone("");
              setDate("");
              setArea("");
            }}
          >
            {t("s_book_another", "Book another")}
          </Button>
        </Card>
      ) : (
        <>
          <p className="mt-2 text-sm text-slate-600">{t("s_intro", "")}</p>
          <Card className="mt-2">
            <form onSubmit={submit} className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">{t("s_form_head", "Request details")}</h3>
              <Field label={t("a_name", "Full name")}>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("s_ph_name", "e.g. Amina Yusuf")}
                  className={inputClass}
                />
              </Field>
              <Field label={t("a_phone", "Phone")}>
                <input
                  type="tel"
                  inputMode="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234 800 000 0000"
                  className={inputClass}
                />
              </Field>
              <Field label={t("s_service", "Service")}>
                <select value={service} onChange={(e) => setService(e.target.value)} className={inputClass}>
                  {SERVICES.map((s) => (
                    <option key={s.key} value={s.nameKey}>
                      {t(s.nameKey, "")}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label={t("s_date", "Date")}>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label={t("s_area", "Area")}>
                  <input
                    type="text"
                    required
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder={t("s_ph_area", "e.g. Ikeja, Lagos")}
                    className={inputClass}
                  />
                </Field>
              </div>
              <Button full type="submit">
                <CalendarIcon className="h-4 w-4" />
                {t("s_submit", "Send request")}
              </Button>
              <p className="flex items-center gap-1 text-[11px] text-slate-400">
                <Badge tone="slate">
                  <CheckGlyph className="h-3 w-3" />
                  {t("s_free_note", "")}
                </Badge>
              </p>
            </form>
          </Card>
        </>
      )}
    </Screen>
  );
}