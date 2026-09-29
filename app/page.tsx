"use client";

import { useState } from "react";
import Link from "next/link";
import { EMERGENCY_CONTACTS, TOPICS } from "@/lib/content";
import { matchTopic } from "@/components/health";

const OPTIONS = [
  {
    href: "/explore",
    icon: "🔎",
    title: "Understand My Health",
    body: "Learn about symptoms, conditions, prevention and wellness.",
  },
  {
    href: "/find-care",
    icon: "🏥",
    title: "Find Healthcare",
    body: "Find hospitals, clinics, laboratories, pharmacies and professionals.",
  },
  {
    href: "/mobile-clinic",
    icon: "🚐",
    title: "Book HealthLink Mobile Clinic",
    body: "Request a screening, outreach or wellness service.",
  },
  {
    href: "/profile",
    icon: "📅",
    title: "Manage My Health",
    body: "Appointments, reminders, saved providers and health records where appropriate.",
  },
];

export default function Home() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const suggestions = q
    ? TOPICS.filter((t) => matchTopic(t, q)).slice(0, 4)
    : [];

  return (
    <main>
      {/* Hero */}
      <section className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-slate-500">
            Better Information. Healthier You.
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            How can we help you today?
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-600">
            HealthLink connects you to reliable health information, preventive
            services and the right healthcare providers.
          </p>

          <div className="mx-auto mt-8 max-w-xl">
            <label htmlFor="search" className="sr-only">
              Search health information
            </label>
            <input
              id="search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What health information are you looking for?"
              autoFocus
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
            />
            {suggestions.length > 0 && (
              <ul className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm">
                {suggestions.map((t) => (
                  <li key={t.slug}>
                    <Link
                      href={`/explore?topic=${t.slug}`}
                      className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <span className="font-medium">{t.title}</span>
                      <span className="shrink-0 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500">
                        {t.healthCategory}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Emergency banner */}
      <section className="border-b border-amber-200 bg-amber-50">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 py-3 text-sm">
          <span className="font-semibold text-amber-900">In an emergency, call immediately:</span>
          {EMERGENCY_CONTACTS.map((c) => (
            <a
              key={`${c.name}-${c.number}`}
              href={`tel:${c.number}`}
              className="font-bold text-amber-900 underline decoration-amber-400 underline-offset-2 hover:text-amber-800"
            >
              {c.name} · {c.number}
            </a>
          ))}
        </div>
      </section>

      {/* Four main options */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-4 sm:grid-cols-2">
          {OPTIONS.map((opt) => (
            <Link
              key={opt.href}
              href={opt.href}
              className="group flex items-start gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-colors hover:border-emerald-300"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-2xl">
                {opt.icon}
              </span>
              <span>
                <span className="block text-sm font-semibold text-slate-900 group-hover:text-emerald-700">
                  {opt.title}
                </span>
                <span className="mt-1 block text-sm text-slate-600">{opt.body}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Footer / trust & safety */}
      <Footer />
    </main>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-slate-200/80 bg-white">
      <div className="mx-auto max-w-4xl space-y-2 px-4 py-8 text-center">
        <p className="text-xs text-slate-600">
          HealthLink provides general health information to help you find appropriate care. It is{" "}
          <strong>not a medical diagnosis</strong> and never replaces a healthcare professional.
        </p>
        <p className="text-xs text-slate-500">
          In an emergency, always call your local emergency number before using this platform.
        </p>
        <p className="pt-2 text-xs text-slate-400">
          Health content is reviewed by qualified health educators and professionals ·{" "}
          <a
            href="mailto:report@healthlink.app?subject=Report%20incorrect%20information"
            className="ml-1 font-medium text-emerald-700 underline hover:text-emerald-800"
          >
            Report incorrect or outdated information
          </a>
        </p>
      </div>
    </footer>
  );
}