"use client";

import { useState } from "react";
import Link from "next/link";

const CHECK_ITEMS = [
  { icon: "🫀", name: "Blood pressure", desc: "Quick, quiet BP checks with simple follow-up guidance." },
  { icon: "🩸", name: "Blood glucose", desc: "Point-of-care glucose checks and lifestyle advice." },
  { icon: "📋", name: "Wellness checks", desc: "Basic vitals and general wellbeing assessment." },
];

const SERVICES = [
  {
    icon: "🎓",
    name: "Health education",
    desc: "Plain-language sessions on prevention and healthy habits.",
  },
  {
    icon: "🏘️",
    name: "Community outreach",
    desc: "Screening and awareness events in your neighbourhood.",
  },
  {
    icon: "💼",
    name: "Corporate wellness",
    desc: "Workplace health days for teams and organisations.",
  },
  {
    icon: "🚐",
    name: "Mobile clinic visits",
    desc: "Screening, outreach and wellness services delivered where you are.",
  },
  {
    icon: "🔗",
    name: "Referral services",
    desc: "Guided connection to the right provider when appropriate.",
  },
  {
    icon: "📢",
    name: "Health campaigns",
    desc: "Community screening days such as “Know Your Numbers”.",
  },
];

export default function ServicesPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [service, setService] = useState(SERVICES[0].name);
  const [date, setDate] = useState("");
  const [area, setArea] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Services</h1>
        <p className="mt-1 text-sm text-slate-500">
          Check your health and book preventive health services — including the
          HealthLink Mobile Clinic.
        </p>
      </div>

      {/* Check My Health */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              <Link href="/health" className="underline decoration-slate-200 underline-offset-2 hover:text-brand-700">
                Check My Health
              </Link>
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Regular checks catch problems early. Start with your numbers, then stay on
              track with reminders and follow-up.
            </p>
          </div>
          <Link
            href="/health"
            className="rounded-lg bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-100"
          >
            Open my health page →
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {CHECK_ITEMS.map((s) => (
            <div key={s.name} className="rounded-xl bg-slate-50 p-4">
              <span className="text-xl">{s.icon}</span>
              <h3 className="mt-2 text-sm font-semibold text-slate-900">{s.name}</h3>
              <p className="mt-1 text-xs text-slate-600">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Services catalog */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
          Health services we provide
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s, i) => (
            <div
              key={s.name}
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl ${
                  i % 3 === 2 ? "bg-coral-50" : i % 3 === 1 ? "bg-green-50" : "bg-brand-50"
                }`}
              >
                {s.icon}
              </span>
              <h3 className="mt-3 text-sm font-semibold text-slate-900">{s.name}</h3>
              <p className="mt-1 text-sm text-slate-600">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Booking form */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
          Book a service or visit
        </h2>
        <div className="mt-4">
          {submitted ? (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-8 text-center">
              <p className="text-lg font-semibold text-green-900">Request received 🎉</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-green-800">
                Thanks {name ? name.split(" ")[0] : ""}! A HealthLink team member will contact{" "}
                {phone} to confirm your {service.toLowerCase()} visit
                {date ? ` on ${date}` : ""}. We confirm each booking by phone and text.
              </p>
              <button
                onClick={() => {
                  setSubmitted(false);
                  setName("");
                  setPhone("");
                  setDate("");
                  setArea("");
                }}
                className="mt-4 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
              >
                Book another visit
              </button>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
              <p className="text-sm text-slate-600">
                Request a screening, outreach, wellness or mobile-clinic service for
                yourself, your family, your workplace or your community. No payment is
                required to make a request — a team member confirms details by phone.
              </p>
              <form
                onSubmit={submit}
                className="h-fit rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
              >
                <h3 className="mb-4 text-sm font-semibold text-slate-900">
                  Request a service or clinic visit
                </h3>
                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-600">Full name</span>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Amina Yusuf"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-600">Phone</span>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+234 800 000 0000"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-600">Service</span>
                    <select
                      value={service}
                      onChange={(e) => setService(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                    >
                      {SERVICES.map((s) => (
                        <option key={s.name}>{s.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-600">Preferred date</span>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-slate-600">
                      Area / community / workplace
                    </span>
                    <input
                      type="text"
                      required
                      value={area}
                      onChange={(e) => setArea(e.target.value)}
                      placeholder="e.g. Ikeja, Lagos"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                    />
                  </label>
                </div>
                <button
                  type="submit"
                  className="mt-4 w-full rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
                >
                  Request a service
                </button>
                <p className="mt-2 text-xs text-slate-400">
                  No payment is required to make a request. A team member confirms
                  eligibility, pricing, and details by phone.
                </p>
              </form>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}