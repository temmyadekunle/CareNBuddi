import Link from "next/link";

export default function ProfilePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
      <p className="mt-1 text-sm text-slate-500">
        Your personal HealthLink area — guest-friendly, with an optional account for
        follow-up and saved resources.
      </p>

      <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-700">
          You are browsing as a <strong>guest</strong>. Creating an optional account lets
          you save providers and resources for follow-up, and manage records and
          reminders where legally and technically appropriate.
        </p>
        <button className="mt-4 rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">
          Sign in (coming soon — email magic-link)
        </button>
        <p className="mt-3 text-xs text-slate-400">
          Sign-in via secure email magic link is part of the platform roadmap and is
          optional. You can always continue as a guest.
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Placeholder title="Appointments" desc="Upcoming visits and requests will appear here." />
        <Placeholder title="Reminders" desc="Medication and screening reminders are planned." />
        <Placeholder title="Saved providers" desc="Bookmark facilities and professionals you trust." />
        <Placeholder title="Health records" desc="Records appear only where legally permitted." />
        <Placeholder title="Family profiles" desc="Optional linked profiles for dependants." />
        <Placeholder title="Health documents" desc="Lab results and referral documents." />
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        <Link href="/explore" className="font-medium text-brand-700 underline hover:text-brand-800">
          Explore health topics
        </Link>{" "}
        ·{" "}
        <Link href="/find-care" className="font-medium text-brand-700 underline hover:text-brand-800">
          Find care
        </Link>{" "}
        ·{" "}
        <Link href="/services" className="font-medium text-brand-700 underline hover:text-brand-800">
          Book a health service
        </Link>
      </p>
    </main>
  );
}

function Placeholder({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{desc}</p>
      <span className="mt-2 inline-block rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-500">
        Coming soon
      </span>
    </div>
  );
}