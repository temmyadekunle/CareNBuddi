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
import { BrainIcon, PlusIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { KEYS, seedMoodEntries, seedUsers, uid, useSession, useStoredCollection, useStoredValue } from "@/lib/storage";
import { DEFAULT_HEALTH_PREFERENCES, MOOD_TYPES, type MoodType } from "@/lib/types";

const INTENSITY_OPTIONS = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5" },
];

function toIntensity(value: string): 1 | 2 | 3 | 4 | 5 {
  const n = Number(value);
  if (n === 1 || n === 2 || n === 3 || n === 4 || n === 5) return n;
  return 3;
}

const MOOD_TONE: Record<MoodType, "brand" | "green" | "amber" | "rose" | "slate"> = {
  happy: "green",
  calm: "brand",
  sad: "slate",
  anxious: "amber",
  stressed: "amber",
  irritable: "rose",
  lonely: "slate",
  tired: "slate",
  overwhelmed: "rose",
  hopeful: "green",
  other: "slate",
};

export default function MoodDiaryPage() {
  const t = useT();
  const { push } = useToast();
  const [session] = useSession();
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const [entries, setEntries] = useStoredCollection(KEYS.moodEntries, seedMoodEntries);
  const [prefs] = useStoredValue(KEYS.healthPreferences, DEFAULT_HEALTH_PREFERENCES);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [mood, setMood] = useState<MoodType | "">("");
  const [intensity, setIntensity] = useState("3");
  const [notes, setNotes] = useState("");
  const [sleepHours, setSleepHours] = useState("");
  const [energy, setEnergy] = useState("");

  const me = users.find((u) => u.id === session.userId);
  const today = new Date().toISOString().slice(0, 10);
  const sorted = useMemo(() => [...entries].sort((a, b) => `${b.date}${b.time ?? ""}`.localeCompare(`${a.date}${a.time ?? ""}`)), [entries]);
  const weekAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }, []);
  const weekCount = useMemo(() => entries.filter((e) => e.date >= weekAgo).length, [entries, weekAgo]);

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

  if (!prefs.moodTrackingEnabled) {
    return (
      <Screen>
        <SectionHeader title={t("md_title", "Mood diary")} subtitle={t("md_sub", "Log how you feel each day. Build a picture of your emotional wellbeing.")} />
        <div className="mt-4">
          <EmptyState
            icon={<BrainIcon className="h-6 w-6" />}
            title={t("md_disabled_title", "Mood tracking is off")}
            body={t("md_disabled_body", "Turn it on in preferences to log moods.")}
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
    setMood("");
    setIntensity("3");
    setNotes("");
    setSleepHours("");
    setEnergy("");
  };

  const openAdd = () => {
    resetForm();
    setSheetOpen(true);
  };

  const openEdit = (id: string) => {
    const e = entries.find((x) => x.id === id);
    if (!e) return;
    setEditingId(id);
    setDate(e.date);
    setTime(e.time ?? "");
    setMood(e.mood);
    setIntensity(String(e.intensity));
    setNotes(e.notes ?? "");
    setSleepHours(e.sleepHours !== undefined ? String(e.sleepHours) : "");
    setEnergy(e.energyLevel !== undefined ? String(e.energyLevel) : "");
    setSheetOpen(true);
  };

  const save = () => {
    if (!date) {
      push(t("md_need_date", "Choose a date first."), "error");
      return;
    }
    if (date > today) {
      push(t("md_future_date", "Date cannot be in the future."), "error");
      return;
    }
    if (!mood) {
      push(t("md_need_mood", "Choose a mood first."), "error");
      return;
    }
    const sleep = sleepHours === "" ? undefined : Number(sleepHours);
    if (sleep !== undefined && (!Number.isFinite(sleep) || sleep < 0 || sleep > 24)) {
      push(t("md_bad_sleep", "Sleep must be between 0 and 24 hours."), "error");
      return;
    }
    const level = toIntensity(intensity);
    const energyLevel = energy === "" ? undefined : toIntensity(energy);
    const now = new Date().toISOString();
    if (editingId) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === editingId
            ? { ...e, date, time: time || undefined, mood, intensity: level, notes: notes.trim() || undefined, sleepHours: sleep, energyLevel, updatedAt: now }
            : e,
        ),
      );
      push(t("md_updated", "Mood entry updated"), "success");
    } else {
      setEntries((prev) => [
        ...prev,
        { id: uid(), date, time: time || undefined, mood, intensity: level, notes: notes.trim() || undefined, sleepHours: sleep, energyLevel, createdAt: now, updatedAt: now },
      ]);
      push(t("md_saved", "Mood entry saved"), "success");
    }
    setSheetOpen(false);
    resetForm();
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    setEntries((prev) => prev.filter((e) => e.id !== deleteId));
    setDeleteId(null);
    push(t("md_deleted", "Mood entry deleted"), "success");
  };

  const moodLabel = (m: MoodType) => MOOD_TYPES.find((x) => x.value === m)?.label ?? m;

  return (
    <Screen>
      <SectionHeader
        title={t("md_title", "Mood diary")}
        subtitle={t("md_sub", "Log how you feel each day. Build a picture of your emotional wellbeing.")}
      />

      <div className="mt-3">
        <Button full onClick={openAdd}>
          <PlusIcon className="h-4 w-4" />
          {t("md_new_entry", "New mood entry")}
        </Button>
      </div>

      <Card className="mt-4">
        <p className="text-xs font-semibold text-slate-600">{t("md_this_week", "This week")}</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">
          {weekCount} <span className="text-sm font-medium text-slate-500">{t("md_entries", "entries")}</span>
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
          {t("md_week_note", "A simple count of what you recorded — not a diagnosis of anything.")}
        </p>
      </Card>

      <SectionHeader title={t("md_history", "History")} subtitle={t("md_history_d", "Newest first.")} />
      {sorted.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            icon={<BrainIcon className="h-6 w-6" />}
            title={t("md_empty", "No mood entries yet")}
            body={t("md_empty_d", "Add your first entry to start building a picture.")}
            action={
              <Button tone="secondary" className="mt-2" onClick={openAdd}>
                {t("md_new_entry", "New mood entry")}
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
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {new Date(`${e.date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                    {e.time ? ` · ${e.time}` : ""}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone={MOOD_TONE[e.mood]}>{moodLabel(e.mood)}</Badge>
                    <Badge tone="slate">
                      {t("md_intensity", "Intensity")} {e.intensity}/5
                    </Badge>
                    {e.sleepHours !== undefined && (
                      <Badge tone="slate">
                        {e.sleepHours}
                        {t("md_hours_short", "h sleep")}
                      </Badge>
                    )}
                    {e.energyLevel !== undefined && (
                      <Badge tone="slate">
                        {t("md_energy_short", "Energy")} {e.energyLevel}/5
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              {e.notes && <p className="mt-2 line-clamp-2 text-xs leading-snug text-slate-500">{e.notes}</p>}
              <div className="mt-2.5 flex gap-2">
                <Button tone="secondary" className="min-h-9 flex-1 px-3 text-xs" onClick={() => openEdit(e.id)}>
                  {t("md_edit", "Edit")}
                </Button>
                <Button tone="secondary" className="min-h-9 flex-1 px-3 text-xs" onClick={() => setDeleteId(e.id)}>
                  {t("md_delete", "Delete")}
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
        title={editingId ? t("md_edit_title", "Edit mood entry") : t("md_new_entry", "New mood entry")}
        footer={
          <Button full onClick={save}>
            {t("md_save", "Save entry")}
          </Button>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5">
            <Field label={t("md_date", "Date")}>
              <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={`${inputClass} min-h-11`} />
            </Field>
            <Field label={t("md_time", "Time")}>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={`${inputClass} min-h-11`} />
            </Field>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-600">{t("md_mood", "Mood")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {MOOD_TYPES.map((m) => (
                <Chip key={m.value} active={mood === m.value} onClick={() => setMood(m.value)}>
                  {m.label}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-600">
              {t("md_intensity", "Intensity")} · {intensity}/5
            </p>
            <div className="mt-2">
              <Segmented options={INTENSITY_OPTIONS} value={intensity} onChange={setIntensity} />
            </div>
          </div>
          {prefs.sleepTrackingEnabled && (
            <Field label={t("md_sleep", "Sleep (hours)")}>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={24}
                step="0.5"
                value={sleepHours}
                onChange={(e) => setSleepHours(e.target.value)}
                placeholder={t("md_sleep_ph", "Hours of sleep")}
                className={`${inputClass} min-h-11`}
              />
            </Field>
          )}
          {prefs.energyTrackingEnabled && (
            <div>
              <p className="text-xs font-semibold text-slate-600">{t("md_energy", "Energy level")}</p>
              <div className="mt-2">
                <Segmented
                  options={[{ value: "", label: t("md_skip", "Skip") }, ...INTENSITY_OPTIONS]}
                  value={energy}
                  onChange={setEnergy}
                />
              </div>
            </div>
          )}
          <Field label={t("md_notes", "Notes")}>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("md_notes_ph", "Anything worth remembering…")} className={`${inputClass} min-h-11 resize-none`} />
          </Field>
        </div>
      </BottomSheet>

      <ConfirmDialog
        open={deleteId !== null}
        title={t("md_delete_title", "Delete this entry?")}
        body={t("md_delete_body", "This cannot be undone.")}
        confirmLabel={t("md_delete_yes", "Yes, delete")}
        cancelLabel={t("md_delete_no", "Keep it")}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />

      <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-400">
        {t("mh_disclaimer", "My Health Diary is for personal tracking only. It does not provide medical advice, diagnosis, or treatment. Always consult a healthcare professional for medical concerns.")}
      </p>
    </Screen>
  );
}
