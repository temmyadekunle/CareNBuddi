"use client";

import Link from "next/link";
import { useState } from "react";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Screen,
  SectionHeader,
  useToast,
} from "@/components/app-ui";
import {
  BellIcon,
  CalendarIcon,
  FileTextIcon,
  LockIcon,
  MessageIcon,
  UserIcon,
} from "@/components/icons";
import { ProviderShell, useProviderContext } from "@/components/provider-shell";
import { useT } from "@/lib/i18n";
import {
  KEYS,
  seedBookings,
  seedUsers,
  useStoredCollection,
} from "@/lib/storage";
import {
  canAccessCare,
  careRelationships,
  unassignedRequests,
} from "@/lib/provider-workspace";
import type { Booking } from "@/lib/types";

/**
 * Patient Care.
 *
 * The list is not a directory. Every row is a patient with at least one
 * appointment that names this provider; there is no search across all patients
 * and no way to reach someone by typing their name or id. A booking from a
 * caller who never signed in is a request to be contacted, and is shown in the
 * requests queue rather than as a patient.
 */

const STATUS_TONE: Record<Booking["status"], "amber" | "brand" | "green" | "slate"> = {
  new: "amber",
  contacted: "brand",
  confirmed: "green",
  completed: "green",
  cancelled: "slate",
};

export default function ProviderPatientsPage() {
  return (
    <ProviderShell>
      <PatientCare />
    </ProviderShell>
  );
}

