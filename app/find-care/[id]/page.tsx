"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PROVIDER_CATEGORY_LABELS, directionsUrl, whatsappUrl } from "@/lib/content";
import { KEYS, seedBookings, seedProviders, uid, useSession, useStoredCollection } from "@/lib/storage";
import { useT, useLang } from "@/lib/i18n";
import { ReportAction } from "@/components/report-button";

export default function ProviderProfilePage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const lang = useLang();
  const [session] = useSession();
  const [providers] = useStoredCollection(KEYS.providers, seedProviders);
  const [, setBookings] = useStoredCollection(KEYS.bookings, seedBookings);

  const provider = providers.find((p) => p.id === id);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [date, setDate] = useState("");
  const [sent, setSent] = useState(false);

  if (!provider) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          {t("f_no_results")}
        </p>
        <div className="mt-4 text-center">
          <Link href="/find-care" className="text-sm font-medium text-brand-700 underline">
            ← {t("f_title")}
          </Link>
        </div>
      </main>
    );
  }

  const submit = () => {
    if (!name.trim() || !phone.trim()) return;
    setBookings((prev) => [
      ...prev,
      {
        id: uid(),
        providerId: provider.id,
        userId: session.userId,
        name: name.trim(),
        phone: phone.trim(),
        message: message.trim(),
        date: date || undefined,
        status: "new",
        createdAt: new Date().toISOString(),
      },
    ]);
    setSent(true);
  };

  const catLabel = PROVIDER_CATEGORY_LABELS[lang]?.[provider.category] ?? provider.category;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/find-care" className="text-sm font-medium text-slate-500 hover:text-slate-700">
        ← {t("f_title")}
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{provider.name}</h1>
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
              {catLabel}
            </span>
            {provider.verified && (
              <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                ✓ {t("f_verified")}
              </span>
            )}
            {provider.rating && (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                ★ {provider.rating.toFixed(1)}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {provider.address} · {provider.lga} · {provider.state}
          </p>
          <p className="text-xs text-slate-400">{provider.hours}</p>
        </div>
        <ReportAction targetType="provider" targetId={provider.id} title={`Report ${provider.name}`} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <a
          href={`tel:${provider.phone}`}
          className="rounded-xl bg-brand-700 px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-brand-800"
        >
          {t("f_call")} {provider.phone}
        </a>
        <a
          href={whatsappUrl(provider)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border border-green-700 bg-green-50 px-4 py-3 text-center text-sm font-semibold text-green-800 transition-colors hover:bg-green-100"
        >
          {t("f_whatsapp")}
        </a>
        <a
          href={directionsUrl(provider)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          {t("f_dir")} ↗
        </a>
      </div>

      {provider.emergency && (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-900">
          🚨 24-hour emergency service available at this facility.
        </div>
      )}

      <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">{t("f_desc")}</h2>
        <p className="mt-1 text-sm text-slate-600">{provider.description}</p>
        <h3 className="mt-4 text-sm font-semibold text-slate-900">{t("f_services")}</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {provider.services.map((s) => (
            <span key={s} className="rounded-full bg-slate-50 px-2.5 py-1 text-xs text-slate-600">
              {s}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">{t("f_request")}</h2>
        {sent ? (
          <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-5 text-sm text-green-900">
            <p className="font-semibold">✓ {t("f_book_sent")}</p>
            <p className="mt-1 text-xs text-green-800">
              Ref: {provider.name} · {date || "no preferred date"} · {phone}
            </p>
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">{t("a_name")}</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">{t("a_phone")}</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+234 ..."
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-slate-600">Message</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                placeholder="What do you need help with?"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Preferred date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              />
            </label>
            <div className="flex items-end">
              <button
                onClick={submit}
                className="w-full rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
              >
                {t("c_send")}
              </button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}