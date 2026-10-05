"use client";

import Link from "next/link";
import { Avatar, Badge, Button, Card } from "@/components/app-ui";
import { ClockIcon, RefreshIcon } from "@/components/icons";
import { formatShortDate, type AppointmentView } from "@/lib/appointments";
import { useT } from "@/lib/i18n";
import type { BookingStatus } from "@/lib/types";

type StatusTone = "brand" | "green" | "amber" | "slate";

const STATUS_TONE: Record<BookingStatus, StatusTone> = {
  new: "amber",
  contacted: "amber",
  confirmed: "brand",
  completed: "green",
  cancelled: "slate",
};

const STATUS_TEXT: Record<BookingStatus, { key: string; fallback: string }> = {
  new: { key: "appt_status_new", fallback: "Requested" },
  contacted: { key: "appt_status_contacted", fallback: "In progress" },
  confirmed: { key: "appt_status_confirmed", fallback: "Confirmed" },
  completed: { key: "appt_status_completed", fallback: "Completed" },
  cancelled: { key: "appt_status_cancelled", fallback: "Cancelled" },
};

const LINK_BUTTON =
  "tap inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-brand-300 hover:text-brand-700";

export function AppointmentCard({
  appointment,
  onReschedule,
  onCancel,
  onBookAgain,
}: {
  appointment: AppointmentView;
  onReschedule?: () => void;
  onCancel?: () => void;
  onBookAgain?: () => void;
}) {
  const t = useT();
  const { day, month } = formatShortDate(appointment.date);
  const status = STATUS_TEXT[appointment.status];
  const isDone = appointment.status === "completed";
  const isCancelled = appointment.status === "cancelled";

  return (
    <Card className="p-3.5">
      <div className="flex items-start gap-3">
        <div
          className={`flex w-12 shrink-0 flex-col items-center rounded-xl py-1.5 ${
            isCancelled || isDone ? "bg-slate-100" : "bg-brand-50"
          }`}
        >
          <span
            className={`text-lg font-bold leading-none ${
              isCancelled || isDone ? "text-slate-500" : "text-brand-700"
            }`}
          >
            {day}
          </span>
          <span
            className={`mt-1 text-[10px] font-semibold uppercase leading-none tracking-wide ${
              isCancelled || isDone ? "text-slate-400" : "text-brand-600"
            }`}
          >
            {month}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <Avatar
              name={appointment.providerName}
              role="doctor"
              size={36}
              seed={appointment.providerName.length}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">
                {appointment.providerName}
              </p>
              <p className="truncate text-xs text-slate-500">{appointment.specialty}</p>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700">
              <ClockIcon className="h-3.5 w-3.5 text-slate-400" />
              {appointment.time}
            </span>
            <Badge tone="slate">{appointment.kind}</Badge>
            <Badge tone={STATUS_TONE[appointment.status]}>{t(status.key, status.fallback)}</Badge>
          </div>
        </div>
      </div>

      {isCancelled ? (
        <p className="mt-3 border-t border-slate-100 pt-2.5 text-xs text-slate-400">
          {t("appt_cancelled_note", "This appointment was cancelled.")}
        </p>
      ) : isDone ? (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <Link href="/find-care" className={`${LINK_BUTTON} w-full`} onClick={onBookAgain}>
            <RefreshIcon className="h-4 w-4" />
            {t("appt_book_again", "Book again")}
          </Link>
        </div>
      ) : (
        <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
          <Button tone="secondary" className="flex-1" onClick={onReschedule}>
            {t("appt_reschedule", "Reschedule")}
          </Button>
          <Button tone="danger" className="flex-1" onClick={onCancel}>
            {t("appt_cancel", "Cancel")}
          </Button>
        </div>
      )}
    </Card>
  );
}
