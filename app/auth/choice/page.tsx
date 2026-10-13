"use client";

import Link from "next/link";
import { Card, Screen, SectionHeader } from "@/components/app-ui";
import { HelpIcon, LockIcon, UserIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";

export default function AuthChoicePage() {
  const t = useT();
  return (
    <Screen>
      <SectionHeader
        title={t("auth_choice_title", "Welcome to CareNBuddi")}
        subtitle={t("auth_choice_sub", "Sign in to your account or create a new one.")}
      />
      <div className="mt-6 space-y-3 px-4 pb-20">
        <Card className="flex items-center gap-4 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            <LockIcon className="h-5 w-5" />
          </span>
          <Link href="/auth/sign-in/role" className="tap flex-1">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("a_signin", "Sign in")}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t("auth_choice_signin_sub", "Access your bookings, records and passport.")}</p>
            </div>
          </Link>
        </Card>

        <Card className="flex items-center gap-4 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            <UserIcon className="h-5 w-5" />
          </span>
          <Link href="/auth/sign-up/role" className="tap flex-1">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("a_signup", "Create account")}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t("auth_choice_signup_sub", "Start managing your health in one place.")}</p>
            </div>
          </Link>
        </Card>

        <Link
          href="/support"
          className="tap mt-4 flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <HelpIcon className="h-4 w-4" />
          {t("prof_help", "Help & Support")}
        </Link>

        <Link href="/app" className="tap mt-2 block text-center text-xs font-semibold text-brand-700">
          {t("auth_skip_guest", "Continue as guest")}
        </Link>
      </div>
    </Screen>
  );
}
