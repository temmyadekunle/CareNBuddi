"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Badge,
  BottomSheet,
  Button,
  Card,
  Chip,
  ConfirmDialog,
  EmptyState,
  IconButton,
  ListRow,
  Screen,
  SectionHeader,
  SkeletonCards,
  Tabs,
  useToast,
} from "@/components/app-ui";
import { AppointmentCard } from "@/components/appointment-card";
import {
  CalendarIcon,
  ClockIcon,
  EmergencyIcon,
  RefreshIcon,
  SearchIcon,
  StethoscopeIcon,
} from "@/components/icons";
import {
  SLOTS,
  formatDay,
  nextAvailableSlots,
  partitionAppointments,
  toAppointment,
  type AppointmentView,
} from "@/lib/appointments";
import { PROVIDER_CATEGORY_LABELS } from "@/lib/content";
import { useLang, useT } from "@/lib/i18n";
import {
  KEYS,
  seedBookings,
  seedProviders,
  todayIso,
  useSession,
  useStoredCollection,
} from "@/lib/storage";

type Tab = "upcoming" | "completed" | "cancelled";

const EMPTY_COPY: Record<
  Tab,
  { icon: "calendar" | "done" | "cancelled"; titleKey: string; title: string; bodyKey: string; body: string }
> = {
  upcoming: {
    icon: "calendar",
    titleKey: "appt_empty_upcoming",
    title: "No upcoming appointments",
    bodyKey: "appt_empty_upcoming_d",
    body: "Book a visit with a verified provider in a few taps.",
  },
  completed: {
    icon: "done",
    titleKey: "appt_empty_completed",
    title: "No past visits yet",
    bodyKey: "appt_empty_completed_d",
    body: "Appointments move here once the visit date has passed.",
  },
  cancelled: {
    icon: "cancelled",
    titleKey: "appt_empty_cancelled",
    title: "Nothing cancelled",
    bodyKey: "appt_empty_cancelled_d",
    body: "Visits you cancel are listed here, with the rest of your history.",
  },
};

