"use client";

import Link from "next/link";

import { Button, Card, Screen, SectionHeader } from "@/components/app-ui";
import { CommunityFeed } from "@/components/community/community-feed";
import { ShieldIcon } from "@/components/icons";
import { ProviderShell } from "@/components/provider-shell";
import { useT } from "@/lib/i18n";
import { useAccessIdentity } from "@/lib/access-identity";
import { useServerApplication } from "@/lib/server-provider-applications";

/**
 * Provider Community.
 *
 * Access is decided by the database: only a provider account whose
 * application status is 'verified' may post or read here. The UI mirrors
 * that so an unverified provider is told why the space is read-only, rather
 * than being shown an empty feed that looks broken.
 */
export default function ProviderCommunityPage() {
  return (
    <ProviderShell>
      <ProviderCommunity />
    </ProviderShell>
  );
}

function ProviderCommunity() {
  const t = useT();
  const { user: me, pending } = useAccessIdentity();
  const { application, phase } = useServerApplication(me?.id ?? null);

  /* The database admits only a provider whose application row says
     'verified'. The UI mirrors that decision; it never infers verification
     from the local account mirror. */
  const verified =
    me?.role === "provider" && phase === "ready" && application?.status === "verified";
  const isAdmin = me?.role === "admin";
  const statusUnknown =
    pending || phase === "loading" || phase === "offline" || phase === "error";

  return (
    <Screen>
      <SectionHeader
        title={t("cm_provider_space", "Provider Community")}
        subtitle={t(
          "cm_provider_space_sub",
          "Peer discussion for verified healthcare professionals.",
        )}
      />

      {isAdmin ? (
        <Card className="mt-4">
          <p className="text-sm leading-relaxed text-slate-600">
            {t(
              "cm_admin_moderates",
              "Administrators review this space from the admin console. Participation is limited to verified providers.",
            )}
          </p>
          <Link href="/admin" className="mt-3 inline-block min-h-11">
            <Button full>{t("ad_title", "Admin console")}</Button>
          </Link>
        </Card>
      ) : statusUnknown ? (
        <Card className="mt-4 border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <div className="flex items-start gap-2">
            <ShieldIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                {t("cm_verify_unknown", "Verification status unavailable")}
              </h2>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                {t(
                  "cm_verify_unknown_body",
                  "CareNBuddi cloud could not confirm your verification, so this space stays closed. Community also needs the backend to load discussions.",
                )}
              </p>
            </div>
          </div>
        </Card>
      ) : !verified ? (
        <Card className="mt-4 border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <div className="flex items-start gap-2">
            <ShieldIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                {t("cm_verified_only", "Verified providers only")}
              </h2>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                {t(
                  "cm_verified_only_body",
                  "This space opens after your provider application is verified. Until then you can read the patient Community, but you cannot post or read professional discussions.",
                )}
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="mt-4 flex items-start gap-2 border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/30">
          <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-300" />
          <p className="text-xs leading-relaxed text-emerald-900/80 dark:text-emerald-100/80">
            {t(
              "cm_provider_privacy",
              "Professional discussion still excludes patient-identifiable information. Do not post records, images or details that could identify a patient.",
            )}
          </p>
        </Card>
      )}

      {verified ? (
        <div className="mt-4">
          <CommunityFeed space="providers" canCompose userId={me?.id ?? null} />
        </div>
      ) : null}
    </Screen>
  );
}
