"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useT } from "@/lib/i18n";
import { useStoredValue } from "@/lib/storage";

interface Passport {
  name: string;
  bloodGroup: string;
  allergies: string;
  medications: string;
  conditions: string;
  history: string;
  immunizations: string;
  emergencyContact: string;
  emergencyPhone: string;
  hmo: string;
}

const emptyPassport: Passport = {
  name: "", bloodGroup: "", allergies: "", medications: "", conditions: "",
  history: "", immunizations: "", emergencyContact: "", emergencyPhone: "", hmo: "",
};

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function PassportPage() {
  const t = useT();
  const [p, setP] = useStoredValue<Passport>("healthlink:passport", emptyPassport);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Passport>(p);

  const startEdit = () => { setDraft(p); setEditing(true); };
  const save = () => { setP(draft); setEditing(false); };

  const qrPayload = JSON.stringify({
    name: p.name, bloodGroup: p.bloodGroup, allergies: p.allergies,
    medications: p.medications, conditions: p.conditions,
    emergencyContact: p.emergencyContact, emergencyPhone: p.emergencyPhone, hmo: p.hmo,
  });

  const fields: { key: keyof Passport; label: string }[] = [
    { key: "name", label: t("pp_name", "Full name") },
    { key: "bloodGroup", label: t("pp_blood", "Blood group") },
    { key: "allergies", label: t("pp_allergies", "Allergies") },
    { key: "medications", label: t("pp_meds", "Current medications") },
    { key: "conditions", label: t("pp_conditions", "Chronic conditions") },
    { key: "history", label: t("pp_history", "Medical history") },
    { key: "immunizations", label: t("pp_imm", "Immunizations") },
    { key: "hmo", label: t("pp_hmo", "Insurance / HMO") },
    { key: "emergencyContact", label: t("pp_ec", "Emergency contact") },
    { key: "emergencyPhone", label: t("pp_ecp", "Emergency phone") },
  ];

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("pp_title", "Health Passport")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("pp_sub", "One profile. One health history. Wherever you go.")}</p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">{t("pp_details", "Your details")}</h2>
            {!editing && (
              <button onClick={startEdit} className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:border-brand-300">
                {t("pp_edit", "Edit")}
              </button>
            )}
          </div>

          {editing ? (
            <div className="mt-4 space-y-3">
              {fields.map((f) => (
                <label key={f.key} className="block">
                  <span className="text-xs font-medium text-slate-500">{f.label}</span>
                  {f.key === "bloodGroup" ? (
                    <select
                      value={draft.bloodGroup}
                      onChange={(e) => setDraft({ ...draft, bloodGroup: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    >
                      <option value="">—</option>
                      {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  ) : (
                    <input
                      value={draft[f.key]}
                      onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  )}
                </label>
              ))}
              <div className="flex gap-2 pt-1">
                <button onClick={save} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">
                  {t("pp_save", "Save")}
                </button>
                <button onClick={() => setEditing(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">
                  {t("pp_cancel", "Cancel")}
                </button>
              </div>
            </div>
          ) : (
            <dl className="mt-4 space-y-2">
              {fields.map((f) => (
                <div key={f.key} className="flex justify-between gap-4 text-sm">
                  <dt className="text-slate-500">{f.label}</dt>
                  <dd className="text-right font-medium text-slate-800">{p[f.key] || "—"}</dd>
                </div>
              ))}
            </dl>
          )}
        </section>

        <section className="rounded-2xl border border-rose-200/70 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">{t("pp_card", "Emergency card")}</h2>
          <p className="mt-1 text-xs text-slate-500">{t("pp_card_d", "Show this to a healthcare worker in an emergency.")}</p>
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-lg font-bold text-slate-900">{p.name || "—"}</p>
            <dl className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-slate-600">{t("pp_blood", "Blood group")}</dt><dd className="font-semibold">{p.bloodGroup || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-600">{t("pp_allergies", "Allergies")}</dt><dd className="font-semibold">{p.allergies || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-600">{t("pp_meds", "Current medications")}</dt><dd className="font-semibold">{p.medications || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-600">{t("pp_conditions", "Chronic conditions")}</dt><dd className="font-semibold">{p.conditions || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-600">{t("pp_ec", "Emergency contact")}</dt><dd className="font-semibold">{p.emergencyContact} {p.emergencyPhone}</dd></div>
            </dl>
          </div>
          <div className="mt-4 flex flex-col items-center gap-2 rounded-xl bg-slate-50 p-4">
            <QRCodeSVG value={qrPayload} size={160} />
            <p className="text-xs text-slate-500">{t("pp_scan", "Scan with a HealthLink worker app")}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
