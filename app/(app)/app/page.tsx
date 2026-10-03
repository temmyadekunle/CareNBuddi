"use client";

import { useState } from "react";
import Link from "next/link";
import { EMERGENCY_CONTACTS } from "@/lib/content";
import { topicTitle, topicSummary } from "@/lib/content";
import { matchTopic } from "@/components/health";
import { KEYS, seedTopics, useStoredCollection } from "@/lib/storage";
import { useT, useLang } from "@/lib/i18n";
import { LangSwitcher } from "@/components/ui";

const ACTIONS = [
  {
    href: "/explore",
    icon: "🔎",
    titleKey: "h_learn",
    bodyKey: "h_learn_d",
    tone: "teal" as const,
  },
  {
    href: "/services",
    icon: "🩺",
    titleKey: "h_check",
    bodyKey: "h_check_d",
    tone: "green" as const,
  },
  {
    href: "/find-care",
    icon: "🏥",
    titleKey: "h_find",
    bodyKey: "h_find_d",
    tone: "teal" as const,
  },
  {
    href: "/services",
    icon: "📅",
    titleKey: "h_connect",
    bodyKey: "h_connect_d",
    tone: "coral" as const,
  },
];

const TONES: Record<string, Record<string, string>> = {
  teal: { icon: "bg-brand-50", text: "text-brand-700" },
  green: { icon: "bg-green-50", text: "text-green-700" },
  coral: { icon: "bg-coral-50", text: "text-coral-700" },
};

export default function Home() {
  const t = useT();
  const lang = useLang();
  const [topics] = useStoredCollection(KEYS.topics, seedTopics);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const published = topics.filter((tp) => tp.status === "published");
  const suggestions = q ? published.filter((tp) => matchTopic(tp, q)).slice(0, 4) : [];

  return (
    <main>
      <section className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-14 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-brand-700">
            {t("h_tagline")}
          </p>
          <div className="mt-3 flex items-center justify-center">
            <LangSwitcher />
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {t("h_title")}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-600">{t("h_sub")}</p>

          <div className="mx-auto mt-8 max-w-xl">
            <label htmlFor="search" className="sr-only">
              {t("h_search")}
            </label>
            <input
              id="search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("h_search")}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
            {suggestions.length > 0 && (
              <ul className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm">
                {suggestions.map((tp) => (
                  <li key={tp.id}>
                    <Link
                      href={`/explore?topic=${tp.id}`}
                      className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <span className="font-medium">{topicTitle(tp, lang)}</span>
                      <span className="shrink-0 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500">
                        {topicSummary(tp, lang).length > 20
                          ? tp.healthCategory
                          : tp.healthCategory}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mx-auto mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
            <span className="font-medium text-slate-600">{t("h_emergency_d")}</span>
            <Link
              href="/emergency"
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700"
            >
              🚨 {t("h_emergency")}
            </Link>
            <span className="flex items-center gap-3">
              {EMERGENCY_CONTACTS.slice(0, 2).map((c) => (
                <a
                  key={`${c.name}-${c.number}`}
                  href={`tel:${c.number}`}
                  className="font-semibold text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-brand-700"
                >
                  {c.name} · {c.number}
                </a>
              ))}
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-center text-sm font-semibold uppercase tracking-widest text-slate-500">
          {t("h_browse")}
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {ACTIONS.map((opt) => (
            <Link
              key={opt.titleKey}
              href={opt.href}
              className="group flex items-start gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-colors hover:border-brand-300"
            >
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${TONES[opt.tone].icon}`}
              >
                {opt.icon}
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900 group-hover:text-brand-700">
                  {t(opt.titleKey)}
                </span>
                <span className="mt-1 block text-sm text-slate-600">{t(opt.bodyKey)}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}

export function Footer() {
  const t = useT();
  return (
    <footer className="border-t border-slate-200/80 bg-brand-50">
      <div className="mx-auto max-w-4xl space-y-3 px-4 py-10 text-center">
        <p className="text-sm font-semibold text-brand-900">{t("ft_nav")}</p>
        <p className="mx-auto max-w-2xl text-sm text-slate-600">{t("ft_desc")}</p>
        <p className="mx-auto max-w-2xl text-xs text-slate-500">
          <strong className="text-slate-700">Important:</strong> {t("ft_notdx")} {t("ft_emergency")}
        </p>
        <p className="text-xs font-medium text-brand-700">{t("ft_lang")}</p>
        <p className="pt-1 text-xs text-slate-400">
          <a
            href="mailto:report@healthlink.app?subject=Report%20incorrect%20information"
            className="font-medium text-brand-700 underline hover:text-brand-800"
          >
            {t("ft_report")}
          </a>
        </p>
      </div>
    </footer>
  );
}