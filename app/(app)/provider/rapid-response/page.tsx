"use client";

import Link from "next/link";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Screen,
  SectionHeader,
} from "@/components/app-ui";
import { AlertIcon, BellIcon, CheckIcon, ClockIcon, PhoneIcon } from "@/components/icons";
import { ProviderShell, useProviderContext } from "@/components/provider-shell";
import { useT } from "@/lib/i18n";
import {
  KEYS,
  seedBookings,
  useStoredCollection,
} from "@/lib/storage";
import { bookingsForProvider } from "@/lib/provider-workspace";

/**
 * Rapid Response.
 *
 * This screen exists as an interface and a set of foundations, not as a working
 * dispatch service. No ambulance or emergency service is connected, so nothing
 * here claims a request was dispatched, accepted or escalated. The status
 * vocabulary below deliberately stops at "sent to the platform" and says
 * plainly that no responder has picked anything up.
 *
 * When a real integration is configured, RESPONSE_INTEGRATION is flipped to
 * true and the wording changes. Until then it is false and the UI says so.
 */

/** False until an emergency service integration actually exists. */
const RESPONSE_INTEGRATION = false;

export default function ProviderRapidResponsePage() {
  return (
    <ProviderShell>
      <RapidResponse />
    </ProviderShell>
  );
}

function RapidResponse() {
  const t = useT();
  const ctx = useProviderContext();
  const [bookings] = useStoredCollection(KEYS.bookings, seedBookings);

  const mine = bookingsForProvider(bookings, ctx.providerId);

  return (
    <Screen>
      <SectionHeader
        title={t("pws_rapid", "Rapid Response")}
        subtitle={t("pws_rapid_sub", "Urgent care coordination.")}
      />

      {/* The status of the integration itself, stated up front. */}
      <Card className="mt-4 border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
        <div className="flex items-start gap-2">
          <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              {t("pws_rapid_unavailable", "Awaiting integration")}
            </h2>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
              {t(
                "pws_rapid_unavailable_d",
                "CareNBuddi is not connected to an ambulance or emergency dispatch service. Nothing you send here is an emergency response, and no responder has been alerted.",
              )}
            </p>
          </div>
        </div>
      </Card>

      {/* The foundations, visible but explicitly inactive. */}
      <Card className="mt-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("pws_rapid_foundations", "Coordination foundations")}
        </h2>
        <ul className="mt-3 space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
          {[
            ["pws_rapid_incoming", "Incoming urgent requests"],
            ["pws_rapid_availability", "Responder availability"],
            ["pws_rapid_ack", "Request acknowledgement"],
            ["pws_rapid_escalation", "Escalation status"],
            ["pws_rapid_sharing", "Secure information sharing"],
            ["pws_rapid_referral", "Referral coordination"],
            ["pws_rapid_history", "Response history"],
          ].map(([key, fallback]) => (
            <li key={key} className="flex items-center justify-between gap-2">
              <span>{t(key, fallback)}</span>
              <Badge tone="slate">{t("pws_not_built", "Not built")}</Badge>
            </li>
          ))}
        </ul>
      </Card>

      {/* No urgent requests may be shown, because nothing would have created
          them. Saying "0 urgent requests" would imply a queue that exists. */}
      <Card className="mt-4 text-center">
        <EmptyState
          icon={<BellIcon className="h-6 w-6" />}
          title={t("pws_rapid_none", "No urgent request channel")}
          body={t(
            "pws_rapid_none_d",
            "When urgent requests are enabled, they appear here with their acknowledgement and escalation state.",
          )}
        />
      </Card>

      {/* Ordinary bookings are not emergencies, and must not be dressed up
          as one. */}
      <Card className="mt-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("pws_rapid_bookings", "Your non-urgent bookings")}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {t(
            "pws_rapid_bookings_d",
            "These are routine appointments, not emergencies. For a medical emergency, contact your local emergency number directly.",
          )}
        </p>
        <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          {mine.length}{" "}
          {mine.length === 1
            ? t("pws_booking", "booking")
            : t("pws_bookings", "bookings")}
        </p>
      </Card>

      <Card className="mt-4">
        <div className="flex items-start gap-2">
          <PhoneIcon className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t("pws_emergency", "In an emergency")}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {t(
                "pws_emergency_d",
                "Contact your national emergency number. Do not use CareNBuddi to report an emergency.",
              )}
            </p>
            <Link href="/emergency" className="mt-2 inline-block">
              <Button tone="secondary" className="min-h-11">
                <ClockIcon className="mr-1.5 h-4 w-4" />
                {t("pws_emergency_cta", "Emergency contacts")}
              </Button>
            </Link>
          </div>
        </div>
      </Card>

      {!RESPONSE_INTEGRATION ? (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
          <CheckIcon className="h-3.5 w-3.5" />
          {t("pws_rapid_flag", "No dispatch integration is configured for this deployment.")}
        </p>
      ) : null}
    </Screen>
  );
}