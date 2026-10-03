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
          <a href="#download" className="rounded-xl bg-brand-700 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-800">
            Get the app
          </a>
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
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Learn", "Plain-language health articles in your language."],
            ["Check", "Track vitals, journal entries and reminders."],
            ["Find Care", "Search verified facilities near you by state and LGA."],
            ["Connect", "Book requests and follow referrals with providers."],
          ].map(([title, desc]) => (
            <div key={title} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
              <p className="mt-1 text-sm text-slate-600">{desc}</p>
            </div>
          ))}
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
        <h2 className="text-2xl font-semibold text-slate-900">Download the HealthLink app</h2>
        <p className="mt-2 text-slate-600">
          The full HealthLink experience lives in our mobile app. Available on Android and iOS.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <a href="#" className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800">
            Google Play
          </a>
          <a href="#" className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800">
            App Store
          </a>
        </div>
      </section>
    </main>
  );
}
