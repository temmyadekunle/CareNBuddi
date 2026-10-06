"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  AuthError,
  AuthField,
  AuthIntro,
  AuthSubmit,
  AuthSwitch,
  OfflineNote,
  SocialLoginButtons,
  writeAuthPending,
} from "@/components/auth-form";
import { Card, Segmented, useToast } from "@/components/app-ui";
import { UserIcon } from "@/components/icons";
import { useT } from "@/lib/i18n";
import { isCloudEnabled } from "@/lib/supabase/client";
import { useCloud } from "@/lib/supabase/cloud";
import { KEYS, seedUsers, uid, useSession, useStoredCollection } from "@/lib/storage";
import type { Role, User } from "@/lib/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+?[\d][\d\s()-]{6,19}$/;

type SignupRole = Extract<Role, "consumer" | "provider">;

export default function SignUpPage() {
  const t = useT();
  const { push } = useToast();
  const router = useRouter();
  const cloud = useCloud();
  const [session, setSession] = useSession();
  const [users, setUsers] = useStoredCollection(KEYS.users, seedUsers);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<SignupRole>("consumer");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const cloudMode = isCloudEnabled;

  const validate = (): boolean => {
    let ok = true;

    if (!name.trim()) {
      setNameError(t("auth_err_name_required", "Enter your full name."));
      ok = false;
    } else {
      setNameError(null);
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailError(t("auth_err_email_required", "Enter your email address."));
      ok = false;
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setEmailError(t("auth_err_email_invalid", "That email address does not look right."));
      ok = false;
    } else {
      setEmailError(null);
    }

    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      setPhoneError(null);
    } else if (!PHONE_PATTERN.test(trimmedPhone)) {
      setPhoneError(t("auth_err_phone_invalid", "Enter a valid phone number, e.g. +234 800 000 0000."));
      ok = false;
    } else {
      setPhoneError(null);
    }

    if (!password) {
      setPasswordError(t("auth_err_password_required", "Choose a password."));
      ok = false;
    } else if (password.length < 8) {
      setPasswordError(t("auth_err_password_short", "Password must be at least 8 characters."));
      ok = false;
    } else {
      setPasswordError(null);
    }

    if (confirm !== password) {
      setConfirmError(t("auth_err_confirm_mismatch", "The two passwords do not match."));
      ok = false;
    } else {
      setConfirmError(null);
    }

    return ok;
  };

  const signUpOffline = (): boolean => {
    const key = email.trim().toLowerCase();
    const existing = users.find((u) => u.email.toLowerCase() === key);
    const trimmedPhone = phone.trim();

    if (existing) {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === existing.id ? { ...u, phone: u.phone ?? (trimmedPhone || undefined) } : u,
        ),
      );
      setSession((prev) => ({ ...prev, userId: existing.id }));
      return true;
    }

    const user: User = {
      id: uid(),
      name: name.trim(),
      email: key,
      phone: trimmedPhone || undefined,
      role,
      lang: session.lang,
      createdAt: new Date().toISOString(),
    };
    setUsers((prev) => [...prev, user]);
    setSession((prev) => ({ ...prev, userId: user.id }));
    return false;
  };

  const submit = async () => {
    setFormError(null);
    if (!validate()) return;
    setPending(true);
    try {
      if (cloudMode) {
        const { needsConfirmation } = await cloud.signUp(email, password, {
          name: name.trim(),
          phone: phone.trim(),
          role,
          lang: session.lang,
        });
        if (needsConfirmation) {
          writeAuthPending(email.trim());
          push(t("auth_check_email", "Check your email to confirm your account"), "info");
          router.push("/auth/verify");
        } else {
          push(t("auth_account_created", "Account created"), "success");
          router.push("/app");
        }
      } else {
        const alreadyRegistered = signUpOffline();
        push(
          alreadyRegistered
            ? t("auth_signed_in", "You are signed in")
            : t("auth_account_created", "Account created"),
          "success",
        );
        router.push("/app");
      }
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : t("auth_signup_failed", "We could not create that account."),
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="animate-fade-rise mx-auto flex min-h-full w-full max-w-md flex-col px-4 pb-6 pt-6">
      <AuthIntro
        icon={<UserIcon className="h-6 w-6" />}
        title={t("auth_signup_title", "Create your account")}
        subtitle={t(
          "auth_signup_sub",
          "One account keeps your bookings and health records together. It is optional — you can browse as a guest.",
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
            label={t("a_name", "Full name")}
            type="text"
            autoComplete="name"
            autoCapitalize="words"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={nameError}
          />

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
            label={t("auth_phone_label", "Phone (optional)")}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder={t("prof_phone_ph", "+234 ...")}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            error={phoneError}
            hint={t("auth_phone_hint", "Used by providers to confirm a visit")}
          />

          <div>
            <p className="text-xs font-semibold text-slate-600">{t("a_role", "I am a")}</p>
            <div className="mt-1.5">
              <Segmented<SignupRole>
                options={[
                  { value: "consumer", label: t("auth_role_patient", "Patient") },
                  { value: "provider", label: t("a_provider", "Healthcare provider") },
                ]}
                value={role}
                onChange={setRole}
              />
            </div>
          </div>

          <AuthField
            label={t("a_password", "Password")}
            type="password"
            autoComplete="new-password"
            placeholder={t("auth_password_ph", "••••••••")}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={passwordError}
            hint={t("auth_password_hint", "At least 8 characters")}
          />

          <AuthField
            label={t("auth_confirm_label", "Confirm password")}
            type="password"
            autoComplete="new-password"
            placeholder={t("auth_password_ph", "••••••••")}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            error={confirmError}
          />

          {formError && <AuthError>{formError}</AuthError>}

          <AuthSubmit pending={pending} pendingLabel={t("auth_creating", "Creating…")}>
            {t("a_signup", "Create account")}
          </AuthSubmit>

          {cloudMode && <SocialLoginButtons />}

        </Card>

        {!cloudMode && <OfflineNote />}

        <AuthSwitch
          question={t("auth_have_account", "Already have an account?")}
          actionLabel={t("a_signin", "Sign in")}
          href="/auth/sign-in"
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
