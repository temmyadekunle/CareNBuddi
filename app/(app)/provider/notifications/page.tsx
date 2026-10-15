"use client";

import Link from "next/link";

import { Badge, Card, EmptyState, Screen, SectionHeader } from "@/components/app-ui";
import { BellIcon, CalendarIcon, CheckIcon, UserIcon } from "@/components/icons";
import { ProviderShell, useProviderContext } from "@/components/provider-shell";
import { useT } from "@/lib/i18n";
import { KEYS, seedBookings, seedUsers, useStoredCollection } from "@/lib/storage";
import { bookingsForProvider, careRelationships } from "@/lib/provider-workspace";

/**
 * The persistent notification centre.
 *
 * Entries are generated from this account's own bookings, so the list can never
 * drift out of step with the dashboard counts or show something nobody acted
 * on. There is no read/unread flag stored per notification, because "unread"
 * here means a booking still waiting for the provider, which the booking
 * status already tells us.
 */

interface Notice {
  id: string;
  tone: "amber" | "brand" | "green";
  title: string;
  body: string;
  href: string;
  icon: typeof BellIcon;
}

export default function ProviderNotificationsPage() {
  return (
    <ProviderShell>
      <Notifications />
    </ProviderShell>
  );
}

function Notifications() {
  const t = useT();
  const ctx = useProviderContext();
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const [bookings] = useStoredCollection(KEYS.bookings, seedBookings);

  const mine = bookingsForProvider(bookings, ctx.providerId)
    .filter((b) => b.status !== "cancelled")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const relationships = careRelationships(bookings, ctx.providerId).filter((r) => r.active);

  const notices: Notice[] = [];

  for (const b of mine) {
    if (b.status === "new") {
      notices.push({
        id: `n-${b.id}`,
        tone: "amber",
        title: t("pws_n_new", "New care request"),
        body: t("pws_n_new_d", "A patient asked to be contacted about an appointment."),
        href: "/provider/patients",
        icon: BellIcon,
      });
    } else if (b.status === "contacted") {
      notices.push({
        id: `c-${b.id}`,
        tone: "brand",
        title: t("pws_n_confirm", "Awaiting your confirmation"),
        body: t("pws_n_confirm_d", "You confirmed contact; the appointment is not confirmed yet."),
        href: "/provider/patients",
        icon: CalendarIcon,
      });
    }
  }

  for (const rel of relationships) {
    const patient = users.find((u) => u.id === rel.patientId);
    const next = rel.bookings.find((b) => b.status === "confirmed" && b.date);
    if (next) {
      notices.push({
        id: `u-${rel.patientId}`,
        tone: "green",
        title: t("pws_n_upcoming", "Upcoming appointment"),
        body: `${patient?.name ?? t("pws_patient", "Patient")} · ${next.date}`,
        href: "/provider/patients",
        icon: UserIcon,
      });
    }
  }

  return (
    <Screen>
      <SectionHeader
        title={t("pws_notifs", "Notification centre")}
        subtitle={t("pws_notifs_sub", "Everything waiting on you in this account.")}
      />

      <div className="mt-3 flex items-center gap-2">
        <Badge tone={notices.length ? "amber" : "slate"}>
          {notices.length} {t("pws_items", "items")}
        </Badge>
        <Badge tone={ctx.unread ? "amber" : "slate"}>
          {ctx.unread} {t("pws_actionable", "needing action")}
        </Badge>
      </div>

      <div className="mt-4 space-y-2.5">
        {notices.length === 0 ? (
          <EmptyState
            icon={<CheckIcon className="h-6 w-6" />}
            title={t("pws_notifs_none", "Nothing to show")}
            body={t(
              "pws_notifs_none_d",
              "Notifications appear when a patient books, asks to be contacted, or has an appointment coming up.",
            )}
          />
        ) : (
          notices.map((n) => (
            <Link key={n.id} href={n.href} className="tap block">
              <Card>
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                      n.tone === "amber"
                        ? "bg-amber-500"
                        : n.tone === "brand"
                          ? "bg-brand-600"
                          : "bg-emerald-500"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                      {n.title}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{n.body}</p>
                  </div>
                  <n.icon className="h-4 w-4 shrink-0 text-slate-400" />
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>
      <div className="h-24" aria-hidden="true" />
    </Screen>
  );
}