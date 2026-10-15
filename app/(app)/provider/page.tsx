"use client";

import Link from "next/link";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ListRow,
  Screen,
  SectionHeader,
  useToast,
} from "@/components/app-ui";
import {
  BellIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  MessageIcon,
  StethoscopeIcon,
  UserIcon,
} from "@/components/icons";
import { ProviderShell, useProviderContext } from "@/components/provider-shell";
import { useT } from "@/lib/i18n";
import {
  KEYS,
  seedBookings,
  seedUsers,
  todayIso,
  useSession,
  useStoredCollection,
} from "@/lib/storage";
import {
  bookingsForProvider,
  isUpcoming,
} from "@/lib/provider-workspace";
import type { Booking } from "@/lib/types";

/**
 * The provider dashboard.
 *
 * Every number here is counted from the bookings already in this account. A
 * zero means there is nothing in your records; it is never replaced with a
 * sample figure, and there is no seeded patient, consultation or alert to make
 * the screen look busier than it is.
 */

const STATUS_TONE: Record<Booking["status"], "amber" | "brand" | "green" | "slate"> = {
  new: "amber",
  contacted: "brand",
  confirmed: "green",
  completed: "green",
  cancelled: "slate",
};

export default function ProviderDashboardPage() {
  return (
    <ProviderShell>
      <Dashboard />
    </ProviderShell>
  );
}