function PatientCare() {
  const t = useT();
  const { push } = useToast();
  const ctx = useProviderContext();
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const [bookings, setBookings] = useStoredCollection(KEYS.bookings, seedBookings);
  const [selected, setSelected] = useState<string | null>(null);

  const relationships = careRelationships(bookings, ctx.providerId);
  const requests = unassignedRequests(bookings);

  const setBookingStatus = (id: string, status: Booking["status"]) => {
    setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
    push(t("prv_updated", "Updated"), "success");
  };

  /* Opening a patient runs the access check again rather than trusting the
     list it came from, so a stale link cannot grant access on its own. */
  const open = relationships.find((r) => r.patientId === selected);
  if (selected && open && !canAccessCare(ctx.providerId, selected, bookings)) {
    // Should be unreachable; treated as a hard stop rather than a redirect.
    return <Denied />;
  }

  if (open) {
    const patient = users.find((u) => u.id === open.patientId);
    return (
      <Screen>
        <Link
          href="/provider/patients"
          className="tap inline-flex min-h-11 items-center gap-1 text-sm font-medium text-slate-500"
        >
          ← {t("pws_back_care", "Patient Care")}
        </Link>
        <SectionHeader
          title={patient?.name ?? t("pws_patient", "Patient")}
          subtitle={t("pws_care_rel", "Connected to your practice")}
        />

        <Card className="mt-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t("pws_appointments", "Appointments")}
          </h2>
          <div className="mt-2 space-y-2.5">
            {open.bookings.map((b) => (
              <div
                key={b.id}
                className="flex items-start justify-between gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                    {b.date ?? t("pws_no_date", "No date given")}
                    {b.time ? ` · ${b.time}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {b.kind ?? t("pws_consult", "Consultation")}
                    {b.specialty ? ` · ${b.specialty}` : ""}
                  </p>
                  {b.message ? (
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{b.message}</p>
                  ) : null}
                </div>
                <Badge tone={STATUS_TONE[b.status]}>{b.status}</Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* No shared-records store exists yet, so these say so rather than
            showing a plausible-looking but empty record list. */}
        <Unavailable
          icon={<FileTextIcon className="h-6 w-6" />}
          title={t("pws_records", "Shared records")}
          body={t(
            "pws_records_d",
            "No clinical records have been shared with you. A patient shares records from their own health section, and nothing is visible here until they do.",
          )}
        />
        <Unavailable
          icon={<MessageIcon className="h-6 w-6" />}
          title={t("pws_messages", "Messages")}
          body={t(
            "pws_messages_d",
            "Secure messaging between you and this patient is not available yet. Contact details are on the appointment.",
          )}
        />
        <Unavailable
          icon={<CalendarIcon className="h-6 w-6" />}
          title={t("pws_followup_tasks", "Follow-up tasks")}
          body={t(
            "pws_followup_tasks_d",
            "Follow-up tasks are not available yet.",
          )}
        />
        <Unavailable
          icon={<FileTextIcon className="h-6 w-6" />}
          title={t("pws_referrals", "Referrals")}
          body={t("pws_referrals_d", "Referral coordination is not available yet.")}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <SectionHeader
        title={t("pws_care", "Patient Care")}
        subtitle={t("pws_care_sub", "Only patients connected to your practice appear here.")}
      />

      {/* Incoming requests from people who are not patients yet. */}
      <section className="mt-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t("pws_incoming", "Incoming requests")}
          </h2>
          <Badge tone={requests.length ? "amber" : "slate"}>{requests.length}</Badge>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {t(
            "pws_incoming_d",
            "Requests from people who have not created an account. They are not patients and have no records.",
          )}
        </p>
        <div className="mt-2 space-y-2.5">
          {requests.length === 0 ? (
            <EmptyState
              icon={<BellIcon className="h-6 w-6" />}
              title={t("pws_no_requests", "No incoming requests")}
              body={t("pws_no_requests_d", "Requests from your listing appear here.")}
            />
          ) : (
            requests.map((b) => (
              <Card key={b.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                      {b.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{b.phone}</p>
                    {b.message ? (
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{b.message}</p>
                    ) : null}
                  </div>
                  <Badge tone={STATUS_TONE[b.status]}>{b.status}</Badge>
                </div>
                <Button full className="mt-3" onClick={() => setBookingStatus(b.id, "contacted")}>
                  {t("pv_confirm", "Mark contacted")}
                </Button>
              </Card>
            ))
          )}
        </div>
      </section>

      {/* Patients, derived only from appointments. */}
      <section className="mt-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {t("pws_your_patients", "Your patients")}
          </h2>
          <Badge tone={relationships.filter((r) => r.active).length ? "brand" : "slate"}>
            {relationships.filter((r) => r.active).length}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {t(
            "pws_your_patients_d",
            "A patient appears here once they book with you, and disappears when every appointment is cancelled.",
          )}
        </p>

        <div className="mt-2 space-y-2.5">
          {relationships.length === 0 ? (
            <EmptyState
              icon={<UserIcon className="h-6 w-6" />}
              title={t("pws_no_patients", "No patients yet")}
              body={t(
                "pws_no_patients_d",
                "There is no patient directory. When someone books an appointment with your practice, they appear here.",
              )}
            />
          ) : (
            relationships.map((rel) => {
              const patient = users.find((u) => u.id === rel.patientId);
              return (
                <Card key={rel.patientId}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                        {patient?.name ?? t("pws_patient", "Patient")}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {rel.bookings.length}{" "}
                        {rel.bookings.length === 1
                          ? t("pws_appointment", "appointment")
                          : t("pws_appointments_plural", "appointments")}
                        {" · "}
                        {rel.bookings[0]?.date ?? t("pws_no_date", "No date given")}
                      </p>
                    </div>
                    <Badge tone={rel.active ? "green" : "slate"}>
                      {rel.active
                        ? t("pws_active", "In care")
                        : t("pws_closed", "Closed")}
                    </Badge>
                  </div>
                  <Button
                    full
                    tone="secondary"
                    className="mt-3"
                    onClick={() => setSelected(rel.patientId)}
                  >
                    {t("pws_open", "Open")}
                  </Button>
                </Card>
              );
            })
          )}
        </div>
      </section>
    </Screen>
  );
}

function Denied() {
  const t = useT();
  return (
    <Screen>
      <Card className="mt-6 text-center">
        <EmptyState
          icon={<LockIcon className="h-6 w-6" />}
          title={t("pws_no_access", "No care relationship")}
          body={t(
            "pws_no_access_d",
            "You can only open a patient connected to your practice by an appointment.",
          )}
          action={
            <Link href="/provider/patients" className="inline-block min-h-11">
              <Button className="min-h-11">{t("pws_back_care", "Patient Care")}</Button>
            </Link>
          }
        />
      </Card>
    </Screen>
  );
}

/**
 * A capability that does not exist yet.
 *
 * Deliberately says so. Rendering an empty card with a heading that implies
 * the data exists would be worse than admitting it does not.
 */
function Unavailable({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  const t = useT();
  return (
    <Card className="mt-4">
      <div className="flex items-center gap-2">
        <span className="text-slate-400">{icon}</span>
        <h2 className="flex-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        <Badge tone="slate">{t("pws_unavailable", "Not available yet")}</Badge>
      </div>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{body}</p>
    </Card>
  );
}