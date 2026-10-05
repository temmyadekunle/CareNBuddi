"use client";

import { useMemo, useState } from "react";
import {
  BottomSheet,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  Screen,
  SectionHeader,
  useToast,
} from "@/components/app-ui";
import {
  BookIcon,
  CalendarIcon,
  ChevronRightIcon,
  EditIcon,
  TrashIcon,
} from "@/components/icons";
import { useT } from "@/lib/i18n";
import { KEYS, seedJournal, todayIso, uid, useStoredCollection } from "@/lib/storage";
import { fullDate } from "@/lib/format";
import type { JournalEntry, Mood } from "@/lib/types";

const MOOD_META: Record<Mood, { labelKey: string; label: string; tone: "green" | "brand" | "amber" | "rose" }> = {
  great: { labelKey: "jr_mood_great", label: "Great", tone: "green" },
  good: { labelKey: "jr_mood_good", label: "Good", tone: "brand" },
  okay: { labelKey: "jr_mood_okay", label: "Okay", tone: "amber" },
  low: { labelKey: "jr_mood_low", label: "Low", tone: "amber" },
  poor: { labelKey: "jr_mood_poor", label: "Poor", tone: "rose" },
};

const SYMPTOM_OPTIONS = [
  { key: "headache", labelKey: "jr_symptom_headache", label: "Headache" },
  { key: "nausea", labelKey: "jr_symptom_nausea", label: "Nausea" },
  { key: "fatigue", labelKey: "jr_symptom_fatigue", label: "Fatigue" },
  { key: "cough", labelKey: "jr_symptom_cough", label: "Cough" },
  { key: "fever", labelKey: "jr_symptom_fever", label: "Fever" },
  { key: "dizziness", labelKey: "jr_symptom_dizziness", label: "Dizziness" },
  { key: "sore_throat", labelKey: "jr_symptom_sore_throat", label: "Sore throat" },
  { key: "stomach", labelKey: "jr_symptom_stomach", label: "Stomach" },
  { key: "back", labelKey: "jr_symptom_back", label: "Back" },
  { key: "allergy", labelKey: "jr_symptom_allergy", label: "Allergy" },
  { key: "other", labelKey: "jr_symptom_other", label: "Other" },
];

