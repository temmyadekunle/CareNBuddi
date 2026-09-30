"use client";

import Link from "next/link";
import { KEYS, seedUsers, useSession, useStoredCollection } from "@/lib/storage";
import { useT } from "@/lib/i18n";
import { LangSwitcher } from "@/components/ui";

const TRACKERS = [
  { icon: "🏃", key: "hh_exercise", href: "/health/exercise", badge: "Open" },
  { icon: "🗂️", key: "hh_journal", href: "/journal", badge: "Open" },
  { icon: "📂", key: "hh_records", href: "/records", badge: "Open" },
  { icon: "⏰", key: "hh_reminders", href: "/reminders", badge: "Open" },
  { icon: "🩺", key: "h_check", dKey: "h_check_d", href: "/services", badge: "Open" },
  { icon: "📚", key: "h_learn", dKey: "h_learn_d", href: "/explore", badge: "Open" },
];

export default function HealthPage() {
  const t = useT();
  const [session] = useSession();
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const me = users.find((u) => u.id === session.userId);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {me ? `${t("hh_title")} · ${me.name.split(" ")[0]}` : t("hh_title")}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{t("hh_sub")}</p>
        </div>
        <LangSwitcher />
      </div>

      {!session.userId || !me ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-700">{t("a_sub")}</p>
          <Link
            href="/account"
            className="mt-4 inline-block rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
          >
            {t("a_signin")} →
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-brand-100 bg-brand-50 p-5">
          <p className="text-sm text-brand-900">
            {t("a_welcome")} — <span className="font-semibold">{me.name}</span>{" "}
            <span className="text-brand-700">({me.role})</span>
          </p>
          {me.role !== "consumer" && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href={me.role === "admin" ? "/admin" : "/provider"}
                className="rounded-lg bg-brand-700 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-800"
              >
                {me.role === "admin" ? t("ad_title") : t("pv_title")} →
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {TRACKERS.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-colors hover:border-brand-300"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-xl">
              {item.icon}
            </span>
            <h2 className="mt-3 text-sm font-semibold text-slate-900 group-hover:text-brand-700">
              {t(item.key)}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{t(item.dKey ?? `${item.key}_d`, "") || ""}</p>
            <span className="mt-2 inline-block rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500">
              {item.badge}
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-brand-100 bg-brand-50 p-5">
        <h2 className="text-sm font-semibold text-brand-900">Know your numbers</h2>
        <p className="mt-1 text-sm text-brand-800">
          Start a HealthLink Community Health Day or book a mobile clinic visit to check
          your blood pressure and blood glucose with professional oversight.
        </p>
        <Link
          href="/services"
          className="mt-3 inline-block rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
        >
          {t("s_book")} →
        </Link>
      </div>
    </main>
  );
}