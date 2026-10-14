"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  AuthError,
  AuthField,
  AuthIntro,
  AuthSubmit,
  AuthSwitch,
  OfflineNote,
} from "@/components/auth-form";
import { Card, Field, inputClass, Screen, SectionHeader, useToast } from "@/components/app-ui";
import { ChevronLeftIcon, StethoscopeIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import {
  PROVIDER_CATEGORIES_DETAIL,
  newApplication,
  type ProviderCategoryId,
} from "@/lib/provider-application";
import { KEYS, seedUsers, uid, useSession, useStoredCollection } from "@/lib/storage";
import { isCloudEnabled } from "@/lib/supabase/client";
import { useCloud } from "@/lib/supabase/cloud";
import { useProviderApplications } from "@/lib/use-provider-application";
import type { User } from "@/lib/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Create Account as Health Provider.
 *
 * This creates the account *and* the first slice of the professional
 * application in one step, then hands the applicant to onboarding. It mirrors
 * the account creation in /auth/sign-up rather than inventing a second one, and
 * it never marks anybody verified: a new account is a draft application.
 */
export default function ProviderRegisterPage() {
  const t = useT();
  const { push } = useToast();
  const router = useRouter();
  const cloud = useCloud();
  const [session, setSession] = useSession();
  const [users, setUsers] = useStoredCollection(KEYS.users, seedUsers);
  const { forUser, upsert } = useProviderApplications();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [category, setCategory] = useState<ProviderCategoryId | "">("");
  const [trainee, setTrainee] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const cloudMode = isCloudEnabled;

  function validate(): boolean {
    const next: Record<string, string | null> = {};
    if (!fullName.trim()) next.fullName = t("pr_err_name", "Enter your full professional name.");

    const key = email.trim().toLowerCase();
    if (!key) next.email = t("pr_err_email", "Enter your email address.");
    else if (!EMAIL_PATTERN.test(key))
      next.email = t("pr_err_email_bad", "That email address does not look right.");

    if (password.length < 8)
      next.password = t("pr_err_pw_short", "Password must be at least 8 characters.");
    if (confirm !== password)
      next.confirm = t("pr_err_pw_match", "The two passwords do not match.");
    if (!category) next.category = t("pr_err_category", "Choose your professional category.");
    if (!acceptedTerms || !acceptedPrivacy)
      next.consent = t("pr_err_consent", "Accept the Terms of Service and Privacy Policy to continue.");

    setErrors(next);
    return Object.values(next).every((v) => !v);
  }

  async function submit() {
    setFormError(null);
    if (!validate()) return;
    setPending(true);

    const key = email.trim().toLowerCase();
    const existing = users.find((u) => u.email.toLowerCase() === key);

    try {
      if (existing) {
        // Scenario D: never create a second account for the same address.
        push(t("pr_existing_title", "You already have a CareNBuddi account"), "info");
        router.push(`/auth/sign-in?email=${encodeURIComponent(key)}`);
        return;
      }

      let userId: string;

      if (cloudMode) {
        const { needsConfirmation } = await cloud.signUp(email, password, {
          name: fullName.trim(),
          phone: phone.trim(),
          role: "provider",
          lang: session.lang,
        });
        if (needsConfirmation) {
          // Scenario A: the account exists but the session is not established
          // yet. Say so and send them to the verification screen rather than
          // silently bouncing to sign-in.
          push(t("auth_check_email", "Check your email to confirm your account"), "info");
          router.push("/auth/verify");
          return;
        }
        userId = uid();
      } else {
        const user: User = {
          id: uid(),
          name: fullName.trim(),
          email: key,
          phone: phone.trim() || undefined,
          role: "provider",
          lang: session.lang,
          createdAt: new Date().toISOString(),
        };
        setUsers((prev) => [...prev, user]);
        userId = user.id;
      }

      // Establish the session so the rest of the journey is authenticated, and
      // resume rather than duplicate if an application already exists.
      setSession((prev) => ({ ...prev, userId }));
      const now = new Date().toISOString();
      const existingApp = forUser(userId);
      upsert({
        ...(existingApp ?? newApplication({ id: uid(), userId, email: key })),
        fullName: fullName.trim(),
        phone: phone.trim(),
        category,
        trainee,
        acceptedTerms,
        acceptedPrivacy,
        updatedAt: now,
      });

      push(t("pr_account_created", "Account created"), "success");
      router.push("/provider/onboarding?step=welcome");
    } catch (error) {
      // Scenario C: the account may or may not have been created. Say what is
      // true and let them retry rather than discarding anything.
      setFormError(
        error instanceof Error
          ? error.message
          : t("pr_signup_failed", "We could not create that account. Please try again."),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Screen>
      <Link
        href="/auth/sign-up/role"
        className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-slate-500"
      >
        <ChevronLeftIcon className="h-4 w-4" />
        {t("pr_back", "Back")}
      </Link>

      <div className="mt-1">
        <AuthIntro
          icon={<StethoscopeIcon className="h-6 w-6" />}
          title={t("pr_title", "Create your provider account")}
          subtitle={t(
            "pr_lead",
            "Create your account to apply as a healthcare professional. You will complete your professional profile and verification after this step.",
          )}
        />
      </div>

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="mt-6 space-y-4"
      >
        <Card className="space-y-4">
          <SectionHeader
            title={t("pr_account_section", "Account")}
            subtitle={t("pr_account_section_d", "How you will sign in to CareNBuddi.")}
          />

          <AuthField
            label={t("a_name", "Full name")}
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={errors.fullName}
          />
          <AuthField
            label={t("a_email", "Email")}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />
          <AuthField
            label={t("auth_phone_label", "Phone (optional)")}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+234 …"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <AuthField
            label={t("a_password", "Password")}
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            hint={t("auth_password_hint", "At least 8 characters")}
          />
          <AuthField
            label={t("auth_confirm_label", "Confirm password")}
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={errors.confirm}
          />
        </Card>

        <Card className="space-y-4">
          <SectionHeader
            title={t("pr_prof_section", "Professional category")}
            subtitle={t(
              "pr_prof_section_d",
              "This decides which credentials and registration details we ask you for.",
            )}
          />

          <Field label={t("prg_category", "Category")} error={errors.category}>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ProviderCategoryId | "")}
              className={inputClass}
            >
              <option value="">{t("pr_pick_category", "Select your category")}</option>
              {PROVIDER_CATEGORIES_DETAIL.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>

          {category && !PROVIDER_CATEGORIES_DETAIL.find((c) => c.id === category)?.requiresLicence ? (
            <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-600">
              {t(
                "pr_no_licence_note",
                "This category does not require a professional licence. You will be asked for your qualifications and awarding institution instead.",
              )}
            </p>
          ) : null}

          {category && PROVIDER_CATEGORIES_DETAIL.find((c) => c.id === category)?.allowsTrainees ? (
            <label className="flex min-h-11 items-center gap-2.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={trainee}
                onChange={(e) => setTrainee(e.target.checked)}
                className="h-5 w-5 rounded border-slate-300"
              />
              {t("pr_trainee", "I am a student or trainee, not yet fully registered")}
            </label>
          ) : null}
        </Card>

        <Card className="space-y-3">
          <label className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-600">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-slate-300"
            />
            <span>
              {t("pr_terms", "I agree to the")}{" "}
              <Link href="/terms" className="font-semibold text-brand-700 underline">
                {t("a_terms", "Terms of Service")}
              </Link>
            </span>
          </label>
          <label className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-600">
            <input
              type="checkbox"
              checked={acceptedPrivacy}
              onChange={(e) => setAcceptedPrivacy(e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-slate-300"
            />
            <span>
              {t("pr_privacy", "I agree to the")}{" "}
              <Link href="/privacy" className="font-semibold text-brand-700 underline">
                {t("a_privacy", "Privacy Policy")}
              </Link>
            </span>
          </label>
          {errors.consent ? <AuthError>{errors.consent}</AuthError> : null}
        </Card>

        {formError ? <AuthError>{formError}</AuthError> : null}

        <AuthSubmit pending={pending} pendingLabel={t("auth_creating", "Creating…")}>
          {t("pr_submit", "Create account and continue")}
        </AuthSubmit>

        {!cloudMode && <OfflineNote />}

        <AuthSwitch
          question={t("auth_have_account", "Already have an account?")}
          actionLabel={t("a_signin", "Sign in")}
          href="/auth/sign-in"
        />
        <p className="text-center text-xs leading-relaxed text-slate-500">
          <Link href="/support" className="tap font-semibold text-brand-700 underline">
            {t("prof_help", "Help & Support")}
          </Link>
        </p>
      </form>
    </Screen>
  );
}