function Dashboard() {
  const t = useT();
  const { push } = useToast();
  const ctx = useProviderContext();
  const [session] = useSession();
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const [bookings, setBookings] = useStoredCollection(KEYS.bookings, seedBookings);

  const today = todayIso();
  const mine = bookingsForProvider(bookings, ctx.providerId);
  const open = mine.filter((b) => b.status !== "cancelled" && b.status !== "completed");
  const upcoming = open
    .filter((b) => isUpcoming(b, today))
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  const me = users.find((u) => u.id === session.userId);

  const setBookingStatus = (id: string, status: Booking["status"]) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
    push(t("prv_updated", "Updated"), "success");
  };

  /* No facility linked at all: say so plainly instead of showing an empty
     dashboard with zeroes that look like bad news. */
  if (!ctx.providerId) {
    return (
      <Screen>
        <SectionHeader
          title={t("pws_dash", "Dashboard")}
          subtitle={t("pv_sub", "Manage your profile and requests.")}
        />
        <Card className="mt-4 text-center">
          <EmptyState
            icon={<StethoscopeIcon className="h-6 w-6" />}
            title={t("pv_none", "No facility linked")}
            body={t(
              "pv_pending_d",
              "Our team reviews each registration before the portal opens.",
            )}
            action={
              <Link href="/provider/register" className="inline-block min-h-11">
                <Button className="min-h-11">{t("pv_register", "Register your facility")}</Button>
              </Link>
            }
          />
        </Card>
      </Screen>
    );
  }

  const tiles = [
    {
      key: "pws_new_requests",
      fallback: "New care requests",
      value: ctx.counts.newRequests,
      href: "/provider/patients",
      icon: BellIcon,
    },
    {
      key: "pws_upcoming",
      fallback: "Upcoming appointments",
      value: ctx.counts.upcoming,
      href: "/provider/patients",
      icon: CalendarIcon,
    },
    {
      key: "pws_confirm",
      fallback: "Awaiting confirmation",
      value: ctx.counts.awaitingConfirmation,
      href: "/provider/patients",
      icon: ClockIcon,
    },
    {
      key: "pws_followups",
      fallback: "Follow-up tasks",
      value: ctx.counts.followUpsDue,
      href: "/provider/patients",
      icon: CheckIcon,
    },
    {
      key: "pws_patients",
      fallback: "Patients in your care",
      value: ctx.counts.patients,
      href: "/provider/patients",
      icon: UserIcon,
    },
    {
      key: "pws_messages",
      fallback: "Unread messages",
      value: 0,
      href: "/provider/patients",
      icon: MessageIcon,
    },
  ];

  const none = ctx.counts.newRequests + ctx.counts.awaitingConfirmation + ctx.counts.upcoming;

  return (
    <Screen>
      <SectionHeader
        title={t("pws_dash", "Dashboard")}
        subtitle={
          ctx.facilityName
            ? `${ctx.facilityName}${me?.name ? ` · ${me.name}` : ""}`
            : (me?.name ?? t("pv_sub", "Manage your profile and requests."))
        }
      />

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tiles.map((tile) => (
          <Link
            key={tile.key}
            href={tile.href}
            className="tap rounded-xl border border-slate-200 bg-white p-3 hover:border-brand-300 dark:border-slate-700 dark:bg-slate-900"
          >
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <tile.icon className="h-3.5 w-3.5" />
              <span className="truncate">{t(tile.key, tile.fallback)}</span>
            </span>
            <span className="mt-1 block text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
              {tile.value}
            </span>
          </Link>
        ))}
      </div>

      {/* Verification status, stated from the application record only. */}
      <Card className="mt-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t("pws_verification", "Verification status")}
          </h2>
          <Badge tone="slate">{t("pr_identity", "Identity")}</Badge>
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {t(
            "pws_verification_d",
            "Your verification status is shown on your application. It is never editable from this workspace.",
          )}
        </p>
        <Link href="/provider/profile" className="mt-3 inline-block">
          <Button tone="secondary" className="min-h-11">
            {t("pws_view_profile", "View verification")}
          </Button>
        </Link>
      </Card>

      {/* Service availability: only ever what the provider configured. */}
      <Card className="mt-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("pws_availability", "Service availability")}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {t(
            "pws_availability_d",
            "Set your opening hours in Practice. Until you do, we do not list you as available.",
          )}
        </p>
        <Link href="/provider/practice" className="mt-3 inline-block">
          <Button tone="secondary" className="min-h-11">
            {t("pws_set_hours", "Set opening hours")}
          </Button>
        </Link>
      </Card>

      {/* Upcoming appointments, straight from the booking dates. */}
      <section className="mt-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t("pws_upcoming", "Upcoming appointments")}
          </h2>
          <Badge tone={upcoming.length ? "brand" : "slate"}>{upcoming.length}</Badge>
        </div>

        <div className="mt-2 space-y-2.5">
          {upcoming.length === 0 ? (
            <EmptyState
              icon={<CalendarIcon className="h-6 w-6" />}
              title={t("pws_no_upcoming", "No upcoming appointments")}
              body={t(
                "pws_no_upcoming_d",
                "Appointments appear here once a patient books a date that has not passed.",
              )}
            />
          ) : (
            upcoming.map((b) => (
              <Card key={b.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                      {b.name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {b.date}
                      {b.time ? ` · ${b.time}` : ""}
                      {b.kind ? ` · ${b.kind}` : ""}
                    </p>
                  </div>
                  <Badge tone={STATUS_TONE[b.status]}>{b.status}</Badge>
                </div>
                {b.status === "contacted" ? (
                  <Button full className="mt-3" onClick={() => setBookingStatus(b.id, "confirmed")}>
                    {t("pv_confirm_done", "Mark confirmed")}
                  </Button>
                ) : null}
              </Card>
            ))
          )}
        </div>
      </section>

      {/* Anything needing the provider to act. */}
      <section className="mt-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("pws_needs_attention", "Needs your attention")}
        </h2>
        <div className="mt-2 space-y-2.5">
          {none === 0 ? (
            <EmptyState
              icon={<CheckIcon className="h-6 w-6" />}
              title={t("pws_all_clear", "Nothing waiting")}
              body={t(
                "pws_all_clear_d",
                "When a patient books or replies, it appears here.",
              )}
            />
          ) : (
            open
              .filter((b) => b.status === "new" || b.status === "contacted")
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((b) => (
                <Card key={b.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                        {b.name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{b.phone}</p>
                      {b.message ? (
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                          {b.message}
                        </p>
                      ) : null}
                    </div>
                    <Badge tone={STATUS_TONE[b.status]}>{b.status}</Badge>
                  </div>
                  <div className="mt-3 flex gap-2">
                    {b.status === "new" ? (
                      <Button full onClick={() => setBookingStatus(b.id, "contacted")}>
                        {t("pv_confirm", "Mark contacted")}
                      </Button>
                    ) : (
                      <Button full onClick={() => setBookingStatus(b.id, "confirmed")}>
                        {t("pv_confirm_done", "Mark confirmed")}
                      </Button>
                    )}
                  </div>
                </Card>
              ))
          )}
        </div>
      </section>

      <section className="mt-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("pws_shortcuts", "Shortcuts")}
        </h2>
        <div className="mt-2">
          <ListRow
            title={t("pws_care", "Patient Care")}
            subtitle={t(
              "pws_care_d",
              "Requests and the patients connected to your practice.",
            )}
            icon={<UserIcon className="h-5 w-5" />}
            href="/provider/patients"
          />
          <ListRow
            title={t("pws_rapid", "Rapid Response")}
            subtitle={t("pws_rapid_d", "Urgent care coordination.")}
            icon={<BellIcon className="h-5 w-5" />}
            href="/provider/rapid-response"
          />
          <ListRow
            title={t("pws_notifs", "Notification centre")}
            subtitle={t("pws_notifs_d", "Everything waiting on you.")}
            icon={<MessageIcon className="h-5 w-5" />}
            href="/provider/notifications"
          />
        </div>
      </section>
    </Screen>
  );
}