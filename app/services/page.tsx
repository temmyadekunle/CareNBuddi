"use client";

import { useState } from "react";
import Link from "next/link";
import { KEYS, seedBookings, uid, useSession, useStoredCollection } from "@/lib/storage";
import { useT } from "@/lib/i18n";
import type { Booking } from "@/lib/types";

const CHECK_ITEMS = [
  { icon: "🫀", nameKey: "sc_bp", descKey: "sc_bp_d" },
  { icon: "🩸", nameKey: "sc_glu", descKey: "sc_glu_d" },
  { icon: "📋", nameKey: "sc_well", descKey: "sc_well_d" },
];

const SERVICES = [
  { icon: "🎓", nameKey: "srv_education", descKey: "srv_education_d" },
  { icon: "🏘️", nameKey: "srv_outreach", descKey: "srv_outreach_d" },
  { icon: "💼", nameKey: "srv_corporate", descKey: "srv_corporate_d" },
  { icon: "🚐", nameKey: "srv_mobile", descKey: "srv_mobile_d" },
  { icon: "🔗", nameKey: "srv_referral", descKey: "srv_referral_d" },
  { icon: "📢", nameKey: "srv_campaigns", descKey: "srv_campaigns_d" },
];

export default function ServicesPage() {
  const t = useT();
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
      message: `${t(service)} — ${area}`,
      date: date || undefined,
      status: "new",
      createdAt: new Date().toISOString(),
    };
    setBookings((prev) => [...prev, booking]);
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const successText = t("s_success")
    .replace("{name}", name.split(" ")[0] || "")
    .replace("{phone}", phone)
    .replace("{service}", t(service).toLowerCase())
    .replace("{date}", date ? ` on ${date}` : "");

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("s_title")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("s_sub")}</p>
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              <Link href="/health" className="underline decoration-slate-200 underline-offset-2 hover:text-brand-700">
                {t("s_check_head")}
              </Link>
            </h2>
            <p className="mt-1 text-sm text-slate-600">{t("h_check_d")}</p>
          </div>
          <Link
            href="/health"
            className="rounded-lg bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-100"
          >
            {t("s_open_health")} →
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {CHECK_ITEMS.map((s) => (
            <div key={s.nameKey} className="rounded-xl bg-slate-50 p-4">
              <span className="text-xl">{s.icon}</span>
              <h3 className="mt-2 text-sm font-semibold text-slate-900">{t(s.nameKey)}</h3>
              <p className="mt-1 text-xs text-slate-600">{t(s.descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
          {t("s_we_provide")}
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s, i) => (
            <div
              key={s.nameKey}
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl ${
                  i % 3 === 2 ? "bg-coral-50" : i % 3 === 1 ? "bg-green-50" : "bg-brand-50"
                }`}
              >
                {s.icon}
              </span>
              <h3 className="mt-3 text-sm font-semibold text-slate-900">{t(s.nameKey)}</h3>
              <p className="mt-1 text-sm text-slate-600">{t(s.descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
          {t("s_book")}
        </h2>
        <div className="mt-4">
          {submitted ? (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
              <p className="text-lg font-semibold text-green-900">{t("s_received")} 🎉</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-green-800">{successText}</p>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setName("");
                  setPhone("");
                  setDate("");
                  setArea("");
                }}
                className="mt-4 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
              >
                {t("s_book_another")}
              </button>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
              <p className="text-sm text-slate-600">{t("s_intro")}</p>
              <form
                onSubmit={submit}
                className="h-fit rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
              >
                <h3 className="mb-4 text-sm font-semibold text-slate-900">{t("s_form_head")}</h3>
                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-600">{t("a_name")}</span>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Amina Yusuf"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-600">{t("a_phone")}</span>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+234 800 000 0000"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-600">{t("s_service")}</span>
                    <select
                      value={service}
                      onChange={(e) => setService(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                    >
                      {SERVICES.map((s) => (
                        <option key={s.nameKey} value={s.nameKey}>
                          {t(s.nameKey)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-600">{t("s_date")}</span>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-600">{t("s_area")}</span>
                    <input
                      type="text"
                      required
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      placeholder="e.g. Ikeja, Lagos"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  className="mt-4 w-full rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
                >
                  {t("s_submit")}
                </button>
                <p className="mt-2 text-xs text-slate-400">{t("s_free_note")}</p>
              </form>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}