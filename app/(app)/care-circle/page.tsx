"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { useStoredCollection } from "@/lib/storage";

interface CareMember {
  id: string;
  name: string;
  relation: string;
  bp: string;
  medication: string;
  appointment: string;
  nextScreening: string;
}

const seedCircle: CareMember[] = [
  { id: "cm-1", name: "Mum", relation: "Mother", bp: "128/84 mmHg", medication: "8:00 PM daily", appointment: "Oct 15", nextScreening: "November" },
];

export default function CareCirclePage() {
  const t = useT();
  const [circle, setCircle] = useStoredCollection<CareMember>("healthlink:care-circle", seedCircle);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<Omit<CareMember, "id">>({ name: "", relation: "", bp: "", medication: "", appointment: "", nextScreening: "" });

  const add = () => {
    if (!draft.name.trim()) return;
    setCircle((prev) => [...prev, { ...draft, id: crypto.randomUUID() }]);
    setDraft({ name: "", relation: "", bp: "", medication: "", appointment: "", nextScreening: "" });
    setAdding(false);
  };

  const remove = (id: string) => setCircle((prev) => prev.filter((m) => m.id !== id));

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("cc2_title", "Care Circle")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("cc2_sub", "Keep track of the health of the people you care for.")}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {circle.map((m) => (
          <section key={m.id} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">{m.name}&apos;s Health</h2>
                <p className="text-xs text-slate-500">{m.relation}</p>
              </div>
              <button onClick={() => remove(m.id)} className="text-xs text-slate-400 hover:text-rose-600">{t("cc2_remove", "Remove")}</button>
            </div>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">{t("cc2_bp", "BP")}</dt><dd className="font-medium">{m.bp || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">{t("cc2_med", "Medication")}</dt><dd className="font-medium">{m.medication || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">{t("cc2_appt", "Appointment")}</dt><dd className="font-medium">{m.appointment || "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">{t("cc2_screen", "Next screening")}</dt><dd className="font-medium">{m.nextScreening || "—"}</dd></div>
            </dl>
          </section>
        ))}
      </div>

      {adding ? (
        <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold">{t("cc2_add", "Add a family member")}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {([["name", t("cc2_name", "Name / label")], ["relation", t("cc2_rel", "Relationship")], ["bp", t("cc2_bp", "BP")], ["medication", t("cc2_med", "Medication")], ["appointment", t("cc2_appt", "Appointment")], ["nextScreening", t("cc2_screen", "Next screening")]] as const).map(([key, label]) => (
              <label key={key} className="block">
                <span className="text-xs font-medium text-slate-500">{label}</span>
                <input
                  value={draft[key]}
                  onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={add} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800">{t("cc2_save", "Save")}</button>
            <button onClick={() => setAdding(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">{t("cc2_cancel", "Cancel")}</button>
          </div>
        </section>
      ) : (
        <button onClick={() => setAdding(true)} className="mt-6 rounded-xl border border-dashed border-slate-300 px-5 py-3 text-sm font-medium text-slate-600 hover:border-brand-300">
          + {t("cc2_addb", "Add family member")}
        </button>
      )}
    </main>
  );
}
