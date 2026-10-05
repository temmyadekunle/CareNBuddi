import Link from "next/link";
import { AppDownload, InstallSteps } from "@/components/app-download";

export default function LandingPage() {
  return (
    <main>
      <section className="bg-gradient-to-b from-brand-50 to-white px-4 py-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          Better Information. <span className="text-brand-700">Healthier You.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
          HealthLink is your personal health navigation system — learn about your health,
          check your numbers, find trusted care, track chronic conditions and stay on top
          of your wellbeing journey, all in your language.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/app"
            className="rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-800"
          >
            Get the app
          </Link>
          <a href="#about" className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:border-brand-300">
            Learn more
          </a>
        </div>
      </section>

      <section id="about" className="mx-auto max-w-5xl px-4 py-12">
        <h2 className="text-2xl font-semibold text-slate-900">What is HealthLink?</h2>
        <p className="mt-3 text-slate-600">
          HealthLink connects people, community health workers, providers and communities.
          Through our mobile app you get English, Yoruba, Hausa and Igbo health education, a
          Find Care directory with hospitals, PHCs, labs and pharmacies across Nigeria, chronic
          care journeys, health passports, community health days and more.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          {[
            ["🇳🇬", "Nigeria-first", "Built for Nigerian states & LGAs"],
            ["🌍", "4 Languages", "English, Yoruba, Hausa, Igbo"],
            ["🏥", "30+ Providers", "Hospitals, PHCs, labs, pharmacies"],
            ["❤️", "Community-led", "Health days with real follow-up"],
          ].map(([icon, title, desc]) => (
            <div key={title} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <span className="text-2xl">{icon}</span>
              <p className="mt-2 text-sm font-semibold text-slate-900">{title}</p>
              <p className="text-xs text-slate-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-semibold text-slate-900">One platform. Complete health navigation.</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Learn", "Plain-language education, community screening days, and chronic care journeys that keep prevention front and centre."],
              ["Track", "Daily journal, chronic care journeys, weight and exercise — your health, on record."],
              ["Find care", "Verified hospitals, PHCs, labs and pharmacies by state and LGA, compared by affordability."],
              ["Connect & protect", "Care circle, emergency card on your passport, and follow-up with health workers you trust."],
            ].map(([title, desc], i) => (
              <div key={title} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? "bg-brand-100 text-brand-700" : i === 1 ? "bg-emerald-100 text-emerald-800" : i === 2 ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"}`}>
                  {i + 1}
                </span>
                <h3 className="mt-3 text-sm font-semibold text-slate-900">{title}</h3>
                <p className="mt-1 text-sm text-slate-600">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="px-4 py-14">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-semibold text-slate-900">Inside the app, step by step</h2>
          <div className="mt-8 flex flex-col items-center gap-8 lg:flex-row lg:items-start">
            <div className="w-72 shrink-0 rounded-[2.5rem] border-4 border-slate-900 bg-white p-3 shadow-xl">
              <div className="rounded-[2rem] bg-slate-50 p-4 text-center">
                <p className="text-[10px] font-medium uppercase tracking-widest text-brand-700">Better Information. Healthier You.</p>
                <p className="mt-2 text-lg font-bold text-slate-900">How can we help you today?</p>
                <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-[11px] text-slate-400">🔎 Search health topics…</div>
                <div className="mt-3 space-y-2 text-left">
                  {[["📚", "Learn about health"], ["💚", "Check your health"], ["🏥", "Find care near you"], ["📅", "Connect with a provider"]].map(([i, l]) => (
                    <div key={l} className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white p-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-sm">{i}</span>
                      <span className="text-[11px] font-semibold text-slate-800">{l}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-around border-t border-slate-100 pt-2 text-[9px] text-slate-500">
                  <span>🏠 Home</span><span>🏥 Care</span><span>💚 Health</span><span>🪪 ID</span><span>👤 Me</span>
                </div>
              </div>
            </div>

            <ol className="space-y-4">
              {[
                ["Home", "Search any condition and jump straight to plain-language articles — no login needed. Bottom tabs take you anywhere in two taps."],
                ["Find Care", "Search hospitals, PHCs, labs and pharmacies by state and LGA, filter by cost (₦–₦₦₦), then call, WhatsApp or request a visit."],
                ["Health", "Your daily journal, records, reminders, exercise & weight journey, chronic-care programs and a merged health-timeline."],
                ["Passport", "Emergency card with blood group, allergies, meds and a QR code a health worker can scan on the spot."],
                ["Ask", "An educational navigator that answers where to go, what to check, and how to use the app — never a substitute for a doctor."],
              ].map(([title, desc], i) => (
                <li key={title} className="flex gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">{i + 1}</span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                    <p className="text-sm text-slate-600">{desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="team" className="bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-semibold text-slate-900">Meet the team</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              ["Temitope Adekunle", "Founder & Product Lead"],
              ["Patience Ogunleye", "Head of Provider Relations"],
              ["HealthLink Clinical Board", "Medical Advisors"],
            ].map(([name, role]) => (
              <div key={name} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-lg font-bold text-brand-700">
                  {name[0]}
                </div>
                <h3 className="mt-3 text-sm font-semibold text-slate-900">{name}</h3>
                <p className="text-xs text-slate-500">{role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="download" className="mx-auto max-w-5xl px-4 py-12 text-center">
        <h2 className="text-2xl font-semibold text-slate-900">Get the HealthLink app</h2>
        <p className="mt-2 text-slate-600">
          HealthLink runs in your browser and installs to your home screen like any app. Open it
          once, add it to your phone, and it keeps working when you lose signal.
        </p>
        <AppDownload />
        <InstallSteps />
      </section>
    </main>
  );
}
