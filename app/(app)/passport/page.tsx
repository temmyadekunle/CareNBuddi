"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Badge,
  BottomSheet,
  Button,
  Card,
  Field,
  Screen,
  SectionHeader,
  inputClass,
  useToast,
} from "@/components/app-ui";
import { EditIcon, EmergencyIcon, HeartPulseIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { KEYS, useStoredValue } from "@/lib/storage";

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
  name: "",
  bloodGroup: "",
  allergies: "",
  medications: "",
  conditions: "",
  history: "",
  immunizations: "",
  emergencyContact: "",
  emergencyPhone: "",
  hmo: "",
};

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function PassportPage() {
  const t = useT();
  const { push } = useToast();
  const [p, setP] = useStoredValue<Passport>(KEYS.passport, emptyPassport);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Passport>(p);

  const startEdit = () => {
    setDraft(p);
    setOpen(true);
  };

  const save = () => {
    setP(draft);
    setOpen(false);
    push(t("pp_saved", "Passport updated"), "success");
  };

  const qrPayload = JSON.stringify({
    name: p.name,
    bloodGroup: p.bloodGroup,
    allergies: p.allergies,
    medications: p.medications,
    conditions: p.conditions,
    emergencyContact: p.emergencyContact,
    emergencyPhone: p.emergencyPhone,
    hmo: p.hmo,
  });

  const dash = t("pp_none", "Not set");

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

  const cardRows = [
    { label: t("pp_blood", "Blood group"), value: p.bloodGroup },
    { label: t("pp_allergies", "Allergies"), value: p.allergies },
    { label: t("pp_meds", "Current medications"), value: p.medications },
    { label: t("pp_conditions", "Chronic conditions"), value: p.conditions },
    {
      label: t("pp_ec", "Emergency contact"),
      value: `${p.emergencyContact} ${p.emergencyPhone}`.trim(),
    },
  ];

  return (
    <Screen>
      <SectionHeader
        title={t("pp_title", "Health Passport")}
        subtitle={t("pp_sub", "One profile. One health history. Wherever you go.")}
      />

      <Button tone="secondary" full className="mt-3" onClick={startEdit}>
        <EditIcon className="h-4 w-4" />
        {t("pp_edit", "Edit details")}
      </Button>

      <Card className="mt-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">{t("pp_details", "Your details")}</h2>
          <Badge tone="slate">{`${fields.filter((f) => p[f.key]).length}/${fields.length}`}</Badge>
        </div>
        <dl className="mt-3 space-y-2">
          {fields.map((f) => (
            <div key={f.key} className="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
              <dt className="shrink-0 text-xs text-slate-500">{f.label}</dt>
              <dd className="truncate text-right text-sm font-medium text-slate-900">{p[f.key] || dash}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card className="mt-3 border-rose-200/70">
        <div className="flex items-center gap-1.5">
          <EmergencyIcon className="h-4 w-4 text-rose-600" />
          <h2 className="text-sm font-semibold text-slate-900">{t("pp_card", "Emergency card")}</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">{t("pp_card_d", "Show this to a healthcare worker in an emergency.")}</p>

        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="flex items-center gap-1.5 text-base font-bold text-slate-900">
            <HeartPulseIcon className="h-4 w-4 text-rose-600" />
            {p.name || dash}
          </p>
          <dl className="mt-2 space-y-1.5">
            {cardRows.map((r) => (
              <div key={r.label} className="flex items-baseline justify-between gap-3">
                <dt className="shrink-0 text-xs text-slate-600">{r.label}</dt>
                <dd className="truncate text-right text-sm font-semibold text-slate-900">{r.value || dash}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-3 flex flex-col items-center gap-2 rounded-xl bg-slate-50 p-4">
          <QRCodeSVG value={qrPayload} size={150} />
          <p className="text-center text-xs text-slate-500">{t("pp_scan", "Scan with a CareNBuddi worker app")}</p>
        </div>
      </Card>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("pp_details", "Your details")}
        footer={
          <Button full onClick={save}>
            {t("pp_save", "Save")}
          </Button>
        }
      >
        <div className="space-y-3">
          {fields.map((f) =>
            f.key === "bloodGroup" ? (
              <Field key={f.key} label={f.label}>
                <select
                  value={draft.bloodGroup}
                  onChange={(e) => setDraft({ ...draft, bloodGroup: e.target.value })}
                  className={inputClass}
                >
                  <option value="">{dash}</option>
                  {BLOOD_GROUPS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field key={f.key} label={f.label}>
                <input
                  value={draft[f.key]}
                  onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                  className={inputClass}
                />
              </Field>
            ),
          )}
        </div>
      </BottomSheet>
    </Screen>
  );
}