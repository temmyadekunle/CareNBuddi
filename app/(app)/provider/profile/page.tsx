"use client";

import Link from "next/link";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Screen,
  SectionHeader,
  ListRow,
} from "@/components/app-ui";
import { CheckIcon, LockIcon, ShieldIcon, UserIcon } from "@/components/icons";
import { ProviderShell, useProviderContext } from "@/components/provider-shell";
import { useT } from "@/lib/i18n";
import { useProviderApplications } from "@/lib/use-provider-application";
import {
  KEYS,
  seedProviders,
  seedUsers,
  useSession,
  useStoredCollection,
} from "@/lib/storage";

/**
 * The provider's own profile.
 *
 * Verification details are read-only here and only ever summarised. Identity
 * documents, NIN values and licence file contents are never rendered on this
 * screen, because this is the profile that appears in professional listings.
 * The applicant sees exactly what a reviewer needs to see and no more.
 */

export default function ProviderProfilePage() {
  return (
    <ProviderShell>
      <ProviderProfile />
    </ProviderShell>
  );
}

function ProviderProfile() {
  const t = useT();
  const ctx = useProviderContext();
  const [session] = useSession();
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const [providers] = useStoredCollection(KEYS.providers, seedProviders);
  const { forUser } = useProviderApplications();

  const me = users.find((u) => u.id === session.userId);
  const application = forUser(me?.id ?? null);
  const facility = providers.find((p) => p.id === ctx.providerId);

  const identityStatus = application?.identityStatus ?? null;
  const credentialsStatus = application?.credentialsStatus ?? null;

  return (
    <Screen>
      <SectionHeader
        title={t("pws_profile", "Profile")}
        subtitle={me?.name ?? t("pv_sub", "Manage your profile and requests.")}
      />

      {/* Public-facing professional information. */}
      <Card className="mt-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("pws_prof_info", "Professional information")}
        </h2>
        <dl className="mt-3 space-y-2 text-sm">
          <Row label={t("a_name", "Full name")} value={me?.name} />
          <Row label={t("a_email", "Email")} value={me?.email} />
          <Row label={t("a_phone", "Phone")} value={me?.phone} />
          <Row label={t("prg_facility", "Facility")} value={facility?.name} />
          <Row label={t("prg_category", "Category")} value={facility?.category} />
        </dl>
        <Link href="/provider/practice" className="mt-3 inline-block">
          <Button tone="secondary" className="min-h-11">
            {t("pws_edit_practice", "Edit practice details")}
          </Button>
        </Link>
      </Card>

      {/* Verification, summarised and read-only. */}
      <Card className="mt-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("pws_verification", "Verification status")}
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          {t(
            "pws_verification_d",
            "Your verification status is shown on your application. It is never editable from this workspace.",
          )}
        </p>

        <div className="mt-3 space-y-2">
          <StatusRow
            label={t("pr_identity", "Identity")}
            status={identityStatus}
            fallback={t("pws_no_application", "No application on this account")}
          />
          <StatusRow
            label={t("pws_credentials", "Professional credentials")}
            status={credentialsStatus}
            fallback={t("pws_no_application", "No application on this account")}
          />
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
          <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {t(
              "pws_private_docs",
              "Identity documents, NIN values and licence files are never shown here or on any public profile. They stay in your application for the review team only.",
            )}
          </p>
        </div>
      </Card>

      {/* Preferences and account. */}
      <Card className="mt-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("pws_account", "Account")}
        </h2>
        <div className="mt-2">
          <ListRow
            title={t("n_profile", "Profile")}
            subtitle={t("pws_account_profile", "Personal details, privacy, sign out")}
            icon={<UserIcon className="h-5 w-5" />}
            href="/profile"
          />
          <ListRow
            title={t("pws_reminders", "Reminders")}
            subtitle={t("pws_account_reminders", "Your own health reminders")}
            icon={<CheckIcon className="h-5 w-5" />}
            href="/reminders"
          />
        </div>
      </Card>

      {!application ? (
        <Card className="mt-4 text-center">
          <EmptyState
            icon={<LockIcon className="h-6 w-6" />}
            title={t("pws_no_application", "No application on this account")}
            body={t(
              "pws_no_application_d",
              "This account has no provider application, so there is no verification status to show.",
            )}
            action={
              <Link href="/provider/register" className="inline-block min-h-11">
                <Button className="min-h-11">{t("pv_register", "Register your facility")}</Button>
              </Link>
            }
          />
        </Card>
      ) : null}
      <div className="h-24" aria-hidden="true" />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium text-slate-800 dark:text-slate-100">
        {value || "—"}
      </dd>
    </div>
  );
}

function StatusRow({
  label,
  status,
  fallback,
}: {
  label: string;
  status: string | null;
  fallback: string;
}) {
  const tone =
    status === "verified" ? "green" : status === "rejected" ? "rose" : status ? "amber" : "slate";
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
      <Badge tone={tone}>{status ? status : fallback}</Badge>
    </div>
  );
}