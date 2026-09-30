"use client";

import Link from "next/link";
import { KEYS, seedBookings, seedUsers, useSession, useStoredCollection } from "@/lib/storage";
import { useT } from "@/lib/i18n";
import { LangSwitcher } from "@/components/ui";

export default function ProfilePage() {
  const t = useT();
  const [session, setSession] = useSession();
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const [bookings] = useStoredCollection(KEYS.bookings, seedBookings);
  const me = users.find((u) => u.id === session.userId);
  const myBookings = bookings.filter((b) => b.userId === session.userId);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("n_profile")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("a_sub")}</p>
        </div>
        <LangSwitcher />
      </div>

      {!session.userId || !me ? (
        <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-700">{t("a_sub")}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/account"
              className="rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
            >
              {t("a_signin")} →
            </Link>
            <Link
              href="/account?demo=consumer"
              className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {t("a_demo_consumer")}
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl border border-brand-100 bg-brand-50 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-brand-900">{me.name}</h2>
              <p className="text-sm text-brand-700">
                {me.email} · {me.phone ?? "—"}
              </p>
              <span className="mt-1 inline-block rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-brand-700">
                {me.role}
              </span>
            </div>
            <button
              onClick={() => setSession((prev) => ({ ...prev, userId: null }))}
              className="rounded-xl border border-brand-300 bg-white px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
            >
              {t("a_signout")}
            </button>
          </div>
          <p className="mt-3 text-xs text-brand-800">{t("a_language_d")}</p>
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">My requests</h2>
        <div className="mt-3 space-y-2">
          {myBookings.length === 0 ? (
            <p className="text-sm text-slate-500">
              No booking requests yet.{" "}
              <Link href="/find-care" className="font-medium text-brand-700 underline">
                {t("f_title")}
              </Link>{" "}
              or{" "}
              <Link href="/services" className="font-medium text-brand-700 underline">
                {t("s_title")}
              </Link>{" "}
              to get started.
            </p>
          ) : (
            myBookings.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {b.providerId ? "Provider visit" : b.message.split("—")[0].trim()}
                  </p>
                  <p className="text-xs text-slate-500">
                    {b.date ?? new Date(b.createdAt).toISOString().slice(0, 10)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                  {b.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Placeholder title="Appointments" desc="Upcoming visits and requests will appear here." />
        <Placeholder title="Reminders" desc="Medication and screening reminders are planned." />
        <Placeholder title="Saved providers" desc="Bookmark facilities and professionals you trust." />
        <Placeholder title="Health records" desc="Records appear only where legally permitted." />
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        <Link href="/explore" className="font-medium text-brand-700 underline hover:text-brand-800">
          {t("e_title")}
        </Link>{" "}
        ·{" "}
        <Link href="/find-care" className="font-medium text-brand-700 underline hover:text-brand-800">
          {t("f_title")}
        </Link>{" "}
        ·{" "}
        <Link href="/services" className="font-medium text-brand-700 underline hover:text-brand-800">
          {t("s_title")}
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