export default function AppointmentsPage() {
  const t = useT();
  const lang = useLang();
  const { push } = useToast();
  const [session] = useSession();
  const [bookings, setBookings] = useStoredCollection(KEYS.bookings, seedBookings);
  const [providers] = useStoredCollection(KEYS.providers, seedProviders);

  const [tab, setTab] = useState<Tab>("upcoming");
  const [refreshing, setRefreshing] = useState(false);
  const [rescheduling, setRescheduling] = useState<AppointmentView | null>(null);
  const [cancelling, setCancelling] = useState<AppointmentView | null>(null);
  const [slotDates, setSlotDates] = useState<string[]>([]);
  const [slotDate, setSlotDate] = useState("");
  const [slotTime, setSlotTime] = useState<string>(SLOTS[0]);

  const groups = useMemo(() => {
    const views = bookings.map((b) => toAppointment(b, providers));
    const own = views.filter((v) => v.booking.userId === session.userId);
    return partitionAppointments(own.length > 0 ? own : views);
  }, [bookings, providers, session.userId]);

  useEffect(() => {
    if (!refreshing) return;
    const id = window.setTimeout(() => setRefreshing(false), 400);
    return () => window.clearTimeout(id);
  }, [refreshing]);

  const next = groups.upcoming[0] ?? null;
  const list = groups[tab];
  const empty = EMPTY_COPY[tab];

  const openReschedule = (appointment: AppointmentView) => {
    const dates = Array.from(
      new Set(nextAvailableSlots(5).map((slot) => slot.slice(0, 10))),
    );
    setSlotDates(dates);
    setSlotDate(dates[0] ?? todayIso());
    setSlotTime(SLOTS.includes(appointment.time) ? appointment.time : SLOTS[0]);
    setRescheduling(appointment);
  };

  const confirmReschedule = () => {
    if (!rescheduling) return;
    setBookings((prev) =>
      prev.map((b) =>
        b.id === rescheduling.booking.id ? { ...b, date: slotDate, time: slotTime } : b,
      ),
    );
    push(t("appt_rescheduled", "Appointment rescheduled"));
    setRescheduling(null);
  };

  const confirmCancel = () => {
    if (!cancelling) return;
    setBookings((prev) =>
      prev.map((b) =>
        b.id === cancelling.booking.id
          ? { ...b, status: "cancelled", cancelledAt: todayIso() }
          : b,
      ),
    );
    push(t("appt_cancelled_toast", "Appointment cancelled"));
    setCancelling(null);
  };

  return (
    <Screen>
      {/* header ------------------------------------------------------- */}
      <div className="flex items-center gap-3 pt-1">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-bold leading-tight tracking-tight text-slate-900">
            {t("appt_title", "Appointments")}
          </h1>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {t("appt_sub", "Track your visits and request a new time in a few taps.")}
          </p>
        </div>
        <IconButton
          label={t("appt_refresh", "Refresh appointments")}
          onClick={() => setRefreshing(true)}
          disabled={refreshing}
        >
          <RefreshIcon className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </IconButton>
      </div>

      {/* next appointment --------------------------------------------- */}
      {refreshing ? (
        <div className="mt-4">
          <SkeletonCards rows={2} />
        </div>
      ) : next ? (
        <Card className="mt-4 overflow-hidden p-0">
          <div className="px-4 pb-3 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {t("appt_next", "Next appointment")}
            </p>
            <div className="mt-2 flex items-center gap-3">
              <Avatar
                name={next.providerName}
                role="doctor"
                size={44}
                seed={next.providerName.length}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {next.providerName}
                </p>
                <p className="truncate text-xs text-slate-500">{next.specialty}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Badge tone="brand">
                <CalendarIcon className="mr-1 h-3 w-3" />
                {formatDay(next.date)}
              </Badge>
              <Badge tone="slate">
                <ClockIcon className="mr-1 h-3 w-3" />
                {next.time}
              </Badge>
              <Badge tone="green">{next.kind}</Badge>
            </div>
          </div>

          <div className="divide-y divide-slate-100 border-t border-slate-100">
            {next.provider && (
              <ListRow
                href={`/find-care/${next.provider.id}`}
                icon={<StethoscopeIcon className="h-5 w-5" />}
                title={t("appt_view_provider", "View provider")}
                subtitle={
                  PROVIDER_CATEGORY_LABELS[lang]?.[next.provider.category] ??
                  next.provider.category
                }
              />
            )}
            <ListRow
              onClick={() => openReschedule(next)}
              icon={<RefreshIcon className="h-5 w-5" />}
              tone="green"
              title={t("appt_reschedule", "Reschedule")}
              subtitle={t("appt_reschedule_d", "Pick a new date and time")}
            />
            <ListRow
              onClick={() => setCancelling(next)}
              icon={<EmergencyIcon className="h-5 w-5" />}
              tone="rose"
              title={t("appt_cancel_visit", "Cancel this visit")}
              subtitle={t("appt_cancel_visit_d", "The provider will be notified")}
            />
          </div>
        </Card>
      ) : (
        <div className="mt-4">
          <EmptyState
            icon={<CalendarIcon className="h-6 w-6" />}
            title={t("appt_none_title", "No appointment booked")}
            body={t(
              "appt_none_d",
              "Find a verified provider near you and request a visit in a few taps.",
            )}
            action={
              <Link href="/find-care" className="mt-2">
                <Button>{t("appt_find_care", "Find care")}</Button>
              </Link>
            }
          />
        </div>
      )}

      {/* tabs --------------------------------------------------------- */}
      {!refreshing && (
        <div className="mt-5">
          <Tabs<Tab>
            tabs={[
              { value: "upcoming", label: t("appt_tab_upcoming", "Upcoming"), count: groups.upcoming.length },
              { value: "completed", label: t("appt_tab_completed", "Completed"), count: groups.completed.length },
              { value: "cancelled", label: t("appt_tab_cancelled", "Cancelled"), count: groups.cancelled.length },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>
      )}

      {/* list --------------------------------------------------------- */}
      <div className="mt-4 space-y-2.5">
        {refreshing ? null : list.length === 0 ? (
          <EmptyState
            icon={
              empty.icon === "calendar" ? (
                <CalendarIcon className="h-6 w-6" />
              ) : empty.icon === "done" ? (
                <ClockIcon className="h-6 w-6" />
              ) : (
                <EmergencyIcon className="h-6 w-6" />
              )
            }
            title={t(empty.titleKey, empty.title)}
            body={t(empty.bodyKey, empty.body)}
            action={
              <Link href="/find-care" className="mt-2">
                <Button tone="secondary">{t("appt_find_care", "Find care")}</Button>
              </Link>
            }
          />
        ) : (
          list.map((appointment) => (
            <AppointmentCard
              key={appointment.booking.id}
              appointment={appointment}
              onReschedule={() => openReschedule(appointment)}
              onCancel={() => setCancelling(appointment)}
            />
          ))
        )}
      </div>

      {/* need care sooner ---------------------------------------------- */}
      <SectionHeader title={t("appt_need_sooner", "Need care sooner?")} />
      <Card padded={false} className="overflow-hidden">
        <div className="divide-y divide-slate-100">
          <ListRow
            href="/services"
            icon={<SearchIcon className="h-5 w-5" />}
            tone="green"
            title={t("appt_services", "Request a health service")}
            subtitle={t("appt_services_d", "Screenings, wellness and mobile clinic visits")}
          />
          <ListRow
            href="/emergency"
            icon={<EmergencyIcon className="h-5 w-5" />}
            tone="rose"
            title={t("em_title", "Get Help Now")}
            subtitle={t("appt_emergency_d", "Emergency numbers and first-aid steps")}
          />
        </div>
      </Card>

      <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-400">
        {t(
          "ft_notdx",
          "HealthLink provides general health information and navigation. It is not a medical diagnosis and does not replace a healthcare professional.",
        )}
      </p>

      {/* reschedule sheet ---------------------------------------------- */}
      <BottomSheet
        open={rescheduling !== null}
        onClose={() => setRescheduling(null)}
        title={t("appt_reschedule", "Reschedule")}
        footer={
          <Button full onClick={confirmReschedule} disabled={!slotDate}>
            {t("appt_confirm_time", "Confirm new time")}
          </Button>
        }
      >
        {rescheduling && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
              <CalendarIcon className="h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {rescheduling.providerName}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {t("appt_current", "Currently")} {formatDay(rescheduling.date)} ·{" "}
                  {rescheduling.time}
                </p>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-600">
                {t("appt_pick_date", "Choose a date")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {slotDates.map((date) => (
                  <Chip key={date} active={date === slotDate} onClick={() => setSlotDate(date)}>
                    {formatDay(date)}
                  </Chip>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-600">
                {t("appt_pick_time", "Choose a time")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {SLOTS.map((slot) => (
                  <Chip key={slot} active={slot === slotTime} onClick={() => setSlotTime(slot)}>
                    {slot}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* cancel dialog ------------------------------------------------- */}
      <ConfirmDialog
        open={cancelling !== null}
        title={t("appt_cancel_title", "Cancel this appointment?")}
        body={
          cancelling
            ? `${t(
                "appt_cancel_body",
                "This appointment will be cancelled. You can book again later.",
              )} ${cancelling.providerName} · ${formatDay(cancelling.date)} · ${cancelling.time}`
            : undefined
        }
        confirmLabel={t("appt_cancel_confirm", "Yes, cancel")}
        cancelLabel={t("appt_keep", "Keep it")}
        onConfirm={confirmCancel}
        onCancel={() => setCancelling(null)}
      />
    </Screen>
  );
}
