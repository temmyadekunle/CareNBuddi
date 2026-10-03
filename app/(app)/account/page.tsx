"use client";

import { useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import { LANGS } from "@/lib/lang";
import {
  KEYS,
  seedUsers,
  useSession,
  useStoredCollection,
  uid,
  type Session,
} from "@/lib/storage";
import type { Role, User } from "@/lib/types";
import { LangSwitcher } from "@/components/ui";

function randomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export default function AccountPage() {
  const t = useT();
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
      setNotice("Enter an email first.");
      return;
    }
    const c = randomCode();
    setSentCode(c);
    setCode("");
    setNotice(t("a_code_sent"));
  };

  const finish = () => {
    if (!sentCode || code !== sentCode) {
      setNotice("The code does not match. Check and try again.");
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
  };

  const demo = (userId: string) => {
    setSession((prev: Session) => ({ ...prev, userId, lang: prev.lang }));
  };

  const signOut = () => {
    setSession((prev: Session) => ({ ...prev, userId: null }));
    setCreatedUser(null);
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{t("a_title")}</h1>
      <p className="mt-1 text-sm text-slate-500">{t("a_sub")}</p>

      {me || createdUser ? (
        <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-brand-700">{t("a_welcome")}</p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
              <dt className="text-slate-500">{t("a_name")}</dt>
              <dd className="font-medium text-slate-900">{me?.name ?? createdUser?.name ?? ""}</dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
              <dt className="text-slate-500">{t("a_email")}</dt>
              <dd className="font-medium text-slate-900">{me?.email ?? createdUser?.email ?? ""}</dd>
            </div>
            <div className="flex justify-between gap-3 border-b border-slate-100 pb-2">
              <dt className="text-slate-500">{t("a_role")}</dt>
              <dd className="font-medium text-slate-900">{me?.role ?? createdUser?.role ?? "consumer"}</dd>
            </div>
          </dl>
          <button
            onClick={signOut}
            className="mt-4 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
          >
            {t("a_signout")}
          </button>
        </div>
      ) : (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex gap-1.5">
              <Tab active={mode === "signup"} onClick={() => setMode("signup")}>
                {t("a_signup")}
              </Tab>
              <Tab active={mode === "signin"} onClick={() => setMode("signin")}>
                {t("a_signin")}
              </Tab>
            </div>

            <div className="mt-4 space-y-3">
              {mode === "signup" && (
                <Label text={t("a_name")}>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                  />
                </Label>
              )}
              <Label text={t("a_email")}>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                />
              </Label>
              {mode === "signup" && (
                <Label text={t("a_phone")}>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+234 ..."
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                  />
                </Label>
              )}
              {mode === "signup" && (
                <Label text={t("a_role")}>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                  >
                    <option value="consumer">{t("a_consumer")}</option>
                    <option value="provider">{t("a_provider")}</option>
                  </select>
                </Label>
              )}
            </div>

            {sentCode && (
              <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-3">
                <p className="text-xs font-medium text-brand-900">
                  {t("a_code_sent")}
                </p>
                <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-brand-700">
                  {sentCode}
                </p>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={sendCode}
                className="rounded-xl border border-brand-700 bg-white px-4 py-2 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50"
              >
                {t("a_send_code")}
              </button>
              <button
                onClick={finish}
                className="rounded-xl bg-brand-700 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
              >
                {t("a_verify")}
              </button>
            </div>
            {notice && <p className="mt-3 text-xs text-slate-500">{notice}</p>}
            <p className="mt-3 text-xs text-slate-400">
              {t("a_code")} — demo mode shows the code instead of sending email.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">{t("a_demo")}</h2>
            <div className="mt-3 space-y-2">
              <DemoButton label={t("a_demo_consumer")} onClick={() => demo("u-consumer")} />
              <DemoButton label={t("a_demo_provider")} onClick={() => demo("u-provider")} />
              <DemoButton label={t("a_demo_admin")} onClick={() => demo("u-admin")} />
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Provider and admin areas are role-gated in the portal links.
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">{t("a_language")}</h2>
        <p className="mt-1 text-xs text-slate-500">{t("a_language_d")}</p>
        <div className="mt-3 flex items-center gap-2">
          <LangSwitcher />
          <span className="text-xs text-slate-400">
            {LANGS.map((l) => l.native).join(" · ")}
          </span>
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        <Link href="/explore" className="font-medium text-brand-700 underline hover:text-brand-800">
          {t("n_explore")}
        </Link>{" "}
        ·{" "}
        <Link href="/find-care" className="font-medium text-brand-700 underline hover:text-brand-800">
          {t("n_find")}
        </Link>
      </p>
    </main>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "bg-brand-700 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-600">{text}</span>
      {children}
    </label>
  );
}

function DemoButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:border-brand-300 hover:bg-brand-50"
    >
      {label}
    </button>
  );
}