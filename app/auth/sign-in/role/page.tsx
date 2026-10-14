"use client";

import Link from "next/link";
import { Screen, SectionHeader } from "@/components/app-ui";
import { StethoscopeIcon, UserIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";

/**
 * How would you like to sign in?
 *
 * Both options are real links rather than clickable divs, for the same reason
 * as the sign-up role screen: as divs they could not be reached with a
 * keyboard or announced by a screen reader.
 */
const OPTIONS = [
  {
    href: "/auth/sign-in",
    titleKey: "auth_role_patient",
    title: "Patient",
    subKey: "auth_role_patient_sub",
    sub: "Access your personal health records and appointments.",
    Icon: UserIcon,
  },
  {
    href: "/auth/sign-in",
    titleKey: "a_provider",
    title: "Healthcare provider",
    subKey: "auth_role_provider_sub",
    sub: "Sign in to your provider portal.",
    Icon: StethoscopeIcon,
  },
] as const;

export default function SignInRolePage() {
  const t = useT();

  return (
    <Screen>
      <SectionHeader
        title={t("auth_signin_title", "Welcome back")}
        subtitle={t("auth_signin_role_sub", "Are you signing in as a patient or a healthcare provider?")}
      />
      <div className="mt-6 space-y-3 px-4 pb-20">
        {OPTIONS.map(({ href, titleKey, title, subKey, sub, Icon }) => (
          <Link
            key={titleKey}
            href={href}
            className="tap flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 no-underline transition-colors hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-600 dark:hover:bg-slate-700"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
              <Icon className="h-5 w-5" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t(titleKey, title)}
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">{t(subKey, sub)}</span>
            </span>
            <span aria-hidden="true" className="shrink-0 text-slate-400">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </span>
          </Link>
        ))}

        <Link
          href="/auth/sign-in"
          className="tap mt-2 block text-center text-xs font-semibold text-brand-700"
        >
          {t("auth_any_role", "Any role (standard sign-in)")}
        </Link>
        <Link
          href="/auth/choice"
          className="tap mt-2 block text-center text-xs font-semibold text-slate-700 dark:text-slate-300"
        >
          {t("auth_back_to_choice", "Back")}
        </Link>
      </div>
    </Screen>
  );
}