export default function JournalPage() {
  const t = useT();
  const { push } = useToast();
  const [entries, setEntries] = useStoredCollection(KEYS.journal, seedJournal);
  const [date, setDate] = useState(todayIso());
  const [mood, setMood] = useState<Mood>("good");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [weightKg, setWeightKg] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [sys, setSys] = useState("");
  const [dia, setDia] = useState("");
  const [sleepHours, setSleepHours] = useState("");
  const [steps, setSteps] = useState("");
  const [note, setNote] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.date.localeCompare(a.date)),
    [entries],
  );

  const toggleSymptom = (s: string) => {
    setSymptoms((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };

  const openNew = () => {
    setEditingId(null);
    setDate(todayIso());
    setMood("good");
    setSymptoms([]);
    setWeightKg("");
    setHeartRate("");
    setSys("");
    setDia("");
    setSleepHours("");
    setSteps("");
    setNote("");
    setShowForm(true);
  };

  const editEntry = (entry: JournalEntry) => {
    setEditingId(entry.id);
    setDate(entry.date);
    setMood(entry.mood);
    setSymptoms(entry.symptoms);
    setWeightKg(entry.vitals.weightKg?.toString() ?? "");
    setHeartRate(entry.vitals.heartRate?.toString() ?? "");
    setSys(entry.vitals.systolic?.toString() ?? "");
    setDia(entry.vitals.diastolic?.toString() ?? "");
    setSleepHours(entry.vitals.sleepHours?.toString() ?? "");
    setSteps(entry.vitals.steps?.toString() ?? "");
    setNote(entry.note ?? "");
    setShowForm(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const base: JournalEntry = {
      id: editingId ?? uid(),
      date,
      mood,
      symptoms,
      vitals: {
        weightKg: weightKg ? Number(weightKg) : undefined,
        heartRate: heartRate ? Number(heartRate) : undefined,
        systolic: sys ? Number(sys) : undefined,
        diastolic: dia ? Number(dia) : undefined,
        sleepHours: sleepHours ? Number(sleepHours) : undefined,
        steps: steps ? Number(steps) : undefined,
      },
      note: note.trim(),
    };
    if (editingId) {
      setEntries((prev) => prev.map((e) => (e.id === editingId ? base : e)));
      push(t("jr_saved", "Entry saved"), "success");
    } else {
      setEntries((prev) => [...prev, base]);
      push(t("jr_saved", "Entry saved"), "success");
    }
    setShowForm(false);
    setEditingId(null);
  };

  const confirmRemove = () => {
    const id = toDelete;
    if (!id) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (expanded === id) setExpanded(null);
    setToDelete(null);
    push(t("jr_deleted", "Entry deleted"), "info");
  };

  const moodToneClasses: Record<string, string> = {
    green: "bg-green-50 text-green-700",
    brand: "bg-brand-50 text-brand-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
  };

  return (
    <Screen>
      <SectionHeader
        title={t("jr_title_page", "Health journal")}
        subtitle={t("jr_sub_page", "Log your mood, symptoms, and vitals each day.")}
      />
      <Button full onClick={openNew} className="mb-4">
        {t("jr_add_entry", "Add entry")}
      </Button>

      <div className="space-y-3">
        {sorted.length === 0 ? (
          <EmptyState
            icon={<BookIcon className="h-6 w-6" />}
            title={t("jr_empty_title", "No journal entries yet")}
            body={t("jr_empty_body", "Start tracking your health by adding your first entry today.")}
            action={
              <Button tone="secondary" onClick={openNew} className="mt-2">
                {t("jr_add_entry", "Add entry")}
              </Button>
            }
          />
        ) : (
          sorted.map((entry) => {
            const meta = MOOD_META[entry.mood];
            const isOpen = expanded === entry.id;
            const vitals = Object.entries(entry.vitals)
              .filter(([, v]) => v != null)
              .map(([k, v]) => ({ k, v: v as number }));
            return (
              <Card key={entry.id} padded={false} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : entry.id)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left"
                >
                  <span
                    className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      moodToneClasses[meta?.tone ?? "brand"]
                    }`}
                  >
                    <CalendarIcon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {fullDate(entry.date)}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      {t(meta?.labelKey ?? "jr_mood_unknown", meta?.label ?? "Mood")}
                      {entry.symptoms.length > 0
                        ? ` · ${entry.symptoms.slice(0, 2).join(", ")}${
                            entry.symptoms.length > 2 ? " +" + (entry.symptoms.length - 2) : ""
                          }`
                        : ""}
                    </span>
                  </span>
                  <ChevronRightIcon
                    className={`h-4 w-4 shrink-0 text-slate-300 transition-transform ${
                      isOpen ? "rotate-90" : ""
                    }`}
                  />
                </button>
                {isOpen && (
                  <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                    {entry.symptoms.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {entry.symptoms.map((s) => (
                          <span
                            key={s}
                            className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    )}
                    {entry.note && <p className="mb-3 text-sm text-slate-700">{entry.note}</p>}
                    {vitals.length > 0 && (
                      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {vitals.map(({ k, v }) => (
                          <div key={k} className="rounded-xl bg-slate-50 px-3 py-2">
                            <p className="text-[11px] text-slate-500">{label(t, k)}</p>
                            <p className="text-sm font-semibold text-slate-900">{v}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <Button tone="secondary" onClick={() => editEntry(entry)}>
                        <EditIcon className="h-4 w-4" />
                        {t("jr_edit", "Edit")}
                      </Button>
                      <Button tone="danger" onClick={() => setToDelete(entry.id)}>
                        <TrashIcon className="h-4 w-4" />
                        {t("jr_delete", "Delete")}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      <BottomSheet
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingId(null);
        }}
        title={editingId ? t("jr_edit_entry", "Edit entry") : t("jr_form_new", "New entry")}
        footer={
          <Button full onClick={submit}>
            {t("jr_save", "Save entry")}
          </Button>
        }
      >
        <form onSubmit={submit} className="space-y-3">
          <Field label={t("jr_date", "Date")}>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-base text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </Field>

          <Field label={t("jr_mood", "Mood")}>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(MOOD_META).map(([value, meta]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMood(value as Mood)}
                  className={`tap min-h-9 rounded-full px-3.5 text-xs font-semibold ${
                    mood === value
                      ? "bg-brand-700 text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-brand-300"
                  }`}
                >
                  {t(meta.labelKey, meta.label)}
                </button>
              ))}
            </div>
          </Field>

          <Field label={t("jr_symptoms", "Symptoms")}>
            <div className="flex flex-wrap gap-1.5">
              {SYMPTOM_OPTIONS.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => toggleSymptom(s.key)}
                  className={`tap min-h-9 rounded-full border px-3.5 text-xs font-semibold ${
                    symptoms.includes(s.key)
                      ? "border-brand-700 bg-brand-700 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-brand-300"
                  }`}
                >
                  {t(s.labelKey, s.label)}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label={t("jr_vitals_weight", "Weight (kg)")}>
              <input
                type="number"
                min="0"
                step="any"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-base text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </Field>
            <Field label={t("jr_vitals_heart", "Heart rate (bpm)")}>
              <input
                type="number"
                min="0"
                step="any"
                value={heartRate}
                onChange={(e) => setHeartRate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-base text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </Field>
            <Field label={t("jr_vitals_sleep", "Sleep (hrs)")}>
              <input
                type="number"
                min="0"
                step="any"
                value={sleepHours}
                onChange={(e) => setSleepHours(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-base text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </Field>
            <Field label={t("jr_vitals_steps", "Steps")}>
              <input
                type="number"
                min="0"
                step="any"
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-base text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </Field>
            <Field label={t("jr_vitals_bp_sys", "BP systolic")}>
              <input
                type="number"
                min="0"
                step="any"
                value={sys}
                onChange={(e) => setSys(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-base text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </Field>
            <Field label={t("jr_vitals_bp_dia", "BP diastolic")}>
              <input
                type="number"
                min="0"
                step="any"
                value={dia}
                onChange={(e) => setDia(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-base text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              />
            </Field>
          </div>

          <Field label={t("jr_notes", "Notes")}>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              placeholder={t("jr_note_ph", "How did your day go?")}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-base text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </Field>
        </form>
      </BottomSheet>

      <ConfirmDialog
        open={toDelete !== null}
        title={t("jr_delete_confirm_title", "Delete journal entry?")}
        body={t("jr_delete_confirm_body", "This entry will be permanently removed.")}
        confirmLabel={t("jr_confirm_delete", "Yes, delete")}
        cancelLabel={t("jr_cancel", "Cancel")}
        tone="danger"
        onConfirm={confirmRemove}
        onCancel={() => setToDelete(null)}
      />
    </Screen>
  );
}

function label(t: (key: string, fallback?: string) => string, key: string): string {
  const map: Record<string, [string, string]> = {
    weightKg: ["jr_vitals_weight", "Weight (kg)"],
    heartRate: ["jr_vitals_heart", "Heart rate (bpm)"],
    systolic: ["jr_vitals_bp_sys", "BP systolic"],
    diastolic: ["jr_vitals_bp_dia", "BP diastolic"],
    sleepHours: ["jr_vitals_sleep", "Sleep (hrs)"],
    steps: ["jr_vitals_steps", "Steps"],
  };
  const entry = map[key];
  return entry ? t(entry[0], entry[1]) : key;
}