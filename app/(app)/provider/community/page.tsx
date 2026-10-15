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
import { ChatIcon, FileTextIcon, ShieldIcon } from "@/components/icons";
import { ProviderShell } from "@/components/provider-shell";
import { useT } from "@/lib/i18n";

/**
 * Community.
 *
 * Professional discussion needs moderation, reporting and a way to keep
 * patient-identifiable information out of public threads. None of that is
 * built yet, so this screen does not show a feed, groups or badges implying
 * activity. It states what is missing and refuses to imply otherwise.
 */

const NOT_BUILT = [
  ["pws_comm_threads", "Discussion threads"],
  ["pws_comm_groups", "Professional groups"],
  ["pws_comm_resources", "Educational resources"],
  ["pws_comm_moderation", "Moderation and reporting"],
] as const;

export default function ProviderCommunityPage() {
  return (
    <ProviderShell>
      <Community />
    </ProviderShell>
  );
}

function Community() {
  const t = useT();

  return (
    <Screen>
      <SectionHeader
        title={t("pws_community", "Community")}
        subtitle={t("pws_community_sub", "Professional discussion and shared resources.")}
      />

      <Card className="mt-4 border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
        <div className="flex items-start gap-2">
          <ShieldIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              {t("pws_comm_unavailable", "Not available yet")}
            </h2>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
              {t(
                "pws_comm_unavailable_d",
                "Professional discussions open to patient-identifiable information cannot be turned on without moderation and reporting in place. Nothing is shown here until then.",
              )}
            </p>
          </div>
        </div>
      </Card>

      <Card className="mt-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {t("pws_comm_pending", "What is still needed")}
        </h2>
        <ul className="mt-3 space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
          {NOT_BUILT.map(([key, fallback]) => (
            <li key={key} className="flex items-center justify-between gap-2">
              <span>{t(key, fallback)}</span>
              <Badge tone="slate">{t("pws_not_built", "Not built")}</Badge>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-4 text-center">
        <EmptyState
          icon={<ChatIcon className="h-6 w-6" />}
          title={t("pws_comm_empty", "No community space yet")}
          body={t(
            "pws_comm_empty_d",
            "This is deliberately empty. An unmoderated professional forum would put patient information at risk.",
          )}
        />
      </Card>

      <Card className="mt-4">
        <div className="flex items-start gap-2">
          <FileTextIcon className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t("pws_comm_resources", "Resources available now")}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {t(
                "pws_comm_resources_d",
                "CareNBuddi publishes health information in the main app. Each article names who reviewed it.",
              )}
            </p>
            <Link href="/health" className="mt-2 inline-block">
              <Button tone="secondary" className="min-h-11">
                {t("pws_comm_go_health", "Open Health")}
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </Screen>
  );
}