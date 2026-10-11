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
import { CalendarIcon, PlusIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { KEYS, seedMenstrualCycles, seedUsers, uid, useSession, useStoredCollection, useStoredValue } from "@/lib/storage";
import { DEFAULT_HEALTH_PREFERENCES, type FlowIntensity } from "@/lib/types";
import { calculateCycleStats, formatDate, getPhaseDescription, getPhaseLabel } from "@/lib/cycle";

const CYCLE_SYMPTOMS = ["Cramps", "Bloating", "Headache", "Back pain", "Breast tenderness", "Mood swings", "Fatigue", "Nausea", "Acne", "Food cravings"];

const FLOW_VALUES: FlowIntensity[] = ["spotting", "light", "medium", "heavy"];

function flowTone(flow?: FlowIntensity): "rose" | "amber" | "slate" {
  if (flow === "heavy") return "rose";
  if (flow === "medium") return "amber";
  return "slate";
}

export default function CycleTrackerPage() {
  const t = useT();
  const { push } = useToast();
  const [session] = useSession();
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const [cycles, setCycles] = useStoredCollection(KEYS.menstrualCycles, seedMenstrualCycles);
  const [prefs] = useStoredValue(KEYS.healthPreferences, DEFAULT_HEALTH_PREFERENCES);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [flow, setFlow] = useState<FlowIntensity | "">("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  const me = users.find((u) => u.id === session.userId);
  const stats = useMemo(() => calculateCycleStats(cycles), [cycles]);
  const sorted = useMemo(() => [...cycles].sort((a, b) => b.startDate.localeCompare(a.startDate)), [cycles]);
  const today = new Date().toISOString().slice(0, 10);

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

  if (!prefs.menstrualTrackingEnabled) {
    return (
      <Screen>
        <SectionHeader title={t("ct_title", "Cycle tracker")} subtitle={t("ct_sub", "Track your period, flow and symptoms. See predictions and insights.")} />
        <div className="mt-4">
          <EmptyState
            icon={<CalendarIcon className="h-6 w-6" />}
            title={t("ct_disabled_title", "Cycle tracking is off")}
            body={t("ct_disabled_body", "Turn it on in preferences to log periods and see estimates.")}
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
    setStartDate("");
    setEndDate("");
    setFlow("");
    setSymptoms([]);
    setNotes("");
  };

  const openAdd = () => {
    resetForm();
    setStartDate(today);
    setSheetOpen(true);
  };

  const openEdit = (id: string) => {
    const c = cycles.find((x) => x.id === id);
    if (!c) return;
    setEditingId(id);
    setStartDate(c.startDate);
    setEndDate(c.endDate ?? "");
    setFlow(c.flowIntensity ?? "");
    setSymptoms(c.symptoms ?? []);
    setNotes(c.notes ?? "");
    setSheetOpen(true);
  };

  const toggleSymptom = (s: string) => {
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const save = () => {
    if (!startDate) {
      push(t("ct_need_start", "Choose a start date first."), "error");
      return;
    }
    if (startDate > today) {
      push(t("ct_future_start", "Start date cannot be in the future."), "error");
      return;
    }
    if (endDate && endDate < startDate) {
      push(t("ct_end_before_start", "End date cannot be before the start date."), "error");
      return;
    }
    if (endDate && endDate > today) {
      push(t("ct_future_end", "End date cannot be in the future."), "error");
      return;
    }
    const now = Date.now();
    if (editingId) {
      setCycles((prev) =>
        prev.map((c) =>
          c.id === editingId
            ? { ...c, startDate, endDate: endDate || undefined, flowIntensity: (flow || undefined) as FlowIntensity | undefined, symptoms, notes: notes.trim() || undefined, updatedAt: new Date(now).toISOString() }
            : c,
        ),
      );
      push(t("ct_updated", "Period updated"), "success");
    } else {
      setCycles((prev) => [
        ...prev,
        {
          id: uid(),
          startDate,
          endDate: endDate || undefined,
          flowIntensity: (flow || undefined) as FlowIntensity | undefined,
          symptoms,
          notes: notes.trim() || undefined,
          createdAt: new Date(now).toISOString(),
          updatedAt: new Date(now).toISOString(),
        },
      ]);
      push(t("ct_saved", "Period logged"), "success");
    }
    setSheetOpen(false);
    resetForm();
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    setCycles((prev) => prev.filter((c) => c.id !== deleteId));
    setDeleteId(null);
    push(t("ct_deleted", "Period deleted"), "success");
  };

  const periodLengthOf = (start: string, end?: string) => {
    if (!end) return null;
    return Math.round((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  return (
    <Screen>
      <SectionHeader
        title={t("ct_title", "Cycle tracker")}
        subtitle={t("ct_sub", "Track your period, flow and symptoms. See predictions and insights.")}
      />

      <div className="mt-3">
        <Button full onClick={openAdd}>
          <PlusIcon className="h-4 w-4" />
          {t("ct_new_period", "Log period")}
        </Button>
      </div>

      {stats.cyclesUsed >= 2 && stats.nextPeriodStart ? (
        <Card className="mt-4 border-pink-200 bg-pink-50/70">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-pink-800">
            {t("ct_estimates", "Estimates")}
          </h2>
          <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
            <div className="rounded-xl border border-pink-100 bg-white p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-pink-600">{t("mh_next_period", "Next period")}</p>
              <p className="mt-1 text-base font-bold text-pink-800">{formatDate(stats.nextPeriodStart)}</p>
              {stats.nextPeriodEnd && (
                <p className="mt-0.5 text-[11px] text-pink-600">
                  {t("mh_until", "Until")} {formatDate(stats.nextPeriodEnd)}
                </p>
              )}
            </div>
            {stats.ovulationDate && (
              <div className="rounded-xl border border-green-100 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-green-600">{t("mh_ovulation", "Estimated ovulation")}</p>
                <p className="mt-1 text-base font-bold text-green-800">{formatDate(stats.ovulationDate)}</p>
                {stats.fertileWindowStart && stats.fertileWindowEnd ? (
                  <p className="mt-0.5 text-[11px] text-green-600">
                    {t("mh_fertile_window", "Fertile window")} {formatDate(stats.fertileWindowStart)} – {formatDate(stats.fertileWindowEnd)}
                  </p>
                ) : null}
              </div>
            )}
            {stats.currentCycleDay && stats.currentPhase && (
              <div className="rounded-xl border border-slate-100 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{t("mh_current_phase", "Current phase")}</p>
                <p className="mt-1 text-base font-bold text-slate-900">
                  {getPhaseLabel(stats.currentPhase, t)} · {t("mh_day_of_cycle", "Day {n}").replace("{n}", String(stats.currentCycleDay))}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">{getPhaseDescription(stats.currentPhase, t)}</p>
              </div>
            )}
            {stats.averageCycleLength && (
              <div className="rounded-xl border border-slate-100 bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{t("mh_avg_cycle", "Avg cycle")}</p>
                <p className="mt-1 text-base font-bold text-slate-900">
                  {stats.averageCycleLength} {t("mh_days", "days")}
                  {stats.averagePeriodLength ? ` · ${stats.averagePeriodLength}${t("mh_days_short", "d")} ${t("mh_period", "period")}` : ""}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  {t("ct_based_on", "Based on {n} cycles").replace("{n}", String(stats.cyclesUsed))}
                  {stats.isIrregular ? ` · ${t("mh_irregular", "Irregular pattern detected")}` : ""}
                </p>
              </div>
            )}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-pink-800">
            {t(
              "ct_estimates_note",
              "Estimates only — not guarantees. Fertility estimates must not be treated as reliable contraception.",
            )}
          </p>
        </Card>
      ) : (
        <Card className="mt-4">
          <p className="text-sm font-semibold text-slate-900">{t("ct_need_history_title", "Estimates need more history")}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {t(
              "ct_need_history_body",
              "Log at least two completed periods and this page will estimate your next period, ovulation and fertile window. Nothing is predicted until then.",
            )}
          </p>
          {stats.cyclesUsed === 1 && (
            <p className="mt-2 text-xs text-slate-500">{t("ct_one_cycle", "1 cycle recorded so far.")}</p>
          )}
        </Card>
      )}

      <SectionHeader title={t("ct_history", "History")} subtitle={t("ct_history_d", "Newest first. Tap to edit.")} />
      {sorted.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            icon={<CalendarIcon className="h-6 w-6" />}
            title={t("ct_empty", "No periods recorded yet")}
            body={t("ct_empty_d", "Add your first period to start building history.")}
            action={
              <Button tone="secondary" className="mt-2" onClick={openAdd}>
                {t("ct_new_period", "Log period")}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-3 space-y-2.5">
          {sorted.map((c) => {
            const len = periodLengthOf(c.startDate, c.endDate);
            return (
              <Card key={c.id} className="p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {formatDate(c.startDate)}
                      {c.endDate ? ` – ${formatDate(c.endDate)}` : ` · ${t("ct_ongoing", "ongoing")}`}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {len ? `${len} ${t("mh_days", "days")}` : t("ct_no_end", "No end date yet")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {c.flowIntensity && <Badge tone={flowTone(c.flowIntensity)}>{c.flowIntensity}</Badge>}
                  </div>
                </div>
                {(c.symptoms?.length || c.notes) && (
                  <p className="mt-2 line-clamp-2 text-xs leading-snug text-slate-500">
                    {[c.symptoms?.join(", "), c.notes].filter(Boolean).join(" · ")}
                  </p>
                )}
                <div className="mt-2.5 flex gap-2">
                  <Button tone="secondary" className="min-h-9 flex-1 px-3 text-xs" onClick={() => openEdit(c.id)}>
                    {t("ct_edit", "Edit")}
                  </Button>
                  <Button tone="secondary" className="min-h-9 flex-1 px-3 text-xs" onClick={() => setDeleteId(c.id)}>
                    {t("ct_delete", "Delete")}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <BottomSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          resetForm();
        }}
        title={editingId ? t("ct_edit_title", "Edit period") : t("ct_new_period", "Log period")}
        footer={
          <Button full onClick={save}>
            {t("ct_save", "Save period")}
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            <Field label={t("ct_start_date", "Start date")}>
              <input type="date" value={startDate} max={today} onChange={(e) => setStartDate(e.target.value)} className={`${inputClass} min-h-11`} />
            </Field>
            <Field label={t("ct_end_date", "End date")}>
              <input type="date" value={endDate} min={startDate || undefined} max={today} onChange={(e) => setEndDate(e.target.value)} className={`${inputClass} min-h-11`} />
            </Field>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-600">{t("ct_flow", "Flow")}</p>
            <div className="mt-2">
              <Segmented<FlowIntensity | "">
                options={[
                  { value: "", label: t("ct_flow_none", "Skip") },
                  ...FLOW_VALUES.map((v) => ({ value: v as FlowIntensity | "", label: v })),
                ]}
                value={flow}
                onChange={setFlow}
              />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-600">{t("ct_symptoms", "Symptoms")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {CYCLE_SYMPTOMS.map((s) => (
                <Chip key={s} active={symptoms.includes(s)} onClick={() => toggleSymptom(s)}>
                  {s}
                </Chip>
              ))}
            </div>
          </div>
          <Field label={t("ct_notes", "Notes")}>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("ct_notes_ph", "Anything worth remembering…")} className={`${inputClass} min-h-11 resize-none`} />
          </Field>
        </div>
      </BottomSheet>

      <ConfirmDialog
        open={deleteId !== null}
        title={t("ct_delete_title", "Delete this period?")}
        body={t("ct_delete_body", "This cannot be undone.")}
        confirmLabel={t("ct_delete_yes", "Yes, delete")}
        cancelLabel={t("ct_delete_no", "Keep it")}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />

      <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-400">
        {t("mh_disclaimer", "My Health Diary is for personal tracking only. It does not provide medical advice, diagnosis, or treatment. Always consult a healthcare professional for medical concerns.")}
      </p>
    </Screen>
  );
}
