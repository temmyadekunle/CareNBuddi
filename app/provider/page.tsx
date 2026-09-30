"use client";

import { useState } from "react";
import Link from "next/link";
import {
  KEYS,
  seedBookings,
  seedProviderRequests,
  seedProviders,
  seedUsers,
  useSession,
  useStoredCollection,
} from "@/lib/storage";
import { seedProviderFor } from "@/lib/content";
import type { Booking } from "@/lib/types";
import { useT } from "@/lib/i18n";
import { LangSwitcher } from "@/components/ui";

export default function ProviderPortalPage() {
  const t = useT();
  const [session] = useSession();
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const [providers, setProviders] = useStoredCollection(KEYS.providers, seedProviders);
  const [requests] = useStoredCollection(KEYS.providerRequests, seedProviderRequests);
  const [bookings, setBookings] = useStoredCollection(KEYS.bookings, seedBookings);

  const me = users.find((u) => u.id === session.userId);
  const isStaff = me?.role === "provider" || me?.role === "admin";

  const email = me?.email.toLowerCase() ?? "";
  const approvedReq = requests.find(
    (r) => r.email.toLowerCase() === email && r.status === "approved",
  );
  const seededId = seedProviderFor(email)?.id;
  const myId = approvedReq ? `prv-${approvedReq.id}` : seededId;
  const myProvider = myId ? providers.find((p) => p.id === myId) : undefined;

  const [name, setName] = useState(() => myProvider?.name ?? "");
  const [phone, setPhone] = useState(() => myProvider?.phone ?? "");
  const [hours, setHours] = useState(() => myProvider?.hours ?? "");
  const [address, setAddress] = useState(() => myProvider?.address ?? "");
  const [description, setDescription] = useState(() => myProvider?.description ?? "");
  const [servicesText, setServicesText] = useState(() => myProvider?.services.join(", ") ?? "");
  const [saved, setSaved] = useState(false);

  const myRequests = bookings.filter((b) => b.providerId === myId);
  const hasRequest = requests.some((r) => r.email.toLowerCase() === email);

  if (!session.userId || !me || !isStaff) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t("pv_title")}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          This area is for verified healthcare providers. Sign in with a provider or admin
          demo account to continue.
        </p>
        <Link
          href="/account"
          className="mt-5 inline-block rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          {t("a_signin")}
        </Link>
      </main>
    );
  }

  const save = () => {
    if (!myProvider) return;
    setProviders((prev) =>
      prev.map((p) =>
        p.id === myProvider.id
          ? {
              ...p,
              name: name || p.name,
              phone: phone || p.phone,
              hours: hours || p.hours,
              address: address || p.address,
              description: description || p.description,
              services: servicesText
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            }
          : p,
      ),
    );
    setSaved(true);
  };

  const setBookingStatus = (id: string, status: Booking["status"]) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("pv_title")}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {t("pv_sub")} ·{" "}
            <Link href="/account" className="font-medium text-brand-700 underline">
              {me.name}
            </Link>
          </p>
        </div>
        <LangSwitcher />
      </div>

      {!myProvider ? (
        <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-600">
            {hasRequest ? t("pv_pending") : t("pv_none")}
          </p>
          <Link
            href="/provider/register"
            className="mt-4 inline-block rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
          >
            {t("pv_register")}
          </Link>
        </div>
      ) : (
        <>
          <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900">{t("pv_profile")}</h2>
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                ✓ {t("f_verified")}
              </span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label={t("a_name")} value={name} onChange={setName} />
              <Field label={t("a_phone")} value={phone} onChange={setPhone} />
              <Field label={t("f_hours")} value={hours} onChange={setHours} />
              <Field label="Address" value={address} onChange={setAddress} />
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-slate-600">Services (comma separated)</span>
                <input
                  value={servicesText}
                  onChange={(e) => setServicesText(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-slate-600">About this facility</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                />
              </label>
            </div>
            <button
              onClick={save}
              className="mt-4 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
            >
              {t("pv_save")}
            </button>
            {saved && <span className="ml-3 text-sm font-medium text-green-700">✓ {t("c_status")}</span>}
          </section>

          <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">{t("pv_requests")}</h2>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
                {myRequests.filter((b) => b.status === "new").length} {t("pv_new_req")}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {myRequests.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">{t("c_none")}</p>
              ) : (
                myRequests.map((b) => (
                  <div
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">
                        {b.name} · <span className="text-slate-500">{b.phone}</span>
                      </p>
                      <p className="text-xs text-slate-600">
                        {b.message || "No message"}
                        {b.date ? ` · ${b.date}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                        {b.status}
                      </span>
                      {b.status === "new" && (
                        <button
                          onClick={() => setBookingStatus(b.id, "contacted")}
                          className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800"
                        >
                          {t("pv_confirm")}
                        </button>
                      )}
                      {b.status === "contacted" && (
                        <button
                          onClick={() => setBookingStatus(b.id, "confirmed")}
                          className="rounded-lg border border-brand-700 bg-white px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
                        >
                          Confirm
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </>
      )}
      <p className="mt-8 text-center">
        <Link href="/provider/register" className="text-sm font-medium text-brand-700 underline">
          {t("pv_register")}
        </Link>
      </p>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
      />
    </label>
  );
}