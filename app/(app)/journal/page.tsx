"use client";

import { useMemo, useState } from "react";
import { MOODS, SYMPTOMS, type JournalEntry, type Mood } from "@/lib/types";
import { KEYS, seedJournal, todayIso, uid, useStoredCollection } from "@/lib/storage";
import { fullDate } from "@/lib/format";

function moodClasses(mood: Mood): string {
  return MOODS.find((m) => m.value === mood)?.color ?? "bg-slate-300";
}

export default function JournalPage() {
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

  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.date.localeCompare(a.date)),
    [entries],
  );

  const toggleSymptom = (s: string) => {
    setSymptoms((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const entry: JournalEntry = {
      id: uid(),
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
    setEntries((prev) => [...prev, entry]);
    setMood("good");
    setSymptoms([]);
    setWeightKg("");
    setHeartRate("");
    setSys("");
    setDia("");
    setSleepHours("");
    setSteps("");
    setNote("");
  };

  const remove = (id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    if (expanded === id) setExpanded(null);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Health journal</h1>
        <p className="mt-1 text-sm text-slate-500">
          Log your mood, symptoms, and vitals each day.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <form
          onSubmit={submit}
          className="h-fit rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
        >
          <h2 className="mb-4 text-sm font-semibold text-slate-900">New entry</h2>

          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Date</span>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <div className="col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-600">Mood</span>
              <div className="flex flex-wrap gap-1.5">
                {MOODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setMood(m.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      mood === m.value
                        ? `${m.color} text-white`
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="col-span-2">
              <span className="mb-1 block text-xs font-medium text-slate-600">Symptoms</span>
              <div className="flex flex-wrap gap-1.5">
                {SYMPTOMS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSymptom(s)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      symptoms.includes(s)
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="col-span-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <NumberField label="Weight (kg)" value={weightKg} onChange={setWeightKg} />
              <NumberField label="Heart rate (bpm)" value={heartRate} onChange={setHeartRate} />
              <NumberField label="Sleep (hrs)" value={sleepHours} onChange={setSleepHours} />
              <NumberField label="Steps" value={steps} onChange={setSteps} />
              <NumberField label="BP systolic" value={sys} onChange={setSys} />
              <NumberField label="BP diastolic" value={dia} onChange={setDia} />
            </div>

            <label className="col-span-2 block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Notes</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="How did your day go?"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>

          <button
            type="submit"
            className="mt-4 w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600"
          >
            Save entry
          </button>
        </form>

        <div className="space-y-3">
          {sorted.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              No journal entries yet. Add your first one.
            </div>
          ) : (
            sorted.map((entry) => {
              const moodMeta = MOODS.find((m) => m.value === entry.mood);
              const isOpen = expanded === entry.id;
              const vitals = Object.entries(entry.vitals)
                .filter(([, v]) => v != null)
                .map(([k, v]) => ({ k, v: v as number }));
              return (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`h-8 w-8 shrink-0 rounded-full ${moodClasses(entry.mood)}`}
                        title={moodMeta?.label}
                      />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{fullDate(entry.date)}</p>
                        <p className="text-xs capitalize text-slate-500">{moodMeta?.label}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setExpanded(isOpen ? null : entry.id)}
                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
                      >
                        {isOpen ? "Collapse" : "Details"}
                      </button>
                      <button
                        onClick={() => remove(entry.id)}
                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-rose-500 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {entry.symptoms.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {entry.symptoms.map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-600"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  {entry.note && (
                    <p className="mt-3 text-sm text-slate-700">{entry.note}</p>
                  )}

                  {isOpen && vitals.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3 sm:grid-cols-3">
                      {vitals.map(({ k, v }) => (
                        <div
                          key={k}
                          className="rounded-xl bg-slate-50 px-3 py-2 text-center"
                        >
                          <p className="text-xs text-slate-500">{label(k)}</p>
                          <p className="text-sm font-semibold text-slate-900">{v}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input
        type="number"
        min="0"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

function label(key: string): string {
  const map: Record<string, string> = {
    weightKg: "Weight (kg)",
    heartRate: "Heart rate (bpm)",
    systolic: "BP systolic",
    diastolic: "BP diastolic",
    sleepHours: "Sleep (hrs)",
    steps: "Steps",
  };
  return map[key] ?? key;
}