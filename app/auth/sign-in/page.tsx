"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthError, AuthField, AuthIntro, AuthSubmit, AuthSwitch, OfflineNote } from "@/components/auth-form";
import { Card, useToast } from "@/components/app-ui";
import { LockIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { isCloudEnabled } from "@/lib/supabase/client";
import { useCloud } from "@/lib/supabase/cloud";
import { KEYS, seedUsers, useSession, useStoredCollection } from "@/lib/storage";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function SignInPage() {
  const t = useT();
  const { push } = useToast();
  const router = useRouter();
  const cloud = useCloud();
  const [, setSession] = useSession();
  const [users] = useStoredCollection(KEYS.users, seedUsers);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const cloudMode = isCloudEnabled;

  const validate = (): boolean => {
    const nextEmail = email.trim();
    let ok = true;

    if (!nextEmail) {
      setEmailError(t("auth_err_email_required", "Enter your email address."));
      ok = false;
    } else if (!EMAIL_PATTERN.test(nextEmail)) {
      setEmailError(t("auth_err_email_invalid", "That email address does not look right."));
      ok = false;
    } else {
      setEmailError(null);
    }

    if (!password) {
      setPasswordError(t("auth_err_password_required", "Enter your password."));
      ok = false;
    } else if (password.length < 8) {
      setPasswordError(t("auth_err_password_short", "Password must be at least 8 characters."));
      ok = false;
    } else {
      setPasswordError(null);
    }

    return ok;
  };

  const signInOffline = (): boolean => {
    const key = email.trim().toLowerCase();
    const existing = users.find((u) => u.email.toLowerCase() === key);
    if (!existing) {
      setFormError(
        t(
          "auth_signin_no_account",
          "No offline account uses that email yet. Create an account first.",
        ),
      );
      return false;
    }
    setSession((prev) => ({ ...prev, userId: existing.id }));
    return true;
  };

  const submit = async () => {
    setFormError(null);
    if (!validate()) return;
    setPending(true);
    try {
      if (cloudMode) {
        await cloud.signIn(email, password);
      } else if (!signInOffline()) {
        return;
      }
      push(t("auth_signed_in", "You are signed in"), "success");
      router.push("/app");
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : t("a_bad_login", "Email or password is incorrect."),
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="animate-fade-rise mx-auto flex min-h-full w-full max-w-md flex-col px-4 pb-6 pt-6">
      <AuthIntro
        icon={<LockIcon className="h-6 w-6" />}
        title={t("auth_signin_title", "Welcome back")}
        subtitle={t(
          "auth_signin_sub",
          "Sign in to see your bookings, records and passport on this device.",
        )}
      />

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="mt-6 space-y-4"
      >
        <Card className="space-y-4">
          <AuthField
            label={t("a_email", "Email")}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={t("a_email_ph", "you@example.com")}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={emailError}
          />

          <AuthField
            label={t("a_password", "Password")}
            type="password"
            autoComplete="current-password"
            placeholder={t("auth_password_ph", "••••••••")}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={passwordError}
            hint={t("auth_password_hint", "At least 8 characters")}
          />

          <Link
            href="/auth/forgot-password"
            className="tap -mt-1 flex min-h-11 items-center justify-end text-xs font-semibold text-brand-700"
          >
            {t("auth_forgot", "Forgot password?")}
          </Link>

          {formError && <AuthError>{formError}</AuthError>}

          <AuthSubmit
            pending={pending}
            pendingLabel={t("a_syncing", "Syncing…")}
          >
            {t("a_signin", "Sign in")}
          </AuthSubmit>
        </Card>

        {!cloudMode && <OfflineNote />}

        <AuthSwitch
          question={t("auth_no_account", "New to HealthLink?")}
          actionLabel={t("a_signup", "Create account")}
          href="/auth/sign-up"
        />
        <AuthSwitch
          question={t("auth_demo_link", "Just browsing?")}
          actionLabel={t("gate_continue_guest", "Continue as guest")}
          href="/app"
        />
      </form>
    </div>
  );
}
