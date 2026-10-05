"use client";

import { useMemo, useState } from "react";
import {
  Badge,
  BottomSheet,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  Screen,
  SectionHeader,
  Switch,
  inputClass,
  useToast,
} from "@/components/app-ui";
import { BellIcon, CalendarIcon, ClockIcon, PillIcon, PlusIcon, ShieldIcon, TrashIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { KEYS, seedReminders, uid, useStoredCollection } from "@/lib/storage";
import {
  DAY_LETTERS,
  DAY_NAMES,
  REMINDER_TYPES,
  type Reminder,
  type ReminderDay,
  type ReminderType,
} from "@/lib/types";

const TYPE_META: Record<ReminderType, { key: [string, string]; Icon: typeof PillIcon; tone: "brand" | "green" | "amber" | "slate" }> = {
  medication: { key: ["rm2_type_medication", "Medication"], Icon: PillIcon, tone: "brand" },
  hydration: { key: ["rm2_type_hydration", "Hydration"], Icon: ShieldIcon, tone: "slate" },
  activity: { key: ["rm2_type_activity", "Activity"], Icon: ClockIcon, tone: "green" },
  appointment: { key: ["rm2_type_appointment", "Appointment"], Icon: CalendarIcon, tone: "amber" },
};

export default function RemindersPage() {
  const t = useT();
  const { push } = useToast();
  const [reminders, setReminders] = useStoredCollection(KEYS.reminders, seedReminders);
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("08:00");
  const [type, setType] = useState<ReminderType>("medication");
  const [days, setDays] = useState<ReminderDay[]>([1, 2, 3, 4, 5]);
  const [notes, setNotes] = useState("");
  const [open, setOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Reminder | null>(null);

  const today = useMemo(() => new Date().getDay() as ReminderDay, []);
  const sorted = useMemo(() => [...reminders].sort((a, b) => a.time.localeCompare(b.time)), [reminders]);
  const todays = sorted.filter((r) => r.enabled && r.days.includes(today));

  const dayLabel = (day: ReminderDay) => DAY_NAMES[day].slice(0, 3);

  const toggleDay = (day: ReminderDay) => {
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
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
    setOpen(false);
    push(t("rm2_saved", "Reminder added"), "success");
  };

  const toggleEnabled = (id: string) => {
    setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)));
  };

  const confirmRemove = () => {
    if (!toDelete) return;
    setReminders((prev) => prev.filter((r) => r.id !== toDelete.id));
    setToDelete(null);
    push(t("rm2_removed", "Reminder deleted"));
  };

  const renderRow = (reminder: Reminder, dim: boolean) => {
    const meta = TYPE_META[reminder.type];
    const Icon = meta.Icon;
    return (
      <Card key={reminder.id} className={dim ? "opacity-60" : undefined}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{reminder.title}</p>
            <p className="truncate text-xs text-slate-500">
              {reminder.time} · {reminder.days.map(dayLabel).join(", ")}
            </p>
            {reminder.notes ? <p className="truncate text-xs text-slate-400">{reminder.notes}</p> : null}
          </div>
          <div className="shrink-0">
            <Switch
              checked={reminder.enabled}
              onChange={() => toggleEnabled(reminder.id)}
              label={reminder.enabled ? t("rm2_on", "On") : t("rm2_off", "Off")}
            />
          </div>
          <IconButton
            label={t("rm2_delete", "Delete reminder")}
            onClick={() => setToDelete(reminder)}
            className="shrink-0 text-rose-500 hover:bg-rose-50"
          >
            <TrashIcon className="h-4 w-4" />
          </IconButton>
        </div>
      </Card>
    );
  };

  return (
    <Screen>
      <SectionHeader
        title={t("rm2_title", "Reminders")}
        subtitle={t("rm2_sub", "Medication, hydration, activity and appointments.")}
      />

      <div className="mt-3 flex flex-wrap gap-1.5">
        {REMINDER_TYPES.map((rt) => {
          const meta = TYPE_META[rt.value as ReminderType];
          return (
            <Badge key={rt.value} tone={meta.tone}>
              {t(meta.key[0], meta.key[1])}
            </Badge>
          );
        })}
      </div>

      <Button full className="mt-3" onClick={() => setOpen(true)}>
        <PlusIcon className="h-4 w-4" />
        {t("rm2_add", "Add reminder")}
      </Button>

      <section className="mt-5">
        <h2 className="text-sm font-semibold text-slate-900">
          {t("rm2_today", "Today")} ({dayLabel(today)})
        </h2>
        <div className="mt-2 space-y-2.5">
          {todays.length === 0 ? (
            <EmptyState
              icon={<BellIcon className="h-6 w-6" />}
              title={t("rm2_empty_today", "Nothing scheduled today")}
              body={t("rm2_empty_today_d", "Your reminders for today will appear here.")}
            />
          ) : (
            todays.map((r) => renderRow(r, false))
          )}
        </div>
      </section>

      <section className="mt-5">
        <h2 className="text-sm font-semibold text-slate-900">{t("rm2_all", "All reminders")}</h2>
        <div className="mt-2 space-y-2.5">
          {sorted.length === 0 ? (
            <EmptyState
              icon={<BellIcon className="h-6 w-6" />}
              title={t("rm2_empty_all", "No reminders yet")}
              body={t("rm2_empty_all_d", "Add your first reminder to never miss a dose or visit.")}
              action={
                <Button tone="secondary" onClick={() => setOpen(true)}>
                  {t("rm2_add", "Add reminder")}
                </Button>
              }
            />
          ) : (
            sorted.map((r) => renderRow(r, !todays.includes(r)))
          )}
        </div>
      </section>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("rm2_sheet_title", "New reminder")}
        footer={
          <Button full onClick={submit}>
            {t("rm2_save", "Add reminder")}
          </Button>
        }
      >
        <form onSubmit={submit} className="space-y-3">
          <Field label={t("rm2_f_title", "Title")}>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("rm2_ph_title", "e.g. Evening medication")}
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("rm2_f_time", "Time")}>
              <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} />
            </Field>
            <Field label={t("rm2_f_type", "Type")}>
              <select value={type} onChange={(e) => setType(e.target.value as ReminderType)} className={inputClass}>
                {REMINDER_TYPES.map((rt) => {
                  const meta = TYPE_META[rt.value as ReminderType];
                  return (
                    <option key={rt.value} value={rt.value}>
                      {t(meta.key[0], meta.key[1])}
                    </option>
                  );
                })}
              </select>
            </Field>
          </div>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-slate-600">{t("rm2_f_days", "Repeat on")}</span>
            <div className="flex gap-1.5">
              {DAY_LETTERS.map((letter, i) => {
                const day = i as ReminderDay;
                const active = days.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    aria-pressed={active}
                    aria-label={DAY_NAMES[day]}
                    className={`tap h-10 w-10 rounded-full text-xs font-semibold transition-colors ${
                      active ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-500"
                    } ${day === today ? "ring-2 ring-brand-300" : ""}`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          </div>
          <Field label={t("rm2_f_notes", "Notes")}>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("rm2_ph_notes", "Optional detail…")}
              className={inputClass}
            />
          </Field>
        </form>
      </BottomSheet>

      <ConfirmDialog
        open={toDelete !== null}
        title={t("rm2_confirm_title", "Delete this reminder?")}
        body={t("rm2_confirm_body", "This cannot be undone.")}
        confirmLabel={t("rm2_confirm_yes", "Yes, delete")}
        cancelLabel={t("rm2_confirm_no", "Keep it")}
        tone="danger"
        onConfirm={confirmRemove}
        onCancel={() => setToDelete(null)}
      />
    </Screen>
  );
}