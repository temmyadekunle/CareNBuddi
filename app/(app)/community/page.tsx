"use client";

import Link from "next/link";

import { Button, Card, Screen, SectionHeader } from "@/components/app-ui";
import { CommunityFeed } from "@/components/community/community-feed";
import { ChatIcon, ShieldIcon, StethoscopeIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { KEYS, seedUsers, useSession, useStoredCollection } from "@/lib/storage";

/**
 * Patient Community.
 *
 * Server-backed only. The database admits consumers (and administrators as
 * read-only moderators) to this space; the UI follows the same rule.
 */
export default function PatientCommunityPage() {
  const t = useT();
  const [session] = useSession();
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const me = users.find((user) => user.id === session.userId);

  if (me?.role === "provider") {
    return (
      <Screen>
        <SectionHeader
          title={t("cm_patient_space", "Patient Community")}
          subtitle={t("cm_patient_space_sub", "A patient-only space.")}
        />
        <Card className="mt-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t(
              "cm_provider_redirect",
              "Provider accounts take part in the professional Community space, not the patient space.",
            )}
          </p>
          <Link href="/provider/community" className="mt-3 inline-block">
            <Button>
              <StethoscopeIcon className="mr-1.5 h-4 w-4" />
              {t("cm_open_provider_space", "Open provider Community")}
            </Button>
          </Link>
        </Card>
      </Screen>
    );
  }

  const isAdmin = me?.role === "admin";

  return (
    <Screen>
      <SectionHeader
        title={t("cm_patient_space", "Patient Community")}
        subtitle={t(
          "cm_patient_space_sub",
          "Questions, experiences and support from other patients.",
        )}
      />

      <Card className="mt-4 flex items-start gap-2 border-brand-100 bg-brand-50/60 dark:border-brand-900 dark:bg-brand-950/30">
        <ShieldIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-700 dark:text-brand-300" />
        <div>
          <p className="text-sm font-semibold text-brand-900 dark:text-brand-100">
            {t("cm_privacy_title", "Keep health information private")}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-brand-900/80 dark:text-brand-100/80">
            {t(
              "cm_privacy_body",
              "Never post names, phone numbers, test results or anything that identifies another person. Posts in this space are visible to signed-in patients and moderators.",
            )}
          </p>
        </div>
      </Card>

      {isAdmin ? (
        <Card className="mt-3 flex items-start gap-2">
          <ChatIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t(
              "cm_admin_view",
              "You are viewing this space as an administrator. Moderation actions are in the admin console.",
            )}
          </p>
        </Card>
      ) : null}

      <div className="mt-4">
        <CommunityFeed
          space="patients"
          canCompose={me?.role === "consumer"}
          userId={session.userId}
        />
      </div>
    </Screen>
  );
}
