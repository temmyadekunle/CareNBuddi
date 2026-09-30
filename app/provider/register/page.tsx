"use client";

import { useState } from "react";
import Link from "next/link";
import { PROVIDER_CATEGORIES } from "@/lib/content";
import { KEYS, seedProviderRequests, uid, useStoredCollection } from "@/lib/storage";
import type { ProviderRequest } from "@/lib/types";
import { useT } from "@/lib/i18n";

const STATES = ["Lagos", "Ogun"];

export default function ProviderRegisterPage() {
  const t = useT();
  const [, setRequests] = useStoredCollection(KEYS.providerRequests, seedProviderRequests);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [facility, setFacility] = useState("");
  const [category, setCategory] = useState<string>(PROVIDER_CATEGORIES[0]);
  const [state, setState] = useState("Lagos");
  const [lga, setLga] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submit = () => {
    if (!name.trim() || !email.trim() || !facility.trim() || !phone.trim()) return;
    const req: ProviderRequest = {
      id: uid(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      facility: facility.trim(),
      category,
      state,
      lga: lga.trim(),
      address: address.trim(),
      phone: phone.trim(),
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    setRequests((prev) => [...prev, req]);
    setSubmitted(true);
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/provider" className="text-sm font-medium text-slate-500 hover:text-slate-700">
        ← {t("pv_title")}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{t("pv_register")}</h1>
      <p className="mt-1 text-sm text-slate-500">
        Providers register once; the HealthLink team verifies each facility before it appears
        in Find Care as a verified provider.
      </p>

      {submitted ? (
        <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
          <p className="text-lg font-semibold text-green-900">✓ {t("pv_pending")}</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-green-800">
            {facility} has been submitted for review. You will be able to manage your requests
            and profile from the provider portal once approved.
          </p>
          <Link
            href="/provider"
            className="mt-4 inline-block rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
          >
            {t("pv_title")}
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-3 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <Field label={t("a_name")} value={name} onChange={setName} placeholder="e.g. Dr. Ngozi Eze" />
          <Field label={t("a_email")} value={email} onChange={setEmail} placeholder="you@facility.ng" />
          <Field label="Facility name" value={facility} onChange={setFacility} />
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            >
              {PROVIDER_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">State</span>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              >
                {STATES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <Field label="LGA / area" value={lga} onChange={setLga} placeholder="e.g. Abeokuta South" />
          </div>
          <Field label="Address" value={address} onChange={setAddress} />
          <Field label={t("a_phone")} value={phone} onChange={setPhone} placeholder="+234 ..." />
          <button
            onClick={submit}
            className="mt-2 w-full rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
          >
            Submit for verification
          </button>
          <p className="text-xs text-slate-400">
            Verification protects the community: only verified providers are shown with the
            ✓ badge in Find Care.
          </p>
        </div>
      )}
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
      />
    </label>
  );
}