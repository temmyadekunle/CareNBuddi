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
  PasswordField,
  writeAuthPending,
} from "@/components/auth-form";
import { Button, Card, Field, Screen, SectionHeader, inputClass, useToast } from "@/components/app-ui";
import { ChevronLeftIcon, StethoscopeIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import {
  PROVIDER_APPLICATIONS_KEY,
  PROVIDER_CATEGORIES_DETAIL,
  newApplication,
  type ProviderApplication,
  type ProviderCategoryId,
} from "@/lib/provider-application";
import { providerRegisterEntry } from "@/lib/post-auth";
import {
  KEYS,
  readCollectionForUser,
  seedUsers,
  uid,
  useSession,
  useStoredCollection,
  writeCollectionForUser,
} from "@/lib/storage";
import { isCloudEnabled } from "@/lib/supabase/client";
import { useCloud } from "@/lib/supabase/cloud";
import { useProviderApplications } from "@/lib/use-provider-application";
import type { User } from "@/lib/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Form order, used to list errors and focus the first one. */
const ERROR_FIELD_ORDER = ["fullName", "email", "password", "confirm", "category", "consent"] as const;
type ErrorField = (typeof ERROR_FIELD_ORDER)[number];

const FIELD_IDS: Record<Exclude<ErrorField, "consent">, string> = {
  fullName: "provider-register-name",
  email: "provider-register-email",
  password: "provider-register-password",
  confirm: "provider-register-confirm",
  category: "provider-register-category",
};

/**
 * Create Account as Health Provider — and resume, when there is already an
 * application.
 *
 * This screen has four jobs, decided by `providerRegisterEntry`, and getting
 * them right is what stops anyone applying twice:
 *
 *   - an account with an application  → send them back to it
 *   - a signed-in account with none   → skip the form, start onboarding
 *   - an email that already exists    → sign in on that same account first
 *   - a genuinely new email           → create the account
 *
 * Account creation mirrors /auth/sign-up rather than inventing a second system,
 * and it never marks anybody verified: a new account gets a draft application.
 */
export default function ProviderRegisterPage() {
  const t = useT();
  const { push } = useToast();
  const router = useRouter();
  const cloud = useCloud();
  const [session, setSession] = useSession();
  const [users, setUsers] = useStoredCollection(KEYS.users, seedUsers);
  const { forUser, upsert } = useProviderApplications();

  const account = users.find((u) => u.id === session.userId) ?? null;
  const application = forUser(session.userId);

  const [fullName, setFullName] = useState(account?.name ?? "");
  const [email, setEmail] = useState(account?.email ?? "");
  const [phone, setPhone] = useState(account?.phone ?? "");
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

  const errorLabels: Record<ErrorField, string> = {
    fullName: t("a_name", "Full name"),
    email: t("a_email", "Email"),
    password: t("a_password", "Password"),
    confirm: t("auth_confirm_label", "Confirm password"),
    category: t("prg_category", "Category"),
    consent: t("pr_consent_label", "Terms and privacy"),
  };

  const fieldErrors = ERROR_FIELD_ORDER.filter((key) => errors[key]).map((key) => ({
    key,
    label: errorLabels[key],
    message: errors[key] as string,
  }));

  /* The two signed-in cases are decided by the same tested helper the rest of
     the app uses, so "do I already have an application?" is answered in one
     place. `emailExists` only matters while signed out, and is checked on
     submit instead. */
  const entry = providerRegisterEntry({ account, application, emailExists: false });

  /* Already have an application — do not offer a second form. */
  if (entry.action === "resume") {
    return (
      <Screen>
        <SectionHeader
          title={t("pr_already_title", "You already have an application")}
          subtitle={t(
            "pr_already_d",
            "We are not going to ask you twice. Pick up where you left off.",
          )}
        />
        <Link href={entry.path} className="tap mt-4 inline-block">
          <Button>{t("pr_resume", "Continue my application")}</Button>
        </Link>
      </Screen>
    );
  }

  /* Signed in but never applied: the account already exists, so skip the
     account form. A patient upgrading keeps everything they already have —
     we add the provider role to this same account rather than creating one. */
  if (account) {
    const isPatient = account.role === "consumer";
    return (
      <Screen>
        <SectionHeader
          title={t("pr_start_title", "Apply as a healthcare professional")}
          subtitle={
            isPatient
              ? t(
                  "pr_start_patient",
                  "You are signed in. We will add the provider role to this account, so you keep your health records, bookings and Care Circle.",
                )
              : t(
                  "pr_start_d",
                  "You are signed in, so we will use this account. Next we will collect your professional details.",
                )
          }
        />
        <div className="mt-4 flex flex-col gap-2">
          <Button
            onClick={() => {
              if (isPatient) upgradeExistingAccount(account);
              router.push("/provider/onboarding");
            }}
          >
            {t("pr_begin", "Start your application")}
          </Button>
          <Link href="/app" className="tap text-center text-xs font-semibold text-slate-500 underline">
            {t("pr_stay_patient", "No thanks, keep using CareNBuddi as a patient")}
          </Link>
        </div>
      </Screen>
    );
  }

  /**
   * Keeps the provider's details on this device while the account is waiting
   * for email confirmation.
   *
   * The ordinary draft hook resolves storage through the current session, and
   * there is deliberately no session before confirmation. Writing through the
   * user id Supabase returned puts the draft in the namespace the confirmed
   * account will use, without signing anybody in early. Nothing is sent to the
   * server and no status is advanced.
   */
  function persistDraftForUser(userId: string) {
    const key = email.trim().toLowerCase();
    const stored = readCollectionForUser<ProviderApplication>(userId, PROVIDER_APPLICATIONS_KEY);
    const base =
      stored.find((app) => app.userId === userId) ??
      newApplication({ id: uid(), userId, email: key });
    const draft: ProviderApplication = {
      ...base,
      fullName: fullName.trim(),
      phone: phone.trim(),
      category,
      trainee,
      acceptedTerms,
      acceptedPrivacy,
      updatedAt: new Date().toISOString(),
    };
    const at = stored.findIndex((app) => app.userId === userId);
    const next = at === -1 ? [...stored, draft] : stored.map((app, i) => (i === at ? draft : app));
    writeCollectionForUser(userId, PROVIDER_APPLICATIONS_KEY, next);
  }

  function focusFirstError(next: Record<string, string | null>) {
    const first = ERROR_FIELD_ORDER.find((key) => next[key]);
    if (!first) return;
    const id =
      first === "consent"
        ? acceptedTerms
          ? "provider-register-privacy"
          : "provider-register-terms"
        : FIELD_IDS[first];
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.focus({ preventScroll: true });
  }

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
    const ok = Object.values(next).every((v) => !v);
    if (!ok) focusFirstError(next);
    return ok;
  }

  /** Adopt an existing account as a provider and start the application. */
  function upgradeExistingAccount(existing: User): string {
    const now = new Date().toISOString();
    const upgraded: User = {
      ...existing,
      role: "provider",
      phone: existing.phone ?? (phone.trim() || undefined),
    };
    setUsers((prev) => prev.map((u) => (u.id === existing.id ? upgraded : u)));
    setSession((prev) => ({ ...prev, userId: existing.id }));

    const carried = forUser(existing.id);
    upsert({
      ...(carried ?? newApplication({ id: uid(), userId: existing.id, email: existing.email })),
      fullName: fullName.trim() || existing.name,
      phone: upgraded.phone ?? "",
      category,
      trainee,
      acceptedTerms,
      acceptedPrivacy,
      updatedAt: now,
    });
    return existing.id;
  }

  async function submit() {
    setFormError(null);
    if (!cloudMode) {
      setFormError(
        t(
          "pr_signup_unavailable",
          "Provider account creation needs the CareNBuddi authentication service, which is not connected in this build. No account was created.",
        ),
      );
      return;
    }
    if (!validate()) return;
    setPending(true);

    const key = email.trim().toLowerCase();
    const existing = users.find((u) => u.email.toLowerCase() === key);

    try {
      if (existing) {
        // The address already has an account. Never make a second one, and
        // never hand the account over on the strength of an email address
        // alone — that would let anyone claim somebody else's account. Send
        // them to sign in on that account and come straight back here, where
        // the signed-in branch below performs the upgrade.
        push(t("pr_existing_title", "You already have a CareNBuddi account"), "info");
        router.push(
          `/auth/sign-in?next=${encodeURIComponent("/provider/register")}&email=${encodeURIComponent(key)}`,
        );
        return;
      }

      const {
        needsConfirmation,
        userId: signedUpUserId,
        existingAccount,
      } = await cloud.signUp(email, password, {
        name: fullName.trim(),
        phone: phone.trim(),
        role: "provider",
        lang: session.lang,
        // Carried into the confirmation email so the link lands back here.
        next: "/provider/onboarding",
      });

      if (needsConfirmation) {
        // No session yet: remember which address is waiting and keep the
        // details the person already typed. The draft is keyed by the real
        // Supabase id, and is skipped for an address that already has an
        // account, so nothing is written into somebody else's namespace.
        writeAuthPending(key);
        if (signedUpUserId && !existingAccount) persistDraftForUser(signedUpUserId);
        push(
          t(
            "auth_check_email",
            "If this address needs confirming, check your inbox.",
          ),
          "info",
        );
        router.push(
          `/auth/verify?email=${encodeURIComponent(key)}&next=${encodeURIComponent("/provider/onboarding")}`,
        );
        return;
      }

      if (!signedUpUserId) {
        // A session without a user id is not something to paper over with a
        // locally minted id; fail closed and let them sign in.
        setFormError(
          t(
            "pr_signup_no_session",
            "We could not find the new account. Sign in and continue your application.",
          ),
        );
        return;
      }

      const userId = signedUpUserId;
      persistDraftForUser(userId);

      // Establish the session so the rest of the journey is authenticated.
      setSession((prev) => ({ ...prev, userId }));

      push(t("pr_account_created", "Account created"), "success");
      router.push("/provider/onboarding?step=welcome");
    } catch (error) {
      // The account may or may not have been created. Say what is true and let
      // them retry rather than discarding anything. "Already registered" is
      // answered neutrally: it is only returned when confirmations are off,
      // and repeating it would confirm the address is in use.
      const message = error instanceof Error ? error.message : "";
      setFormError(
        /already registered/i.test(message)
          ? t(
              "auth_signup_try_signin",
              "We could not create that account. If you already have one, sign in instead.",
            )
          : message || t("pr_signup_failed", "We could not create that account. Please try again."),
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
        {fieldErrors.length > 0 && (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs leading-relaxed text-rose-700"
          >
            <p className="font-semibold">
              {t("auth_fix_errors", "Please fix the highlighted fields before continuing.")}
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {fieldErrors.map(({ key, label, message }) => (
                <li key={key}>
                  <span className="font-medium">{label}:</span> {message}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Card className="space-y-4">
          <SectionHeader
            title={t("pr_account_section", "Account")}
            subtitle={t("pr_account_section_d", "How you will sign in to CareNBuddi.")}
          />

          <AuthField
            id={FIELD_IDS.fullName}
            label={t("a_name", "Full name")}
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={errors.fullName}
            errorId={`${FIELD_IDS.fullName}-error`}
          />
          <AuthField
            id={FIELD_IDS.email}
            label={t("a_email", "Email")}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            errorId={`${FIELD_IDS.email}-error`}
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
          <PasswordField
            id={FIELD_IDS.password}
            label={t("a_password", "Password")}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            errorId={`${FIELD_IDS.password}-error`}
            hint={t("auth_password_hint", "At least 8 characters")}
          />
          <PasswordField
            id={FIELD_IDS.confirm}
            label={t("auth_confirm_label", "Confirm password")}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            error={errors.confirm}
            errorId={`${FIELD_IDS.confirm}-error`}
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

          <Field
            label={t("prg_category", "Category")}
            error={errors.category}
            errorId={`${FIELD_IDS.category}-error`}
          >
            <select
              id={FIELD_IDS.category}
              value={category}
              onChange={(e) => setCategory(e.target.value as ProviderCategoryId | "")}
              aria-invalid={errors.category ? true : undefined}
              aria-describedby={errors.category ? `${FIELD_IDS.category}-error` : undefined}
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
              id="provider-register-terms"
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              aria-invalid={errors.consent ? true : undefined}
              aria-describedby={errors.consent ? "provider-register-consent-error" : undefined}
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
              id="provider-register-privacy"
              type="checkbox"
              checked={acceptedPrivacy}
              onChange={(e) => setAcceptedPrivacy(e.target.checked)}
              aria-invalid={errors.consent ? true : undefined}
              aria-describedby={errors.consent ? "provider-register-consent-error" : undefined}
              className="mt-0.5 h-5 w-5 rounded border-slate-300"
            />
            <span>
              {t("pr_privacy", "I agree to the")}{" "}
              <Link href="/privacy" className="font-semibold text-brand-700 underline">
                {t("a_privacy", "Privacy Policy")}
              </Link>
            </span>
          </label>
          {errors.consent ? (
            <div id="provider-register-consent-error">
              <AuthError>{errors.consent}</AuthError>
            </div>
          ) : null}
        </Card>

        {formError ? <AuthError>{formError}</AuthError> : null}

        <AuthSubmit pending={pending} pendingLabel={t("auth_creating", "Creating…")}>
          {t("pr_submit", "Create account and continue")}
        </AuthSubmit>

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