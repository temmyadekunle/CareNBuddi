"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import { useCloud } from "@/lib/supabase/cloud";
import { GoogleIcon, AppleIcon } from "@/components/icons";
import type { Role } from "@/lib/types";

/**
 * Real accounts backed by Supabase. When the project is not configured the app
 * stays in offline preview mode and this panel is simply not rendered.
 */
export function CloudAccount() {
  const t = useT();
  const { ready, user, profile, syncState, lastSyncedAt, signIn, signUp, signOut, sync, signInWithGoogle, signInWithApple } = useCloud();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("consumer");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async () => {
    setProblem(null);
    setMessage(null);
    if (!email.trim() || password.length < 8) {
      setProblem(t("a_missing_fields"));
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { needsConfirmation } = await signUp(email, password, {
          name: name.trim() || "CareNBuddi Member",
          phone: phone.trim(),
          role,
          lang: "en",
        });
        setMessage(needsConfirmation ? t("a_confirm_email") : t("a_syncing"));
      } else {
        await signIn(email, password);
      }
    } catch (e) {
      setProblem(e instanceof Error ? e.message : t("a_bad_login"));
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">{t("a_syncing")}</p>
      </section>
    );
  }

  if (user) {
    return (
      <section className="mt-6 rounded-2xl border border-brand-200 bg-brand-50/60 p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
          {t("a_signed_in_as")}
        </p>
        <p className="mt-1 text-lg font-semibold text-slate-900">{user.email}</p>
        <p className="mt-1 text-xs text-slate-600">
          {t("a_role")}: {profile?.role ?? "consumer"}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
            <Dot state={syncState} />
            {statusText(t, syncState)}
          </span>
          <button
            onClick={() => void sync()}
            disabled={syncState === "syncing"}
            className="rounded-xl border border-brand-700 bg-white px-4 py-2 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50 disabled:opacity-60"
          >
            {t("a_sync_now")}
          </button>
          <button
            onClick={() => void signOut()}
            className="rounded-xl bg-brand-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
          >
            {t("a_signout")}
          </button>
        </div>

        {lastSyncedAt && (
          <p className="mt-3 text-xs text-slate-500">
            {new Date(lastSyncedAt).toLocaleTimeString()}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">{t("a_cloud")}</h2>
      <p className="mt-1 text-xs text-slate-500">{t("a_cloud_d")}</p>

      <div className="mt-4 flex gap-1.5">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === m
                ? "bg-brand-700 text-white"
                : "border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {m === "signin" ? t("a_signin") : t("a_signup")}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {mode === "signup" && (
          <Field label={t("a_name")}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </Field>
        )}
        <Field label={t("a_email")}>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className={inputClass}
          />
        </Field>
        {mode === "signup" && (
          <Field label={t("a_phone")}>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+234 ..."
              className={inputClass}
            />
          </Field>
        )}
        {mode === "signup" && (
          <Field label={t("a_role")}>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className={inputClass}
            >
              <option value="consumer">{t("a_consumer")}</option>
              <option value="provider">{t("a_provider")}</option>
            </select>
          </Field>
        )}
        <Field label={t("a_password")}>
          <input
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={inputClass}
          />
        </Field>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wider text-slate-400">
            <span className="bg-white px-2">{t("auth_or")}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <GoogleIcon className="h-5 w-5" />
            <span>{t("auth_google")}</span>
          </button>
          <button
            type="button"
            onClick={() => void signInWithApple()}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <AppleIcon className="h-5 w-5" />
            <span>{t("auth_apple")}</span>
          </button>
        </div>
      </div>

      <button
        onClick={() => void submit()}
        disabled={busy}
        className="mt-4 w-full rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-60"
      >
        {busy ? t("a_syncing") : mode === "signin" ? t("a_signin") : t("a_signup")}
      </button>

      {problem && <p className="mt-3 text-xs text-rose-600">{problem}</p>}
      {message && <p className="mt-3 text-xs text-brand-700">{message}</p>}
    </section>
  );
}

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function Dot({ state }: { state: string }) {
  const colour =
    state === "synced" ? "bg-emerald-500" : state === "syncing" ? "bg-amber-400" : state === "error" ? "bg-rose-500" : "bg-slate-300";
  return <span className={`h-2 w-2 rounded-full ${colour}`} />;
}

function statusText(t: (k: string) => string, state: string): string {
  if (state === "syncing") return t("a_syncing");
  if (state === "synced") return t("a_synced");
  if (state === "error") return t("a_bad_login");
  return t("a_sync_idle");
}