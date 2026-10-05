"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthError, AuthField, AuthIntro, AuthSubmit, AuthSuccess, OfflineNote } from "@/components/auth-form";
import { Card, useToast } from "@/components/app-ui";
import { LockIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { getSupabase, isCloudEnabled } from "@/lib/supabase/client";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function ForgotPasswordPage() {
  const t = useT();
  const { push } = useToast();

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  const cloudMode = isCloudEnabled;

  const submit = async () => {
    setFormError(null);
    setSent(false);
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError(t("auth_err_email_required", "Enter your email address."));
      return;
    }
    if (!EMAIL_PATTERN.test(trimmed)) {
      setEmailError(t("auth_err_email_invalid", "That email address does not look right."));
      return;
    }
    setEmailError(null);

    if (!cloudMode) {
      setFormError(
        t(
          "auth_reset_offline",
          "Password reset needs a HealthLink cloud account. In offline preview no password is checked.",
        ),
      );
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setFormError(
        t(
          "auth_reset_unconfigured",
          "Email delivery is not configured yet. Use Account & sync to finish setting up your account.",
        ),
      );
      return;
    }

    setPending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: `${window.location.origin}/auth/sign-in`,
      });
      if (error) {
        setFormError(error.message);
        return;
      }
      setSent(true);
      push(t("auth_reset_sent", "Reset link sent"), "success");
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : t("auth_reset_failed", "We could not send that email. Try again in a moment."),
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="animate-fade-rise mx-auto flex min-h-full w-full max-w-md flex-col px-4 pb-6 pt-6">
      <AuthIntro
        icon={<LockIcon className="h-6 w-6" />}
        title={t("auth_reset_title", "Reset your password")}
        subtitle={t(
          "auth_reset_sub",
          "Enter the email on your account and we will send you a link to choose a new password.",
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

          {formError && <AuthError>{formError}</AuthError>}
          {sent && (
            <AuthSuccess>
              {t("auth_reset_sent_d", "If that address has an account, the reset link is on its way.")}
            </AuthSuccess>
          )}

          <AuthSubmit pending={pending} pendingLabel={t("auth_resend_in", "Sending…")}>
            {t("auth_reset_cta", "Send reset link")}
          </AuthSubmit>
        </Card>

        {!cloudMode && <OfflineNote />}

        <Link
          href="/auth/sign-in"
          className="tap flex min-h-11 w-full items-center justify-center text-xs font-semibold text-brand-700"
        >
          {t("auth_back_signin", "Back to sign in")}
        </Link>
      </form>
    </div>
  );
}
