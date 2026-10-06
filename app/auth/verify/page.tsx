"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  AuthError,
  AuthIntro,
  AuthSuccess,
  clearAuthPending,
  emptyOtp,
  isOtpComplete,
  OfflineNote,
  OtpInput,
  readAuthPending,
} from "@/components/auth-form";
import { Button, Card, Field, inputClass, useToast } from "@/components/app-ui";
import { ShieldIcon, CheckIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { getSupabase, isCloudEnabled } from "@/lib/supabase/client";
import { Suspense } from "react";

const RESEND_COOLDOWN_SECONDS = 30;

function subscribeToPendingEmail(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function VerifyContent() {
  const t = useT();
  const { push } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const storedEmail = useSyncExternalStore(
    subscribeToPendingEmail,
    () => readAuthPending()?.email ?? "",
    () => "",
  );
  const [typedEmail, setTypedEmail] = useState<string | null>(null);
  const email = typedEmail ?? storedEmail;

  const [code, setCode] = useState<string[]>(emptyOtp);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [pending, setPending] = useState(false);
  const [verified, setVerified] = useState(false);

  const cloudMode = isCloudEnabled;

  // Check for email in URL params on mount
  useEffect(() => {
    const emailFromUrl = searchParams.get("email");
    if (emailFromUrl) {
      setTypedEmail(emailFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const requireEmail = (): string | null => {
    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError(t("auth_verify_no_email", "We do not know which address to confirm yet."));
      return null;
    }
    setEmailError(null);
    return trimmed;
  };

  const continueOffline = () => {
    clearAuthPending();
    push(t("auth_confirmed", "Email confirmed"), "success");
    router.push("/app");
  };

  const confirm = async () => {
    setFormError(null);
    setNotice(null);
    const trimmed = requireEmail();
    if (!trimmed) return;

    if (!cloudMode) {
      continueOffline();
      return;
    }

    if (!isOtpComplete(code)) {
      setFormError(t("auth_verify_short", "Enter the 6-digit code from your email."));
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
      const { error } = await supabase.auth.verifyOtp({
        email: trimmed,
        token: code.join(""),
        type: "email",
      });
      if (error) {
        setFormError(error.message);
        return;
      }
      clearAuthPending();
      push(t("auth_confirmed", "Email confirmed"), "success");
      setVerified(true);
      // Auto-redirect after showing success
      setTimeout(() => router.push("/app"), 1500);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : t("auth_verify_failed", "That code did not work."),
      );
    } finally {
      setPending(false);
    }
  };

  const resend = async () => {
    setFormError(null);
    setNotice(null);
    setCooldown(RESEND_COOLDOWN_SECONDS);
    const trimmed = requireEmail();
    if (!trimmed) return;

    if (!cloudMode) {
      setNotice(t("auth_resent_demo", "In offline preview no code is actually sent."));
      return;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setNotice(
        t(
          "auth_reset_unconfigured",
          "Email delivery is not configured yet. Use Account & sync to finish setting up your account.",
        ),
      );
      return;
    }

    setPending(true);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: trimmed });
      if (error) {
        setFormError(error.message);
        return;
      }
      setNotice(t("auth_resent", "We sent a new code. Check your inbox."));
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : t("auth_resend_failed", "We could not resend the code."),
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="animate-fade-rise mx-auto flex min-h-full w-full max-w-md flex-col px-4 pb-6 pt-6">
      {verified ? (
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckIcon className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="mt-4 text-[22px] font-bold leading-tight tracking-tight text-slate-900">
            {t("auth_confirmed", "Email confirmed")}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {t("auth_verified_redirect", "Redirecting you to CareNBuddi…")}
          </p>
        </div>
      ) : (
        <>
          <AuthIntro
            icon={<ShieldIcon className="h-6 w-6" />}
            title={t("auth_verify_title", "Confirm your email")}
            subtitle={
              cloudMode
                ? t(
                    "auth_verify_sub",
                    "We sent a confirmation link and a 6-digit code to your inbox. Open the link, or type the code below.",
                  )
                : t(
                    "auth_verify_sub_off",
                    "Nothing was actually emailed in offline preview. Continue when you are ready.",
                  )
            }
          />

          <div className="mt-6 space-y-4">
            <Card className="space-y-4">
              <Field label={t("auth_email_label", "Email address")} error={emailError}>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={t("a_email_ph", "you@example.com")}
                  value={email}
                  onChange={(event) => setTypedEmail(event.target.value)}
                  className={`${inputClass} min-h-11`}
                />
              </Field>

              {cloudMode && (
                <>
                  <div>
                    <p className="text-xs font-semibold text-slate-600">
                      {t("a_code", "6-digit code")}
                    </p>
                    <div className="mt-1.5">
                      <OtpInput
                        value={code}
                        onChange={setCode}
                        disabled={pending}
                        label={t("auth_code_label", "Confirmation code")}
                      />
                    </div>
                  </div>

                  {notice && <AuthSuccess>{notice}</AuthSuccess>}
                  {formError && <AuthError>{formError}</AuthError>}

                  <Button full onClick={() => void confirm()} disabled={pending}>
                    {pending ? t("a_syncing", "Syncing…") : t("a_verify", "Verify and continue")}
                  </Button>

                  <Button
                    tone="ghost"
                    full
                    onClick={() => void resend()}
                    disabled={cooldown > 0 || pending}
                  >
                    {cooldown > 0
                      ? t("auth_resend_in", `Resend code in ${cooldown}s`)
                      : t("auth_resend", "Resend code")}
                  </Button>

                  <p className="text-center text-[11px] leading-relaxed text-slate-400">
                    {t("auth_verify_hint", "Already confirmed? Sign in with your email and password.")}
                  </p>
                </>
              )}

              {!cloudMode && (
                <>
                  <OfflineNote />
                  {notice && <AuthSuccess>{notice}</AuthSuccess>}
                  {formError && <AuthError>{formError}</AuthError>}
                  <Button full onClick={continueOffline}>
                    {t("auth_verify_continue", "Continue to CareNBuddi")}
                  </Button>
                  <Button tone="ghost" full onClick={() => void resend()} disabled={cooldown > 0}>
                    {cooldown > 0
                      ? t("auth_resend_in", `Resend code in ${cooldown}s`)
                      : t("auth_resend", "Resend code")}
                  </Button>
                </>
              )}
            </Card>

            <Link
              href="/auth/sign-in"
              className="tap flex min-h-11 items-center justify-center text-xs font-semibold text-brand-700"
            >
              {t("auth_back_signin", "Back to sign in")}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="animate-fade-rise mx-auto flex min-h-full w-full max-w-md flex-col px-4 pb-6 pt-6" />}>
      <VerifyContent />
    </Suspense>
  );
}