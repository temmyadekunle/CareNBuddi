"use client";

import Link from "next/link";
import { CloudAccount } from "@/components/cloud-account";
import { AuthUnavailableNote } from "@/components/auth-unavailable";
import {
  Badge,
  Button,
  Card,
  ListRow,
  Screen,
  SectionHeader,
} from "@/components/app-ui";
import { LanguageIcon, LockIcon, LogOutIcon, UserIcon } from "@/components/icons";
import { LangSwitcher } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { endSession } from "@/lib/session";
import { LANGS } from "@/lib/lang";
import { isCloudEnabled } from "@/lib/supabase/client";
import {
  KEYS,
  seedUsers,
  useSession,
  useStoredCollection,
  type Session,
} from "@/lib/storage";

export default function AccountPage() {
  const t = useT();
  const [session, setSession] = useSession();
  const [users] = useStoredCollection(KEYS.users, seedUsers);

  const me = users.find((u) => u.id === session.userId);

  const signOut = () => {
    endSession("signout");
  };

  return (
    <Screen>
      <SectionHeader title={t("a_title", "Account")} subtitle={t("a_sub", "Sign in to keep your data together.")} />

      {isCloudEnabled ? (
        <div className="mt-3">
          <CloudAccount />
        </div>
      ) : (
        <Card className="mt-3 flex items-start gap-2 bg-slate-50">
          <LockIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
          <p className="text-xs text-slate-600">{t("a_sync_off", "Cloud sync is not configured on this build.")}</p>
        </Card>
      )}

      {me ? (
        <Card className="mt-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <UserIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{me.name}</p>
              <p className="truncate text-xs text-slate-500">{me.email}</p>
            </div>
            <Badge tone={me.role === "admin" ? "brand" : me.role === "provider" ? "green" : "slate"}>
              {me.role}
            </Badge>
          </div>
          <Button full tone="secondary" className="mt-4" onClick={signOut}>
            <LogOutIcon className="h-4 w-4" />
            {t("a_signout", "Sign out")}
          </Button>
        </Card>
      ) : (
        <Card className="mt-3">
          <AuthUnavailableNote action={t("a_signin", "Sign in")} />
          <p className="mt-3 text-xs text-slate-500">
            {t(
              "a_account_no_local_auth",
              "This build has no authentication service connected, so it cannot check a password. Signing in is handled by the CareNBuddi authentication service once it is available.",
            )}
          </p>
          <Link
            href="/auth/sign-in"
            className="tap mt-3 flex min-h-11 w-full items-center justify-center rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:border-brand-300 hover:text-brand-700 dark:border-slate-600 dark:text-slate-200"
          >
            {t("a_signin", "Sign in")}
          </Link>
          <Link
            href="/auth/sign-up"
            className="tap mt-2 block text-center text-xs font-semibold text-brand-700"
          >
            {t("auth_no_account", "New to CareNBuddi?")} {t("a_signup", "Create account")}
          </Link>
        </Card>
      )}

      <Card padded={false} className="mt-3 overflow-hidden">
        <ListRow
          href="/auth/forgot-password"
          icon={<LockIcon className="h-5 w-5" />}
          tone="slate"
          title={t("prof_change_password", "Change password")}
          subtitle={t("prof_change_password_d", "We email you a secure reset link")}
        />
      </Card>

      <Card className="mt-3">
        <div className="flex items-center gap-1.5">
          <LanguageIcon className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-900">{t("a_language", "Language")}</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">{t("a_language_d", "Choose the language you read most.")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <LangSwitcher />
          <span className="text-[11px] text-slate-400">{LANGS.map((l) => l.native).join(" · ")}</span>
        </div>
      </Card>

      <p className="mt-4 text-center text-xs text-slate-400">
        <Link href="/explore" className="font-semibold text-brand-700">
          {t("n_explore", "Explore")}
        </Link>{" "}
        ·{" "}
        <Link href="/find-care" className="font-semibold text-brand-700">
          {t("n_find", "Find Care")}
        </Link>
      </p>
    </Screen>
  );
}