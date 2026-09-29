"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  EXERCISES,
  bmiCategory,
  seedExerciseReminder,
  seedFitnessProfile,
  seedWeighIns,
  seedWorkouts,
  type ExerciseDef,
} from "@/lib/exercise";
import { ExerciseImage, ExerciseVideo } from "@/components/exercise-media";
import { KEYS, daysAgo, todayIso, uid, useStoredCollection } from "@/lib/storage";

const today = todayIso();

function isoOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export default function ExercisePage() {
  const [profiles, setProfiles] = useStoredCollection(KEYS.fitnessProfile, [seedFitnessProfile]);
  const [weighIns, setWeighIns] = useStoredCollection(KEYS.weighIns, seedWeighIns);
  const [workouts, setWorkouts] = useStoredCollection(KEYS.workouts, seedWorkouts);
  const [reminders, setReminders] = useStoredCollection(KEYS.exerciseReminder, [seedExerciseReminder]);

  const profile = profiles[0] ?? seedFitnessProfile;
  const reminder = reminders[0] ?? seedExerciseReminder;

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
  const weekMinutes = workouts
    .filter((w) => w.date >= weekAgo)
    .reduce((sum, w) => sum + w.durationMin, 0);

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
      setWarn("Please enter height, start weight and goal weight in cm / kg.");
      return;
    }
    setWarn("");
    setProfiles([{ id: "profile", heightCm: h, startWeightKg: s, goalWeightKg: g }]);
  };

  const saveTodayWeight = () => {
    const w = Number(todayW);
    if (!w || w <= 0) return;
    setWeighIns((prev) => [...prev.filter((e) => e.date !== today), { id: uid(), date: today, weightKg: w }]);
    setTodayW("");
  };

  const addWorkout = (ex: ExerciseDef, dur?: number) => {
    const duration = dur ?? Number(durationMin);
    const useDuration = duration > 0 ? duration : ex.typicalMin;
    setWorkouts((prev) => [...prev, { id: uid(), date: today, slug: ex.slug, durationMin: useDuration, note: note || undefined }]);
    setNote("");
  };

  const removeWorkout = (id: string) => {
    setWorkouts((prev) => prev.filter((w) => w.id !== id));
  };

  const toggleReminder = () => {
    setReminders([{ id: "reminder", enabled: !reminder.enabled, time: reminder.time }]);
  };

  const setReminderTime = (time: string) => {
    setReminders([{ id: "reminder", enabled: reminder.enabled, time }]);
  };

  const chartData = sorted.map((w) => ({
    label: fmtDate(w.date),
    Weight: w.weightKg,
  }));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/health" className="text-sm font-medium text-slate-500 hover:text-slate-700">
        ← Back to My Health
      </Link>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Exercise &amp; Weight Journey</h1>
          <p className="mt-1 text-sm text-slate-500">
            Set your goal, log your daily activity, and watch your progress. Your data stays on this device.
          </p>
        </div>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
          🔥 {streak} day {streak === 1 ? "streak" : "streak"}
        </span>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">1 · Your goal</h2>
        <p className="mt-1 text-xs text-slate-500">
          {isLoss ? "Weight loss goal" : "Weight gain goal"} — from {start} kg to {goal} kg (height {heightCm} cm).
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <NumberField label="Height (cm)" value={height} onChange={setHeight} />
          <NumberField label="Start weight (kg)" value={startW} onChange={setStartW} />
          <NumberField label="Goal weight (kg)" value={goalW} onChange={setGoalW} />
        </div>
        {warn && <p className="mt-3 text-sm text-red-600">{warn}</p>}
        <button
          onClick={saveProfile}
          className="mt-4 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
        >
          Save goal
        </button>
        <div className="mt-4 flex-wrap flex gap-3">
          <input
            type="number"
            inputMode="decimal"
            placeholder="Record today's weight (kg)"
            value={todayW}
            onChange={(e) => setTodayW(e.target.value)}
            className="w-56 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            onClick={saveTodayWeight}
            className="rounded-lg border border-brand-700 bg-white px-4 py-2 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50"
          >
            Record weight
          </button>
        </div>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Current weight" value={`${currentWeight.toFixed(1)} kg`} hint={bmi ? `BMI ${bmi.toFixed(1)} · ${bmiCategory(bmi)}` : undefined} />
        <StatCard
          label={isLoss ? "Lost so far" : "Gained so far"}
          value={`${Math.abs(kgToward).toFixed(1)} kg`}
          hint={`${kgToGoal.toFixed(1)} kg ${isLoss ? "to goal" : "to goal"}`}
          accent
        />
        <StatCard
          label="Journey progress"
          value={progressPct === null ? "—" : `${progressPct.toFixed(0)}%`}
          hint={`Goal ${goal} kg`}
        />
        <StatCard label="Active this week" value={`${weekMinutes} min`} hint={`${todayWorkouts.length} logged today`} />
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">2 · Weight journey</h2>
          <span className="text-xs text-slate-400">{sorted.length} check-ins</span>
        </div>
        <div className="mt-4 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11, fill: "#64748b" }} />
              <Tooltip />
              <ReferenceLine y={goal} stroke="#0f8b8d" strokeDasharray="4 4" label={{ value: "Goal", fontSize: 11, fill: "#0f8b8d", position: "insideTopRight" }} />
              <Line type="monotone" dataKey="Weight" stroke="#0f8b8d" strokeWidth={2.5} dot={{ r: 3, fill: "#0f8b8d" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2 font-medium">Date</th>
              <th className="py-2 font-medium">Weight</th>
              <th className="py-2 font-medium">Change</th>
            </tr>
          </thead>
          <tbody>
            {[...sorted].reverse().map((w, i) => {
              const prev = sorted[sorted.length - 1 - (i + 1)];
              const delta = prev ? w.weightKg - prev.weightKg : 0;
              return (
                <tr key={w.id} className="border-b border-slate-100">
                  <td className="py-2 text-slate-600">{fmtDate(w.date)}</td>
                  <td className="py-2 font-medium">{w.weightKg.toFixed(1)} kg</td>
                  <td className="py-2">
                    {prev ? (
                      <span className={delta === 0 ? "text-slate-500" : delta < 0 ? "text-green-700" : "text-red-600"}>
                        {delta > 0 ? "+" : ""}
                        {delta.toFixed(1)} kg
                      </span>
                    ) : (
                      <span className="text-slate-400">start</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">3 · Train every day</h2>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${doneToday ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}
          >
            {doneToday ? "✓ Done today" : "Not done yet today"}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-600">Exercise</span>
            <select
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {EXERCISES.map((ex) => (
                <option key={ex.slug} value={ex.slug}>
                  {ex.name}
                </option>
              ))}
            </select>
          </label>
          <NumberField label="Minutes" value={durationMin} onChange={setDurationMin} className="w-28" />
          <label className="flex-1 basis-40">
            <span className="text-xs font-medium text-slate-600">Note (optional)</span>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="e.g. felt great, morning session"
            />
          </label>
          <button
            onClick={() => addWorkout(EXERCISES.find((e) => e.slug === slug) ?? EXERCISES[0])}
            className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
          >
            Log workout
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {todayWorkouts.map((w) => {
            const ex = EXERCISES.find((e) => e.slug === w.slug);
            return (
              <div key={w.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <ExerciseImage slug={w.slug} className="h-10 w-10 rounded-lg object-cover" alt={ex?.name ?? w.slug} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{ex?.name ?? w.slug}</p>
                  <p className="text-xs text-slate-500">
                    {w.durationMin} min{w.note ? ` · ${w.note}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => removeWorkout(w.id)}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-slate-400 hover:text-red-600"
                  aria-label="Remove"
                >
                  Remove
                </button>
              </div>
            );
          })}
          {todayWorkouts.length === 0 && (
            <p className="text-sm text-slate-400">
              No workout logged today. Pick an exercise above or from the library below.
            </p>
          )}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">4 · Daily exercise reminder</h2>
            <p className="mt-1 text-xs text-slate-500">
              {reminder.enabled
                ? `Active — reminder set for ${reminder.time}.`
                : "Reminder is switched off."}
            </p>
          </div>
          <button
            role="switch"
            aria-checked={reminder.enabled}
            onClick={toggleReminder}
            className={`relative h-6 w-11 rounded-full transition-colors ${reminder.enabled ? "bg-brand-700" : "bg-slate-300"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${reminder.enabled ? "left-[22px]" : "left-0.5"}`}
            />
          </button>
        </div>
        <label className="mt-4 block w-40">
          <span className="text-xs font-medium text-slate-600">Reminder time</span>
          <input
            type="time"
            value={reminder.time}
            onChange={(e) => setReminderTime(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <p className="mt-3 text-xs text-slate-400">
          A local reminder helps you keep a daily routine. Notification delivery is planned for the digital MVP.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-slate-900">5 · Exercise library</h2>
        <p className="mt-1 text-xs text-slate-500">Pictures and videos of different exercises. Pick one and log it as today&apos;s workout.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {EXERCISES.map((ex) => (
            <div key={ex.slug} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <ExerciseImage slug={ex.slug} className="aspect-video w-full object-cover" alt={ex.name} />
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{ex.name}</h3>
                  <span className="rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500">
                    {ex.typicalMin} min
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {ex.category} · {ex.focus}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => setOpenSlug(openSlug === ex.slug ? null : ex.slug)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    {openSlug === ex.slug ? "Hide" : "How to do it"}
                  </button>
                  <button
                    onClick={() => addWorkout(ex, ex.typicalMin)}
                    className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-800"
                  >
                    Log today
                  </button>
                </div>
                {openSlug === ex.slug && (
                  <div className="mt-4">
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
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-400">
          Adding your own media: drop photos into <code className="rounded bg-slate-100 px-1">public/exercise/images/&lt;slug&gt;.(jpg|png)</code> and
          videos into <code className="rounded bg-slate-100 px-1">public/exercise/videos/&lt;slug&gt;.(mp4|webm)</code>. They appear automatically.
        </p>
      </section>
    </main>
  );
}

function StatCard({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tracking-tight ${accent ? "text-green-700" : "text-slate-900"}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
      />
    </label>
  );
}