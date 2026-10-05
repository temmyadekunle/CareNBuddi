"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  Field,
  Screen,
  SectionHeader,
  inputClass,
  useToast,
} from "@/components/app-ui";
import { CheckIcon, ChevronLeftIcon } from "@/components/icons";
import { OPERATING_STATES, PROVIDER_CATEGORIES } from "@/lib/content";
import { useT } from "@/lib/i18n";
import { KEYS, seedProviderRequests, uid, useStoredCollection } from "@/lib/storage";
import type { ProviderRequest } from "@/lib/types";

const STATES = OPERATING_STATES;

export default function ProviderRegisterPage() {
  const t = useT();
  const { push } = useToast();
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
    push(t("pv_pending", "Registration received"), "success");
  };

  return (
    <Screen>
      <Link
        href="/provider"
        className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-slate-500"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        {t("pv_title", "Provider")}
      </Link>

      <div className="mt-1">
        <SectionHeader title={t("pv_register", "Register your facility")} subtitle={t("prg_lead", "")} />
      </div>

      {submitted ? (
        <Card className="mt-4 border-emerald-200 bg-emerald-50 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white">
            <CheckIcon className="h-6 w-6" />
          </span>
          <p className="mt-3 text-base font-semibold text-emerald-900">{t("pv_pending", "Registration received")}</p>
          <p className="mt-1.5 text-sm text-emerald-800">
            {t("prg_success_1", "Thanks — {facility} is under review.").replace("{facility}", facility)}{" "}
            {t("prg_success_2", "We will contact you shortly.")}
          </p>
          <Link href="/provider" className="mt-4 inline-block min-h-11">
            <Button className="min-h-11">{t("pv_title", "Provider")}</Button>
          </Link>
        </Card>
      ) : (
        <Card className="mt-4">
          <div className="space-y-3">
            <Field label={t("a_name", "Full name")}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("pvx_ph_name", "e.g. Dr. Ngozi Eze")}
                className={inputClass}
              />
            </Field>
            <Field label={t("a_email", "Email")}>
              <input
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@facility.ng"
                className={inputClass}
              />
            </Field>
            <Field label={t("prg_facility", "Facility name")}>
              <input value={facility} onChange={(e) => setFacility(e.target.value)} className={inputClass} />
            </Field>
            <Field label={t("prg_category", "Category")}>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                {PROVIDER_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t("prg_state", "State")}>
                <select value={state} onChange={(e) => setState(e.target.value)} className={inputClass}>
                  {STATES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label={t("prg_lga", "LGA / area")}>
                <input
                  value={lga}
                  onChange={(e) => setLga(e.target.value)}
                  placeholder={t("pvx_ph_lga", "e.g. Abeokuta South")}
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label={t("prg_address", "Address")}>
              <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
            </Field>
            <Field label={t("a_phone", "Phone")}>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+234 …"
                className={inputClass}
              />
            </Field>
          </div>

          <div className="sticky bottom-0 -mx-4 mt-4 border-t border-slate-100 bg-white px-4 pb-1 pt-3">
            <Button full onClick={submit} className="min-h-11">
              {t("prg_submit", "Submit registration")}
            </Button>
            <p className="mt-2 text-center text-[11px] text-slate-400">{t("prg_note", "")}</p>
          </div>
        </Card>
      )}
    </Screen>
  );
}