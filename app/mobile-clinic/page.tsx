"use client";

import { useState } from "react";

const SERVICES = [
  {
    icon: "🩺",
    name: "Blood pressure screening",
    desc: "Quick, quiet BP checks with simple follow-up guidance.",
  },
  {
    icon: "🩸",
    name: "Blood glucose screening",
    desc: "Point-of-care glucose checks and lifestyle advice.",
  },
  {
    icon: "📋",
    name: "Wellness checks",
    desc: "Basic vitals and general wellbeing assessment.",
  },
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
];

export default function MobileClinicPage() {
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
        <h1 className="text-2xl font-semibold tracking-tight">Book HealthLink Mobile Clinic</h1>
        <p className="mt-1 text-sm text-slate-500">
          We bring basic preventive healthcare closer to you — where you live and work.
        </p>
      </div>

      {submitted ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
          <p className="text-lg font-semibold text-emerald-900">Request received 🎉</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-emerald-800">
            Thanks {name ? name.split(" ")[0] : ""}! A HealthLink team member will contact {phone}{" "}
            to confirm your {service.toLowerCase()} visit{date ? ` on ${date}` : ""}. We will
            confirm each booking by phone and text.
          </p>
          <button
            onClick={() => {
              setSubmitted(false);
              setName("");
              setPhone("");
              setDate("");
              setArea("");
            }}
            className="mt-4 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Book another visit
          </button>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s) => (
              <div
                key={s.name}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-xl">
                  {s.icon}
                </span>
                <h2 className="mt-3 text-sm font-semibold text-slate-900">{s.name}</h2>
                <p className="mt-1 text-sm text-slate-600">{s.desc}</p>
              </div>
            ))}
          </div>

          <form
            onSubmit={submit}
            className="h-fit rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
          >
            <h2 className="mb-4 text-sm font-semibold text-slate-900">Book a visit</h2>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Full name</span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Amina Yusuf"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
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
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Service</span>
                <select
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
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
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
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
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
                />
              </label>
            </div>
            <button
              type="submit"
              className="mt-4 w-full rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-800"
            >
              Request a visit
            </button>
            <p className="mt-2 text-xs text-slate-400">
              No payment is required to make a request. A team member confirms eligibility,
              pricing, and details by phone.
            </p>
          </form>
        </div>
      )}
    </main>
  );
}