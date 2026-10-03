"use client";

import { useMemo, useState } from "react";
import {
  DAY_LETTERS,
  DAY_NAMES,
  REMINDER_TYPES,
  type Reminder,
  type ReminderDay,
  type ReminderType,
} from "@/lib/types";
import { KEYS, seedReminders, uid, useStoredCollection } from "@/lib/storage";

const TYPE_ICONS: Record<ReminderType, string> = {
  medication: "💊",
  hydration: "💧",
  activity: "🏃",
  appointment: "📅",
};

function dayLabel(day: ReminderDay): string {
  return DAY_NAMES[day].slice(0, 3);
}

export default function RemindersPage() {
  const [reminders, setReminders] = useStoredCollection(KEYS.reminders, seedReminders);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("08:00");
  const [type, setType] = useState<ReminderType>("medication");
  const [days, setDays] = useState<ReminderDay[]>([1, 2, 3, 4, 5]);
  const [notes, setNotes] = useState("");

  const sorted = useMemo(
    () => [...reminders].sort((a, b) => a.time.localeCompare(b.time)),
    [reminders],
  );

  const toggleDay = (day: ReminderDay) => {
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const reminder: Reminder = {
      id: uid(),
      title: title.trim(),
      time,
      type,
      days,
      notes: notes.trim(),
      enabled: true,
    };
    setReminders((prev) => [...prev, reminder]);
    setTitle("");
    setNotes("");
  };

  const toggleEnabled = (id: string) => {
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    );
  };

  const remove = (id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const today = useMemo(() => new Date().getDay() as ReminderDay, []);
  const todays = sorted.filter((r) => r.enabled && r.days.includes(today));

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Reminders</h1>
        <p className="mt-1 text-sm text-slate-500">
          Medication, hydration, activity, and appointments.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <form
          onSubmit={submit}
          className="h-fit rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
        >
          <h2 className="mb-4 text-sm font-semibold text-slate-900">New reminder</h2>

          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Title</span>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Evening medication"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Time</span>
                <input
                  type="time"
                  required
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Type</span>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as ReminderType)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                >
                  {REMINDER_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <span className="mb-1 block text-xs font-medium text-slate-600">Repeat on</span>
              <div className="flex gap-1.5">
                {DAY_LETTERS.map((letter, i) => {
                  const day = i as ReminderDay;
                  const active = days.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      title={DAY_NAMES[day]}
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                        active
                          ? "bg-emerald-500 text-white"
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      } ${day === today ? "ring-2 ring-emerald-300" : ""}`}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Notes</span>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional detail…"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>

          <button
            type="submit"
            className="mt-4 w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600"
          >
            Add reminder
          </button>
        </form>

        <div className="space-y-4">
          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-900">
              Today ({dayLabel(today)})
            </h2>
            {todays.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                Nothing scheduled for today.
              </div>
            ) : (
              <div className="space-y-2">
                {todays.map((r) => (
                  <ReminderRow key={r.id} reminder={r} onToggle={toggleEnabled} onRemove={remove} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-slate-900">All reminders</h2>
            {sorted.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
                No reminders yet. Add your first one.
              </div>
            ) : (
              <div className="space-y-2">
                {sorted.map((r) => (
                  <ReminderRow
                    key={r.id}
                    reminder={r}
                    onToggle={toggleEnabled}
                    onRemove={remove}
                    dim={!todays.includes(r)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

function ReminderRow({
  reminder,
  onToggle,
  onRemove,
  dim,
}: {
  reminder: Reminder;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  dim?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm transition-opacity ${
        dim ? "opacity-60" : ""
      } ${reminder.enabled ? "" : "opacity-40"}`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-lg">
        {TYPE_ICONS[reminder.type]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{reminder.title}</p>
        <p className="truncate text-xs text-slate-500">
          {reminder.time} · {reminder.days.map(dayLabel).join(", ")}
        </p>
        {reminder.notes && (
          <p className="truncate text-xs text-slate-400">{reminder.notes}</p>
        )}
      </div>
      <button
        onClick={() => onToggle(reminder.id)}
        title={reminder.enabled ? "Disable" : "Enable"}
        className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
      >
        {reminder.enabled ? "On" : "Off"}
      </button>
      <button
        onClick={() => onRemove(reminder.id)}
        className="rounded-lg px-2.5 py-1 text-xs font-medium text-rose-500 hover:bg-rose-50"
      >
        Delete
      </button>
    </div>
  );
}