"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  BottomSheet,
  Chip,
  EmptyState,
  Field,
  Screen,
  SectionHeader,
  Segmented,
  inputClass,
  useToast,
} from "@/components/app-ui";
import { ActivityIcon, EmergencyIcon, PhoneIcon, PlusIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { KEYS, seedSymptomEntries, seedUsers, uid, useSession, useStoredCollection, useStoredValue } from "@/lib/storage";
import { COMMON_SYMPTOMS, DEFAULT_HEALTH_PREFERENCES, SYMPTOM_SEVERITIES, SYMPTOM_TRENDS, type SymptomSeverity, type SymptomTrend } from "@/lib/types";

const CYCLE_SYMPTOMS = ["Cramps", "Bloating", "Breast tenderness", "Mood swings", "Acne", "Food cravings", "Back pain", "Headache", "Fatigue", "Nausea"];

export default function SymptomDiaryPage() {
  const t = useT();
  const { push } = useToast();
  const [session] = useSession();
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const [entries, setEntries] = useStoredCollection(KEYS.symptomEntries, seedSymptomEntries);
  const [prefs] = useStoredValue(KEYS.healthPreferences, DEFAULT_HEALTH_PREFERENCES);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [severity, setSeverity] = useState<SymptomSeverity | "">("");
  const [duration, setDuration] = useState("");
  const [trend, setTrend] = useState<SymptomTrend>("unchanged");
  const [notes, setNotes] = useState("");
  const [factors, setFactors] = useState<string[]>([]);
  const [customFactor, setCustomFactor] = useState("");

  const me = users.find((u) => u.id === session.userId);
  const today = new Date().toISOString().slice(0, 10);
  const sorted = useMemo(() => [...entries].sort((a, b) => `${b.date}${b.time ?? ""}`.localeCompare(`${a.date}${a.time ?? ""}`)), [entries]);

  const suggestions = useMemo(() => {
    const base = [...COMMON_SYMPTOMS];
    if (prefs.menstrualTrackingEnabled) {
      for (const s of CYCLE_SYMPTOMS) {
        if (!base.includes(s)) base.push(s);
      }
    }
    return base;
  }, [prefs.menstrualTrackingEnabled]);

  const weekAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }, []);
  const frequent = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) {
      if (e.date >= weekAgo) counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [entries, weekAgo]);

  if (!me) {
    return (
      <Screen>
        <Card className="mt-4 flex flex-col items-center gap-3 py-10 text-center">
          <h2 className="text-base font-semibold text-slate-900">
            {t("mh_guest_title", "Sign in to track your health")}
          </h2>
          <Link href="/auth/sign-in" className="mt-2 w-full max-w-[16rem]">
            <Button full>{t("mh_guest_cta", "Sign in or create account")}</Button>
          </Link>
        </Card>
      </Screen>
    );
  }

  if (!prefs.symptomTrackingEnabled) {
    return (
      <Screen>
        <SectionHeader title={t("sd_title", "Symptom diary")} subtitle={t("sd_sub", "Track symptoms over time. Spot patterns and share with your care team.")} />
        <div className="mt-4">
          <EmptyState
            icon={<ActivityIcon className="h-6 w-6" />}
            title={t("sd_disabled_title", "Symptom tracking is off")}
            body={t("sd_disabled_body", "Turn it on in preferences to log symptoms.")}
            action={
              <Link href="/health/diary/preferences" className="mt-2 inline-block">
                <Button tone="secondary">{t("mh_prefs", "Preferences")}</Button>
              </Link>
            }
          />
        </div>
      </Screen>
    );
  }

  const resetForm = () => {
    setEditingId(null);
    setDate(today);
    setTime("");
    setName("");
    setSeverity("");
    setDuration("");
    setTrend("unchanged");
    setNotes("");
    setFactors([]);
    setCustomFactor("");
  };

  const openAdd = (preset?: string) => {
    resetForm();
    if (preset) setName(preset);
    setSheetOpen(true);
  };

  const openEdit = (id: string) => {
    const e = entries.find((x) => x.id === id);
    if (!e) return;
    setEditingId(id);
    setDate(e.date);
    setTime(e.time ?? "");
    setName(e.name);
    setSeverity(e.severity);
    setDuration(e.durationMinutes !== undefined ? String(e.durationMinutes) : "");
    setTrend(e.trend);
    setNotes(e.notes ?? "");
    setFactors(e.relatedFactors ?? []);
    setCustomFactor("");
    setSheetOpen(true);
  };

  const toggleFactor = (f: string) => {
    setFactors((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  };

  const addCustomFactor = () => {
    const v = customFactor.trim();
    if (!v) return;
    if (!factors.includes(v)) setFactors((prev) => [...prev, v]);
    setCustomFactor("");
  };

  const save = () => {
    if (!date) {
      push(t("sd_need_date", "Choose a date first."), "error");
      return;
    }
    if (date > today) {
      push(t("sd_future_date", "Date cannot be in the future."), "error");
      return;
    }
    const cleanName = name.trim();
    if (!cleanName) {
      push(t("sd_need_name", "Name the symptom first."), "error");
      return;
    }
    if (!severity) {
      push(t("sd_need_severity", "Choose a severity first."), "error");
      return;
    }
    const dur = duration === "" ? undefined : Number(duration);
    if (dur !== undefined && (!Number.isFinite(dur) || dur < 0 || dur > 10080)) {
      push(t("sd_bad_duration", "Duration must be between 0 and 10080 minutes (one week)."), "error");
      return;
    }
    const now = new Date().toISOString();
    if (editingId) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === editingId
            ? { ...e, date, time: time || undefined, name: cleanName, severity, durationMinutes: dur, trend, notes: notes.trim() || undefined, relatedFactors: factors.length ? factors : undefined, updatedAt: now }
            : e,
        ),
      );
      push(t("sd_updated", "Symptom entry updated"), "success");
    } else {
      setEntries((prev) => [
        ...prev,
        { id: uid(), date, time: time || undefined, name: cleanName, severity, durationMinutes: dur, trend, notes: notes.trim() || undefined, relatedFactors: factors.length ? factors : undefined, createdAt: now, updatedAt: now },
      ]);
      push(t("sd_saved", "Symptom entry saved"), "success");
    }
    setSheetOpen(false);
    resetForm();
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    setEntries((prev) => prev.filter((e) => e.id !== deleteId));
    setDeleteId(null);
    push(t("sd_deleted", "Symptom entry deleted"), "success");
  };

  const severityTone = (s: SymptomSeverity): "green" | "amber" | "rose" =>
    s === "severe" ? "rose" : s === "moderate" ? "amber" : "green";

  return (
    <Screen>
      <SectionHeader
        title={t("sd_title", "Symptom diary")}
        subtitle={t("sd_sub", "Track symptoms over time. Spot patterns and share with your care team.")}
      />

      <Card className="mt-3 border-rose-200 bg-rose-50/70">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white">
            <EmergencyIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-rose-900">
              {t("sd_urgent_title", "Severe or life-threatening symptom?")}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-rose-800">
              {t("sd_urgent_body", "Do not log it and wait. Call for help first — this diary never replaces emergency care.")}
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <a href="tel:112" className="tap inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 text-xs font-semibold text-white">
                <PhoneIcon className="h-3.5 w-3.5" />
                {t("sd_call_112", "Call 112")}
              </a>
              <Link href="/emergency" className="tap inline-flex min-h-9 items-center rounded-xl border border-rose-300 bg-white px-3.5 text-xs font-semibold text-rose-700">
                {t("em_title", "Get Help Now")}
              </Link>
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-3">
        <Button full onClick={() => openAdd()}>
          <PlusIcon className="h-4 w-4" />
          {t("sd_new_entry", "New symptom entry")}
        </Button>
      </div>

      {frequent.length > 0 && (
        <Card className="mt-4">
          <p className="text-xs font-semibold text-slate-600">{t("sd_this_week", "Recorded this week")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {frequent.map(([symptomName, count]) => (
              <Badge key={symptomName} tone="slate">
                {symptomName} · {count}
              </Badge>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            {t("sd_counts_note", "A simple count of what you recorded — not a diagnosis of any cause.")}
          </p>
        </Card>
      )}

      <SectionHeader title={t("sd_history", "History")} subtitle={t("sd_history_d", "Newest first.")} />
      {sorted.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            icon={<ActivityIcon className="h-6 w-6" />}
            title={t("sd_empty", "No symptom entries yet")}
            body={t("sd_empty_d", "Add your first entry to start tracking.")}
            action={
              <Button tone="secondary" className="mt-2" onClick={() => openAdd()}>
                {t("sd_new_entry", "New symptom entry")}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-3 space-y-2.5">
          {sorted.map((e) => (
            <Card key={e.id} className="p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{e.name}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {new Date(`${e.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                    {e.time ? ` · ${e.time}` : ""}
                    {e.durationMinutes !== undefined ? ` · ${e.durationMinutes}${t("sd_min_short", " min")}` : ""}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone={severityTone(e.severity)}>{e.severity}</Badge>
                    <Badge tone="slate">{e.trend}</Badge>
                  </div>
                </div>
              </div>
              {e.severity === "severe" && (
                <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-[11px] font-medium leading-relaxed text-rose-700">
                  {t("sd_severe_note", "Marked severe. If this feels like an emergency, call 112 now — do not wait on this diary.")}
                </p>
              )}
              {(e.notes || e.relatedFactors?.length) && (
                <p className="mt-2 line-clamp-2 text-xs leading-snug text-slate-500">
                  {[e.notes, e.relatedFactors?.join(", ")].filter(Boolean).join(" · ")}
                </p>
              )}
              <div className="mt-2.5 flex gap-2">
                <Button tone="secondary" className="min-h-9 flex-1 px-3 text-xs" onClick={() => openEdit(e.id)}>
                  {t("sd_edit", "Edit")}
                </Button>
                <Button tone="secondary" className="min-h-9 flex-1 px-3 text-xs" onClick={() => setDeleteId(e.id)}>
                  {t("sd_delete", "Delete")}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <BottomSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          resetForm();
        }}
        title={editingId ? t("sd_edit_title", "Edit symptom entry") : t("sd_new_entry", "New symptom entry")}
        footer={
          <Button full onClick={save}>
            {t("sd_save", "Save entry")}
          </Button>
        }
      >
        <div className="space-y-4">
          {severity === "severe" && (
            <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-medium leading-relaxed text-rose-700">
              {t("sd_severe_form", "Severe selected. If this is an emergency, stop here and call 112 — logging can wait.")}
              {" "}
              <a href="tel:112" className="font-bold underline">
                {t("sd_call_112", "Call 112")}
              </a>
            </p>
          )}
          <Field label={t("sd_symptom", "Symptom")}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("sd_name_ph", "e.g. Headache")}
              className={`${inputClass} min-h-11`}
            />
          </Field>
          <div>
            <p className="text-xs font-semibold text-slate-600">{t("sd_suggestions", "Common symptoms")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <Chip key={s} active={name === s} onClick={() => setName(s)}>
                  {s}
                </Chip>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label={t("sd_date", "Date")}>
              <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={`${inputClass} min-h-11`} />
            </Field>
            <Field label={t("sd_time", "Time")}>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`${inputClass} min-h-11`} />
            </Field>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-600">{t("sd_severity", "Severity")}</p>
            <div className="mt-2">
              <Segmented<SymptomSeverity | "">
                options={[
                  { value: "" as SymptomSeverity | "", label: t("sd_skip", "Skip") },
                  ...SYMPTOM_SEVERITIES.map((s) => ({ value: s.value as SymptomSeverity | "", label: s.label })),
                ]}
                value={severity}
                onChange={setSeverity}
              />
            </div>
          </div>
          <Field label={t("sd_duration", "Duration (minutes)")}>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={10080}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder={t("sd_duration_ph", "e.g. 30")}
              className={`${inputClass} min-h-11`}
            />
          </Field>
          <div>
            <p className="text-xs font-semibold text-slate-600">{t("sd_trend", "Trend")}</p>
            <div className="mt-2">
              <Segmented<SymptomTrend>
                options={SYMPTOM_TRENDS.map((s) => ({ value: s.value, label: s.label }))}
                value={trend}
                onChange={setTrend}
              />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-600">{t("sd_related_factors", "Related factors")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {["Stress", "Poor sleep", "Diet", "Weather", "Exercise", "Medication change"].map((f) => (
                <Chip key={f} active={factors.includes(f)} onClick={() => toggleFactor(f)}>
                  {f}
                </Chip>
              ))}
              {factors.filter((f) => !["Stress", "Poor sleep", "Diet", "Weather", "Exercise", "Medication change"].includes(f)).map((f) => (
                <Chip key={f} active onClick={() => toggleFactor(f)}>
                  {f}
                </Chip>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                value={customFactor}
                onChange={(e) => setCustomFactor(e.target.value)}
                placeholder={t("sd_factor_ph", "Add your own…")}
                className={`${inputClass} min-h-11 flex-1`}
              />
              <Button tone="secondary" onClick={addCustomFactor}>
                {t("sd_add_factor", "Add")}
              </Button>
            </div>
          </div>
          <Field label={t("sd_notes", "Notes")}>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("sd_notes_ph", "Anything worth remembering…")} className={`${inputClass} min-h-11 resize-none`} />
          </Field>
        </div>
      </BottomSheet>

      <ConfirmDialog
        open={deleteId !== null}
        title={t("sd_delete_title", "Delete this entry?")}
        body={t("sd_delete_body", "This cannot be undone.")}
        confirmLabel={t("sd_delete_yes", "Yes, delete")}
        cancelLabel={t("sd_delete_no", "Keep it")}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />

      <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-400">
        {t("mh_disclaimer", "My Health Diary is for personal tracking only. It does not provide medical advice, diagnosis, or treatment. Always consult a healthcare professional for medical concerns.")}
      </p>
    </Screen>
  );
}
