"use client";

import { useState } from "react";
import Link from "next/link";
import { EMERGENCY_CONTACTS, TOPICS } from "@/lib/content";
import { matchTopic } from "@/components/health";

const ACTIONS = [
  {
    href: "/explore",
    icon: "🔎",
    title: "Understand My Health",
    body: "Learn about symptoms, conditions, prevention and wellness.",
    tone: "teal" as const,
  },
  {
    href: "/services",
    icon: "🩺",
    title: "Check My Health",
    body: "Get blood pressure, glucose and wellbeing checks — at a location near you.",
    tone: "green" as const,
  },
  {
    href: "/find-care",
    icon: "🏥",
    title: "Find Healthcare",
    body: "Find hospitals, clinics, laboratories, pharmacies and professionals.",
    tone: "teal" as const,
  },
  {
    href: "/services",
    icon: "📅",
    title: "Book a Health Service",
    body: "Request a booking or contact a service, including the HealthLink Mobile Clinic.",
    tone: "coral" as const,
  },
  {
    href: "/health",
    icon: "🗂️",
    title: "My Health Records",
    body: "Screening history, appointments and key documents in one place.",
    tone: "teal" as const,
  },
  {
    href: "/health",
    icon: "⏰",
    title: "My Reminders",
    body: "Appointments, screening dates and follow-ups — set and manage them.",
    tone: "green" as const,
  },
];

const TONES: Record<string, Record<string, string>> = {
  teal: {
    icon: "bg-brand-50",
    text: "text-brand-700",
  },
  green: {
    icon: "bg-green-50",
    text: "text-green-700",
  },
  coral: {
    icon: "bg-coral-50",
    text: "text-coral-700",
  },
};

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
        <div className="mx-auto max-w-3xl px-4 py-14 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-brand-700">
            Better Information. Healthier You.
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            How can we help you today?
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-slate-600">
            HealthLink is your personal health navigation system — learn, check,
            find care, connect with providers and stay on track.
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
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
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

          <div className="mx-auto mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
            <span className="font-medium text-slate-600">Be seen quickly:</span>
            <Link
              href="/emergency"
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700"
            >
              🚨 Get Help Now
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

      {/* Main actions */}
      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-center text-sm font-semibold uppercase tracking-widest text-slate-500">
          Choose how to start
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {ACTIONS.map((opt) => (
            <Link
              key={opt.title}
              href={opt.href}
              className="group flex items-start gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-colors hover:border-brand-300"
            >
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${TONES[opt.tone].icon}`}
              >
                {opt.icon}
              </span>
              <span>
                <span className={`block text-sm font-semibold text-slate-900 group-hover:text-brand-700`}>
                  {opt.title}
                </span>
                <span className="mt-1 block text-sm text-slate-600">{opt.body}</span>
              </span>
            </Link>
          ))}
          <Link
            href="/emergency"
            className="group flex items-start gap-4 rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm transition-colors hover:border-red-300"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-100 text-2xl">
              🚨
            </span>
            <span>
              <span className="block text-sm font-semibold text-red-900 group-hover:text-red-800">
                Get Help Now
              </span>
              <span className="mt-1 block text-sm text-red-800">
                Emergency guidance, first aid steps and where to call for help right now.
              </span>
            </span>
          </Link>
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
            className="ml-1 font-medium text-brand-700 underline hover:text-brand-800"
          >
            Report incorrect or outdated information
          </a>
        </p>
      </div>
    </footer>
  );
}