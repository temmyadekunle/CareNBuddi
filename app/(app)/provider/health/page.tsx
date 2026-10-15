"use client";

import Link from "next/link";

import { Button, Card, Screen, SectionHeader, EmptyState } from "@/components/app-ui";
import { LockIcon, UserIcon } from "@/components/icons";
import { ProviderShell } from "@/components/provider-shell";
import { useT } from "@/lib/i18n";

/**
 * My Health, for the provider as an individual patient.
 *
 * This reuses the ordinary patient health area rather than forking it. The
 * important part is what it is *not*: the provider's own diary, records and
 * reminders are stored under their account exactly as they are for any
 * patient, and nothing on those screens reads the care relationships. Being
 * treated by a patient of yours gives you no access to their records, and
 * being a provider gives you no access to theirs from here.
 */
export default function ProviderMyHealthPage() {
  return (
    <ProviderShell>
      <MyHealth />
    </ProviderShell>
  );
}

function MyHealth() {
  const t = useT();

  return (
    <Screen>
      <SectionHeader
        title={t("pws_myhealth", "My Health")}
        subtitle={t("pws_myhealth_sub", "Your own health, as a patient.")}
      />

      <Card className="mt-4">
        <EmptyState
          icon={<UserIcon className="h-6 w-6" />}
          title={t("pws_myhealth_same", "The same health tools everyone else uses")}
          body={t(
            "pws_myhealth_same_d",
            "Your diary, records, reminders and journal are the standard CareNBuddi patient ones, kept under your own account.",
          )}
          action={
            <Link href="/health" className="inline-block min-h-11">
              <Button className="min-h-11">{t("pws_myhealth_open", "Open My Health")}</Button>
            </Link>
          }
        />
      </Card>

      <Card className="mt-4">
        <div className="flex items-start gap-2">
          <LockIcon className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t("pws_myhealth_sep", "Kept separate")}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {t(
                "pws_myhealth_sep_d",
                "Your personal health information is not mixed with records of patients you treat, and being a provider does not give you access to anyone else's records through this section.",
              )}
            </p>
          </div>
        </div>
      </Card>
      <div className="h-24" aria-hidden="true" />
    </Screen>
  );
}