"use client";

import { useRouter } from "next/navigation";
import { Screen, SectionHeader } from "@/components/app-ui";
import { StethoscopeIcon, UserIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";

export default function SignUpRolePage() {
  const t = useT();
  const router = useRouter();
  return (
    <Screen>
      <SectionHeader
        title={t("auth_signup_title", "Create your account")}
        subtitle={t("auth_signup_role_sub", "Are you signing up as a patient or a healthcare provider?")}
      />
      <div className="mt-6 space-y-3 px-4 pb-20">
        <div
          className="tap flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
          onClick={() => router.push("/auth/sign-up?role=consumer")}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            <UserIcon className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("auth_role_patient", "Patient")}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t("auth_role_patient_sub", "Track your health, appointments and medications.")}</p>
          </div>
        </div>

        <div
          className="tap flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
          onClick={() => router.push("/provider/register")}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
            <StethoscopeIcon className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("a_provider", "Healthcare provider")}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t("auth_role_provider_sub", "Register your practice and start accepting patients.")}</p>
          </div>
        </div>

        <a href="/auth/sign-up" className="tap mt-2 block text-center text-xs font-semibold text-brand-700">
          {t("auth_any_role", "Any role (standard sign-up)")}
        </a>
        <a href="/auth/choice" className="tap mt-2 block text-center text-xs font-semibold text-slate-700 dark:text-slate-300">
          {t("auth_back_to_choice", "Back")}
        </a>
      </div>
    </Screen>
  );
}
