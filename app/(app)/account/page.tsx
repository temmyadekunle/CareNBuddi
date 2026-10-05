"use client";

import Link from "next/link";
import { CloudAccount } from "@/components/cloud-account";
import {
  Badge,
  Button,
  Card,
  Field,
  Screen,
  SectionHeader,
  Tabs,
  inputClass,
  useToast,
} from "@/components/app-ui";
import { LanguageIcon, LockIcon, LogOutIcon, UserIcon } from "@/components/icons";
import { LangSwitcher } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { LANGS } from "@/lib/lang";
import { isCloudEnabled } from "@/lib/supabase/client";
import {
  KEYS,
  seedUsers,
  useSession,
  useStoredCollection,
  uid,
  type Session,
} from "@/lib/storage";
import type { Role, User } from "@/lib/types";
import { useState } from "react";

function randomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default function AccountPage() {
  const t = useT();
  const { push } = useToast();
  const [session, setSession] = useSession();
  const [users, setUsers] = useStoredCollection(KEYS.users, seedUsers);

  const me = users.find((u) => u.id === session.userId);

  const [mode, setMode] = useState<"signup" | "signin">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("consumer");
  const [sentCode, setSentCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const [createdUser, setCreatedUser] = useState<User | null>(null);

  const sendCode = () => {
    if (!email.trim()) {
      setNotice(t("a_enter_email", "Enter an email first."));
      return;
    }
    setSentCode(randomCode());
    setCode("");
    setNotice(t("a_code_sent", "Code sent"));
  };

  const finish = () => {
    if (!sentCode || code !== sentCode) {
      setNotice(t("a_code_mismatch", "The code does not match. Check and try again."));
      return;
    }
    const key = email.trim().toLowerCase();
    const existing = users.find((u) => u.email.toLowerCase() === key);
    if (existing) {
      setSession((prev: Session) => ({ ...prev, userId: existing.id, lang: prev.lang }));
      setCreatedUser(existing);
    } else {
      const user: User = {
        id: uid(),
        name: name.trim() || "HealthLink Member",
        email: key,
        phone: phone.trim() || undefined,
        role: mode === "signup" ? role : "consumer",
        lang: session.lang,
        createdAt: new Date().toISOString(),
      };
      setUsers((prev) => [...prev, user]);
      setSession((prev: Session) => ({ ...prev, userId: user.id, lang: prev.lang }));
      setCreatedUser(user);
    }
    setSentCode(null);
    setCode("");
    setNotice("");
    push(t("a_welcome", "Welcome"), "success");
  };

  const demo = (userId: string) => setSession((prev: Session) => ({ ...prev, userId, lang: prev.lang }));

  const signOut = () => {
    setSession((prev: Session) => ({ ...prev, userId: null }));
    setCreatedUser(null);
  };

  const active = me ?? createdUser;

  return (
    <Screen>
      <SectionHeader title={t("a_title", "Account")} subtitle={t("a_sub", "Sign in to keep your data together.")} />

      {isCloudEnabled ? (
        <div className="mt-3">
          <CloudAccount />
        </div>
      ) : (
        <Card className="mt-3 flex items-start gap-2 bg-slate-50">
          <LockIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
          <p className="text-xs text-slate-600">{t("a_sync_off", "Cloud sync is not configured on this build.")}</p>
        </Card>
      )}

      {active ? (
        <Card className="mt-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <UserIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{active.name}</p>
              <p className="truncate text-xs text-slate-500">{active.email}</p>
            </div>
            <Badge tone={active.role === "admin" ? "brand" : active.role === "provider" ? "green" : "slate"}>
              {active.role}
            </Badge>
          </div>
          <Button full tone="secondary" className="mt-4" onClick={signOut}>
            <LogOutIcon className="h-4 w-4" />
            {t("a_signout", "Sign out")}
          </Button>
        </Card>
      ) : (
        <>
          <Card className="mt-3">
            <Tabs
              value={mode}
              onChange={setMode}
              tabs={[
                { value: "signup", label: t("a_signup", "Create account") },
                { value: "signin", label: t("a_signin", "Sign in") },
              ]}
            />

            <div className="mt-3 space-y-3">
              {mode === "signup" && (
                <Field label={t("a_name", "Full name")}>
                  <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
                </Field>
              )}
              <Field label={t("a_email", "Email")}>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </Field>
              {mode === "signup" && (
                <>
                  <Field label={t("a_phone", "Phone")}>
                    <input
                      type="tel"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+234 …"
                      className={inputClass}
                    />
                  </Field>
                  <Field label={t("a_role", "I am a")}>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as Role)}
                      className={inputClass}
                    >
                      <option value="consumer">{t("a_consumer", "Consumer")}</option>
                      <option value="provider">{t("a_provider", "Provider")}</option>
                    </select>
                  </Field>
                </>
              )}
            </div>

            {sentCode && (
              <div className="mt-3 rounded-xl border border-brand-100 bg-brand-50 p-3 text-center">
                <p className="text-[11px] font-semibold text-brand-900">{t("a_code_sent", "Code sent")}</p>
                <p className="mt-1 font-mono text-2xl font-bold tracking-[0.3em] text-brand-700">{sentCode}</p>
              </div>
            )}

            {sentCode && (
              <div className="mt-3">
                <Field label={t("a_code", "Verification code")}>
                  <input
                    inputMode="numeric"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className={`${inputClass} text-center font-mono tracking-[0.3em]`}
                  />
                </Field>
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <Button tone="secondary" onClick={sendCode} className="flex-1">
                {t("a_send_code", "Send code")}
              </Button>
              <Button onClick={finish} className="flex-1">
                {t("a_verify", "Verify")}
              </Button>
            </div>

            {notice && <p className="mt-2 text-xs font-medium text-rose-600">{notice}</p>}
            <p className="mt-2 text-[11px] text-slate-400">
              {t("a_code", "Verification code")} — {t("a_demo_mode", "demo mode shows the code instead of sending email.")}
            </p>
          </Card>

          <Card className="mt-3">
            <h2 className="text-sm font-semibold text-slate-900">{t("a_demo", "Try a demo role")}</h2>
            <div className="mt-2 space-y-2">
              {[
                { id: "u-consumer", label: t("a_demo_consumer", "Consumer") },
                { id: "u-provider", label: t("a_demo_provider", "Provider") },
                { id: "u-admin", label: t("a_demo_admin", "Admin") },
              ].map((d) => (
                <Button key={d.id} tone="secondary" full onClick={() => demo(d.id)}>
                  {d.label}
                </Button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">
              {t("a_demo_note", "Provider and admin areas are role-gated in the portal links.")}
            </p>
          </Card>
        </>
      )}

      <Card className="mt-3">
        <div className="flex items-center gap-1.5">
          <LanguageIcon className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-900">{t("a_language", "Language")}</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">{t("a_language_d", "Choose the language you read most.")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <LangSwitcher />
          <span className="text-[11px] text-slate-400">{LANGS.map((l) => l.native).join(" · ")}</span>
        </div>
      </Card>

      <p className="mt-4 text-center text-xs text-slate-400">
        <Link href="/explore" className="font-semibold text-brand-700">
          {t("n_explore", "Explore")}
        </Link>{" "}
        ·{" "}
        <Link href="/find-care" className="font-semibold text-brand-700">
          {t("n_find", "Find Care")}
        </Link>
      </p>
    </Screen>
  );
}