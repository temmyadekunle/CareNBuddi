"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Badge,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  Field,
  Screen,
  SectionHeader,
  Switch,
  inputClass,
  useToast,
} from "@/components/app-ui";
import { MeasurementTile, Ring, Sparkline } from "@/components/health-charts";
import { ActivityIcon, BellIcon, ChevronLeftIcon, ClockIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { ExerciseImage, ExerciseVideo } from "@/components/exercise-media";
import {
  EXERCISES,
  bmiCategory,
  seedExerciseReminder,
  seedFitnessProfile,
  seedWeighIns,
  seedWorkouts,
  type ExerciseDef,
} from "@/lib/exercise";
import { fullDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { KEYS, daysAgo, todayIso, uid, useStoredCollection } from "@/lib/storage";

const today = todayIso();

function isoOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export default function ExercisePage() {
  const t = useT();
  const { push } = useToast();
  const [profiles, setProfiles] = useStoredCollection(KEYS.fitnessProfile, [seedFitnessProfile]);
  const [weighIns, setWeighIns] = useStoredCollection(KEYS.weighIns, seedWeighIns);
  const [workouts, setWorkouts] = useStoredCollection(KEYS.workouts, seedWorkouts);
  const [reminders, setReminders] = useStoredCollection(KEYS.exerciseReminder, [seedExerciseReminder]);

  const profile = profiles[0] ?? seedFitnessProfile;
  const reminder = reminders[0] ?? seedExerciseReminder;

  const [goalOpen, setGoalOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [height, setHeight] = useState(String(profile.heightCm || ""));
  const [startW, setStartW] = useState(String(profile.startWeightKg || ""));
  const [goalW, setGoalW] = useState(String(profile.goalWeightKg || ""));
  const [todayW, setTodayW] = useState("");
  const [warn, setWarn] = useState("");

  const [slug, setSlug] = useState(EXERCISES[0].slug);
  const [durationMin, setDurationMin] = useState("15");
  const [note, setNote] = useState("");
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  const sorted = [...weighIns].sort((a, b) => (a.date < b.date ? -1 : 1));
  const currentWeight = sorted.length ? sorted[sorted.length - 1].weightKg : profile.startWeightKg;
  const heightCm = profile.heightCm;
  const bmi = heightCm > 0 ? currentWeight / Math.pow(heightCm / 100, 2) : null;

  const goal = profile.goalWeightKg;
  const start = profile.startWeightKg;
  const isLoss = goal < start;
  const progressPct = goal === start ? null : clamp(((start - currentWeight) / (start - goal)) * 100, 0, 100);
  const kgToward = isLoss ? start - currentWeight : currentWeight - start;
  const kgToGoal = Math.abs(currentWeight - goal);

  const todayWorkouts = workouts.filter((w) => w.date === today);
  const doneToday = todayWorkouts.length > 0;
  const weekAgo = daysAgo(7);
  const weekMinutes = workouts.filter((w) => w.date >= weekAgo).reduce((sum, w) => sum + w.durationMin, 0);

  const workoutDates = new Set(workouts.map((w) => w.date));
  let streak = 0;
  const cursor = new Date();
  if (!workoutDates.has(isoOf(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (workoutDates.has(isoOf(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const saveProfile = () => {
    const h = Number(height);
    const s = Number(startW);
    const g = Number(goalW);
    if (!h || !s || !g || h <= 0 || s <= 0 || g <= 0) {
      setWarn(t("exx_warn", "Please enter height, start weight and goal weight in cm / kg."));
      return;
    }
    setWarn("");
    setProfiles([{ id: "profile", heightCm: h, startWeightKg: s, goalWeightKg: g }]);
    setGoalOpen(false);
    push(t("exx_goal_saved", "Goal saved"), "success");
  };

  const saveTodayWeight = () => {
    const w = Number(todayW);
    if (!w || w <= 0) return;
    setWeighIns((prev) => [...prev.filter((e) => e.date !== today), { id: uid(), date: today, weightKg: w }]);
    setTodayW("");
    push(t("exx_weight_saved", "Weight recorded"), "success");
  };

  const addWorkout = (ex: ExerciseDef, dur?: number) => {
    const duration = dur ?? Number(durationMin);
    const useDuration = duration > 0 ? duration : ex.typicalMin;
    setWorkouts((prev) => [
      ...prev,
      { id: uid(), date: today, slug: ex.slug, durationMin: useDuration, note: note || undefined },
    ]);
    setNote("");
    setLogOpen(false);
    push(t("exx_workout_logged", "Workout logged"), "success");
  };

  const removeWorkout = (id: string) => setWorkouts((prev) => prev.filter((w) => w.id !== id));

  const toggleReminder = () => setReminders([{ id: "reminder", enabled: !reminder.enabled, time: reminder.time }]);

  const setReminderTime = (time: string) =>
    setReminders([{ id: "reminder", enabled: reminder.enabled, time }]);

  const weights = sorted.map((w) => w.weightKg);
  const latestDelta = (() => {
    if (sorted.length < 2) return null;
    const d = sorted[sorted.length - 1].weightKg - sorted[sorted.length - 2].weightKg;
    return d;
  })();

  return (
    <Screen>
      <Link href="/health" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-slate-500">
        <ChevronLeftIcon className="h-4 w-4" />
        {t("h_dashboard", "My Health")}
      </Link>

      <div className="mt-1">
        <SectionHeader
          title={t("ex_title", "Exercise & Weight Journey")}
          subtitle={t("ex_sub", "Set your goal, log daily activity, and watch your progress.")}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <Badge tone={doneToday ? "green" : "amber"}>
          <ActivityIcon className="mr-1 h-3 w-3" />
          {doneToday ? t("ex_done", "Done today") : t("ex_not_yet", "Not done yet today")}
        </Badge>
        <Badge tone="brand">{`🔥 ${streak} ${t("ex_streak", "day streak")}`}</Badge>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <MeasurementTile
          label={t("ex_current", "Current weight")}
          value={currentWeight.toFixed(1)}
          unit="kg"
          icon={<ActivityIcon className="h-4 w-4" />}
          trend={latestDelta === null ? undefined : `${latestDelta > 0 ? "+" : ""}${latestDelta.toFixed(1)} kg`}
          trendTone={latestDelta === null || latestDelta === 0 ? "flat" : latestDelta < 0 ? "good" : "bad"}
          spark={weights}
        />
        <MeasurementTile
          label={isLoss ? t("ex_lost", "Lost so far") : t("ex_gained", "Gained so far")}
          value={Math.abs(kgToward).toFixed(1)}
          unit="kg"
          icon={<ActivityIcon className="h-4 w-4" />}
          tone="green"
          trend={`${kgToGoal.toFixed(1)} ${t("ex_to_goal", "to goal")}`}
        />
        <MeasurementTile
          label={t("ex_week", "Active this week")}
          value={String(weekMinutes)}
          unit="min"
          icon={<ClockIcon className="h-4 w-4" />}
          trend={`${todayWorkouts.length} ${t("ex_today", "today")}`}
        />
        <Card className="flex items-center gap-3 px-3 py-3">
          <Ring
            value={progressPct ?? 0}
            max={100}
            label={t("ex_progress", "Progress")}
            tone={progressPct !== null && progressPct >= 100 ? "green" : "brand"}
          />
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900">
              {progressPct === null ? "—" : `${progressPct.toFixed(0)}%`}
            </p>
            <p className="truncate text-[11px] text-slate-500">
              {bmi ? `${t("ex_bmi", "BMI")} ${bmi.toFixed(1)} · ${bmiCategory(bmi)}` : `${t("ex_goal", "Goal")} ${goal} kg`}
            </p>
          </div>
        </Card>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button onClick={() => setGoalOpen(true)}>{t("ex_set_goal", "Set your goal")}</Button>
        <Button tone="secondary" onClick={() => setLogOpen(true)}>
          <PlusIcon className="h-4 w-4" />
          {t("ex_log", "Log workout")}
        </Button>
      </div>

      <Card className="mt-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">{t("ex_journey", "Weight journey")}</h2>
          <span className="text-[11px] text-slate-400">{`${sorted.length} ${t("ex_checkins", "check-ins")}`}</span>
        </div>

        {sorted.length > 1 && (
          <div className="mt-3">
            <Sparkline points={weights} className="h-20" />
          </div>
        )}

        <div className="mt-3 space-y-2">
          {[...sorted].reverse().slice(0, 8).map((w, i) => {
            const prev = sorted[sorted.length - 1 - (i + 1)];
            const delta = prev ? w.weightKg - prev.weightKg : null;
            return (
              <div key={w.id} className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                <span className="truncate text-xs text-slate-500">{fullDate(w.date)}</span>
                <span className="text-sm font-semibold tabular-nums text-slate-900">{w.weightKg.toFixed(1)} kg</span>
                <span
                  className={`w-16 text-right text-xs font-medium tabular-nums ${
                    delta === null || delta === 0
                      ? "text-slate-400"
                      : delta < 0
                        ? "text-emerald-600"
                        : "text-rose-600"
                  }`}
                >
                  {delta === null
                    ? t("ex_start", "start")
                    : `${delta > 0 ? "+" : ""}${delta.toFixed(1)} kg`}
                </span>
              </div>
            );
          })}
          {sorted.length === 0 && (
            <p className="text-sm text-slate-400">{t("exx_no_weighins", "No weigh-ins recorded yet.")}</p>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            placeholder={t("exx_ph_weight", "Today's weight (kg)")}
            value={todayW}
            onChange={(e) => setTodayW(e.target.value)}
            className={`${inputClass} py-2.5 text-sm`}
          />
          <Button tone="secondary" onClick={saveTodayWeight} className="shrink-0 px-4">
            {t("ex_record", "Record")}
          </Button>
        </div>
      </Card>

      <Card className="mt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">{t("ex_reminder", "Daily exercise reminder")}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {reminder.enabled
                ? `${t("ex_active", "Active")} — ${t("ex_at", "set for")} ${reminder.time}`
                : t("ex_off", "Reminder is switched off.")}
            </p>
          </div>
          <Switch checked={reminder.enabled} onChange={toggleReminder} label={t("ex_reminder", "Daily exercise reminder")} />
        </div>
        {reminder.enabled && (
          <div className="mt-3 w-40">
            <Field label={t("ex_time", "Reminder time")}>
              <input
                type="time"
                value={reminder.time}
                onChange={(e) => setReminderTime(e.target.value)}
                className={`${inputClass} py-2.5 text-sm`}
              />
            </Field>
          </div>
        )}
        <p className="mt-3 flex items-start gap-1.5 text-[11px] text-slate-400">
          <BellIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t(
            "ex_reminder_note",
            "A local reminder helps you keep a daily routine. Notification delivery is planned for the digital MVP.",
          )}
        </p>
      </Card>

      <section className="mt-5">
        <h2 className="text-sm font-semibold text-slate-900">{t("ex_library", "Exercise library")}</h2>
        <p className="mt-1 text-xs text-slate-500">
          {t("ex_library_d", "Pictures and step-by-step videos. Pick one and log it as today's workout.")}
        </p>

        <div className="mt-2.5 space-y-2.5">
          {EXERCISES.map((ex) => (
            <Card key={ex.slug} padded={false} className="overflow-hidden">
              <ExerciseImage slug={ex.slug} className="aspect-video w-full object-cover" alt={ex.name} />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-slate-900">{ex.name}</h3>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {ex.category} · {ex.focus}
                    </p>
                  </div>
                  <Badge tone="slate">
                    <ClockIcon className="mr-1 h-3 w-3" />
                    {`${ex.typicalMin} min`}
                  </Badge>
                </div>

                <div className="mt-3 flex gap-2">
                  <Button tone="secondary" onClick={() => setOpenSlug(openSlug === ex.slug ? null : ex.slug)}>
                    {openSlug === ex.slug ? t("ex_hide", "Hide") : t("ex_how", "How to do it")}
                  </Button>
                  <Button onClick={() => addWorkout(ex, ex.typicalMin)}>
                    {t("ex_log_today", "Log today")}
                  </Button>
                </div>

                {openSlug === ex.slug && (
                  <div className="mt-3">
                    <ExerciseVideo slug={ex.slug} />
                    <ol className="mt-3 space-y-1.5">
                      {ex.instructions.map((step, i) => (
                        <li key={step} className="flex gap-2 text-sm text-slate-700">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-semibold text-brand-700">
                            {i + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      </section>

      <BottomSheet
        open={goalOpen}
        onClose={() => setGoalOpen(false)}
        title={t("ex_set_goal", "Set your goal")}
        footer={
          <Button full onClick={saveProfile}>
            {t("ex_save", "Save goal")}
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            {isLoss ? t("ex_loss_goal", "Weight loss goal") : t("ex_gain_goal", "Weight gain goal")} —{" "}
            {`${t("ex_from", "from")} ${start} kg ${t("ex_to", "to")} ${goal} kg (${t("ex_height", "height")} ${heightCm} cm).`}
          </p>
          <Field label={t("exx_f_height", "Height (cm)")}>
            <input
              type="number"
              inputMode="decimal"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("exx_f_start", "Start weight (kg)")}>
              <input
                type="number"
                inputMode="decimal"
                value={startW}
                onChange={(e) => setStartW(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={t("exx_f_goal", "Goal weight (kg)")}>
              <input
                type="number"
                inputMode="decimal"
                value={goalW}
                onChange={(e) => setGoalW(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          {warn && <p className="text-xs font-medium text-rose-600">{warn}</p>}
        </div>
      </BottomSheet>

      <BottomSheet
        open={logOpen}
        onClose={() => setLogOpen(false)}
        title={t("ex_log", "Log workout")}
        footer={
          <Button full onClick={() => addWorkout(EXERCISES.find((e) => e.slug === slug) ?? EXERCISES[0])}>
            {t("ex_add", "Log workout")}
          </Button>
        }
      >
        <div className="space-y-3">
          <Field label={t("exx_f_exercise", "Exercise")}>
            <select value={slug} onChange={(e) => setSlug(e.target.value)} className={inputClass}>
              {EXERCISES.map((ex) => (
                <option key={ex.slug} value={ex.slug}>
                  {ex.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("exx_f_minutes", "Minutes")}>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label={t("exx_f_note", "Note (optional)")}>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("exx_ph_note", "e.g. morning session")}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-600">{t("ex_today_logged", "Logged today")}</span>
            {todayWorkouts.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                {t("exx_none_today", "No workout logged today. Pick an exercise above or from the library.")}
              </p>
            ) : (
              todayWorkouts.map((w) => {
                const ex = EXERCISES.find((e) => e.slug === w.slug);
                return (
                  <div key={w.id} className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5">
                    <ExerciseImage
                      slug={w.slug}
                      className="h-10 w-10 shrink-0 rounded-lg object-cover"
                      alt={ex?.name ?? w.slug}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{ex?.name ?? w.slug}</p>
                      <p className="truncate text-xs text-slate-500">
                        {`${w.durationMin} min${w.note ? ` · ${w.note}` : ""}`}
                      </p>
                    </div>
                    <Button tone="ghost" onClick={() => removeWorkout(w.id)} aria-label={t("ex_remove", "Remove")}>
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </BottomSheet>

      {todayWorkouts.length > 0 && (
        <div className="mt-4">
          <EmptyState
            icon={<ActivityIcon className="h-6 w-6" />}
            title={t("exx_nice", "Nice work today")}
            body={t("exx_nice_d", "Come back tomorrow to keep your streak.")}
          />
        </div>
      )}
    </Screen>
  );
}