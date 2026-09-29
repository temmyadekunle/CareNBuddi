"use client";

import Link from "next/link";

const TRACKERS = [
  { icon: "🏃", title: "Exercise & weight", desc: "Set your weight goal, train daily, set reminders and track your weight-loss journey.", href: "/health/exercise", badge: "Open" },
  { icon: "🗂️", title: "My Health Records", desc: "Screening history, appointments and key documents will appear here — kept private and secure.", href: "/profile" },
  { icon: "⏰", title: "My Reminders", desc: "Set reminders for appointments, screening dates, medications and follow-ups.", href: "/profile" },
  { icon: "🩺", title: "Prevention checklist", desc: "Your action list — BP checked, screening done, education completed. No medical labels, just progress.", href: "/services" },
  { icon: "📚", title: "Recommended learning", desc: "Health education matched to your interests and health journey.", href: "/explore" },
];

export default function HealthPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">My Health</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your personal dashboard — record health information, follow your prevention
          checklist, and keep appointments and reminders on track.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-700">
          You are browsing as a <strong>guest</strong>. Creating an optional account lets
          you record your health information and save providers and resources follow-up.
        </p>
        <Link
          href="/profile"
          className="mt-4 inline-block rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
        >
          Go to my profile
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {TRACKERS.map((t) => (
          <Link
            key={t.title}
            href={t.href}
            className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition-colors hover:border-brand-300"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-xl">
              {t.icon}
            </span>
            <h2 className="mt-3 text-sm font-semibold text-slate-900 group-hover:text-brand-700">
              {t.title}
            </h2>
            <p className="mt-1 text-sm text-slate-600">{t.desc}</p>
            <span className="mt-2 inline-block rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500">
              {"badge" in t ? t.badge : "Coming in the digital MVP"}
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
          Book a check →
        </Link>
      </div>
    </main>
  );
}