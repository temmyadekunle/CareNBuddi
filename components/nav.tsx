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
    { href: "/", label: t("n_home") },
    { href: "/explore", label: t("n_explore") },
    { href: "/find-care", label: t("n_find") },
    { href: "/services", label: t("n_services") },
    { href: "/health", label: t("n_health") },
    { href: "/profile", label: t("n_profile") },
  ];

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" aria-label="HealthLink home">
          <Logo />
        </Link>
        <div className="flex items-center gap-2">
          <nav
            className="flex items-center gap-0.5 overflow-x-auto"
            aria-label="Primary"
          >
            {consumerLinks.map((link) => {
              const active =
                link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
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
    </header>
  );
}