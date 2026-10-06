"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AuthError, AuthField, AuthIntro, AuthSubmit, AuthSuccess, OfflineNote } from "@/components/auth-form";
import { Button, Card, useToast } from "@/components/app-ui";
import { LockIcon, CheckIcon } from "@/components/icons";
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
  const [resendCooldown, setResendCooldown] = useState(0);

  const cloudMode = isCloudEnabled;

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((n) => Math.max(0, n - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

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
          "Password reset needs a CareNBuddi cloud account. In offline preview no password is checked.",
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
      setResendCooldown(60);
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

  const resend = async () => {
    setFormError(null);
    const trimmed = email.trim();
    if (!trimmed || resendCooldown > 0) return;

    if (!cloudMode) {
      push(t("auth_resend_demo", "In offline preview no code is actually sent."), "info");
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
      setResendCooldown(60);
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
            <div className="flex items-start gap-2 rounded-xl bg-green-50 px-3 py-2.5 text-xs font-medium leading-relaxed text-green-800">
              <CheckIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <p className="font-semibold">{t("auth_reset_sent", "Reset link sent")}</p>
                <p>{t("auth_reset_sent_d", "If that address has an account, the reset link is on its way.")}</p>
              </span>
            </div>
          )}

          <AuthSubmit pending={pending} pendingLabel={t("auth_resend_in", "Sending…")}>
            {sent ? t("auth_reset_cta_resend", "Resend reset link") : t("auth_reset_cta", "Send reset link")}
          </AuthSubmit>

          {sent && resendCooldown > 0 && (
            <Button
              tone="ghost"
              full
              onClick={() => void resend()}
              disabled={resendCooldown > 0 || pending}
            >
              {t("auth_resend_in", `Resend in ${resendCooldown}s`)}
            </Button>
          )}
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