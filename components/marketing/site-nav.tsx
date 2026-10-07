"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CloseIcon, MenuIcon } from "@/components/icons";
import { LogoMark } from "@/components/logo";

const LINKS = [
  { href: "#top", label: "Home" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#features", label: "Features" },
  { href: "#for-patients", label: "For Patients" },
  { href: "#for-providers", label: "For Providers" },
  { href: "#faq", label: "FAQ" },
];

export function SiteNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href="/" aria-label="CareNBuddi home" className="flex items-center gap-2.5">
          <LogoMark className="h-9 w-9" />
          <span className="text-lg font-semibold tracking-tight text-slate-900">CareNBuddi</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-7 lg:flex">
          <ul className="flex items-center gap-7 text-sm font-medium text-slate-600">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="rounded transition-colors hover:text-brand-700">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2.5">
            <Link
              href="/auth/sign-in"
              className="rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:text-brand-700"
            >
              Log In
            </Link>
            <Link
              href="/onboarding"
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-800"
            >
              Get Started
            </Link>
          </div>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="site-mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 lg:hidden"
        >
          {open ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div id="site-mobile-menu" className="border-t border-slate-200 bg-white lg:hidden">
          <nav aria-label="Mobile" className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
            <ul className="flex flex-col text-[15px] font-medium text-slate-700">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block rounded-lg px-2 py-3 hover:bg-slate-50"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-3 grid grid-cols-2 gap-2.5 pb-2">
              <Link
                href="/auth/sign-in"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-slate-700"
              >
                Log In
              </Link>
              <Link
                href="/onboarding"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-brand-700 px-4 py-3 text-center text-sm font-semibold text-white"
              >
                Get Started
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
