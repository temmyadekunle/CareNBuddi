"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, useStoredCollection, KEYS, seedUsers } from "@/lib/storage";

const PRIVATE_PATHS = [
  "/journal",
  "/records",
  "/reminders",
  "/passport",
  "/care-circle",
  "/health/chronic",
  "/health/journey",
  "/health/exercise",
  "/profile",
];

const STAFF_PATHS = ["/worker", "/provider", "/admin"];

export function AppGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [session] = useSession();
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const me = users.find((u) => u.id === session.userId);

  const isPrivate = PRIVATE_PATHS.some((p) => pathname.startsWith(p));
  const isStaff = STAFF_PATHS.some((p) => pathname.startsWith(p));

  if ((isPrivate || isStaff) && !session.userId) {
    return <GateCard title="Sign in to continue" body="This area keeps your personal health information. Sign in or create a free account to use it." />;
  }
  if (isStaff && me && me.role === "consumer") {
    return <GateCard title="Staff access only" body="This area is for HealthLink providers and admins. Sign in with a provider or admin account." />;
  }
  return <>{children}</>;
}

function GateCard({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{body}</p>
        <Link
          href="/account"
          className="mt-5 inline-block rounded-xl bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-800"
        >
          Sign in / Create account →
        </Link>
      </div>
    </main>
  );
}
