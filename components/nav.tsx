"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { LangSwitcher } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { KEYS, seedUsers, useSession, useStoredCollection } from "@/lib/storage";

export function Nav() {
  const pathname = usePathname();
  const t = useT();
  const [session] = useSession();
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const me = users.find((u) => u.id === session.userId);

  const role = me?.role ?? (session.userId ? "consumer" : "guest");
  const isStaff = role === "provider" || role === "admin";

  const consumerLinks = [
    { href: "/app", label: t("n_home") },
    { href: "/explore", label: t("n_explore") },
    { href: "/find-care", label: t("n_find") },
    { href: "/services", label: t("n_services") },
    { href: "/health", label: t("n_health") },
    { href: "/passport", label: t("n_passport", "Passport") },
    { href: "/ask", label: t("n_ask", "Ask") },
    { href: "/profile", label: t("n_profile") },
  ];

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/app" aria-label="HealthLink home">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <nav
            className="hidden"
            aria-label="Primary"
          >
            {consumerLinks.map((link) => {
              const active =
                link.href === "/app" ? pathname === "/app" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            {isStaff && (
              <>
                <Link
                  href={role === "admin" ? "/admin" : "/provider"}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    pathname.startsWith(role === "admin" ? "/admin" : "/provider")
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {role === "admin" ? t("n_admin") : t("n_provider")}
                </Link>
              </>
            )}
          </nav>
          <LangSwitcher compact />
          {role === "guest" ? (
            <Link
              href="/account"
              className="whitespace-nowrap rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
            >
              {t("a_signin")}
            </Link>
          ) : (
            <Link
              href={role === "admin" ? "/admin" : role === "provider" ? "/provider" : "/profile"}
              className="whitespace-nowrap rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100"
            >
              {me?.name?.split(" ")[0] ?? t("n_account")}
            </Link>
          )}
        </div>
      </div>
      <nav className="fixed bottom-0 left-1/2 z-20 w-full max-w-[420px] -translate-x-1/2 border-t border-slate-200/80 bg-white/95 backdrop-blur md:bottom-6 md:rounded-b-[28px]" aria-label="Mobile">
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 py-1.5">
          {[
            { href: "/app", icon: <HomeIcon />, label: t("n_home") },
            { href: "/find-care", icon: <HeartPulseIcon />, label: t("n_find") },
            { href: "/health", icon: <ActivityIcon />, label: t("n_health") },
            { href: "/passport", icon: <IdCardIcon />, label: t("n_passport", "Passport") },
            { href: "/profile", icon: <UserIcon />, label: t("n_profile") },
          ].map((link) => {
            const active =
              link.href === "/app" ? pathname === "/app" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-medium ${
                  active ? "text-brand-700" : "text-slate-500"
                }`}
              >
                {link.icon}
                <span className="w-full truncate text-center">{link.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}

function HomeIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" />
    </svg>
  );
}
function HeartPulseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 21C7 16.5 3 13.3 3 9.5 3 7 5 5 7.5 5c1.7 0 3.2.9 4.5 2.5C13.3 5.9 14.8 5 16.5 5 19 5 21 7 21 9.5c0 3.8-4 7-9 11.5Z" /><path d="M3 12h4l2-3 4 6 2-3h6" />
    </svg>
  );
}
function ActivityIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 12h-4l-3 8L9 4l-3 8H2" />
    </svg>
  );
}
function IdCardIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8" cy="11" r="2" /><path d="M13 16c0-1.5 1.3-3 3-3s3 1.5 3 3" /><path d="M16 5v4" />
    </svg>
  );
}
function UserIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}
