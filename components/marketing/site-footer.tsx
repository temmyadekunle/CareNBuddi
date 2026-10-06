"use client";

import Link from "next/link";
import { useState } from "react";
import { LogoMark } from "@/components/logo";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "How It Works", href: "#how-it-works" },
      { label: "For Patients", href: "#for-patients" },
      { label: "For Providers", href: "#for-providers" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Why CareNBuddi", href: "#why" },
      { label: "Who we are", href: "#who-we-are" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
];

/**
 * Share links are real platform share intents, not profile links: they open a
 * share sheet with the page already filled in, so nothing here points at an
 * account that may not exist.
 *
 * When real accounts do exist, add them to PROFILE_LINKS below and they will
 * render alongside the share buttons.
 */
const SHARE_TARGETS = [
  {
    label: "Share on X",
    href: (url: string, text: string) =>
      `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
    path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  },
  {
    label: "Share on Facebook",
    href: (url: string) => `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    path: "M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.32l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07",
  },
  {
    label: "Share on LinkedIn",
    href: (url: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
    path: "M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13M7.12 20.45H3.55V9h3.57zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.55C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.72C24 .77 23.2 0 22.22 0",
  },
  {
    label: "Share on WhatsApp",
    href: (url: string, text: string) =>
      `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
    path: "M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.48-1.75-1.65-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35M12.05 21.8h-.02a9.8 9.8 0 0 1-4.99-1.37l-.36-.21-3.71.97.99-3.62-.23-.37a9.78 9.78 0 0 1-1.5-5.22c0-5.4 4.4-9.8 9.82-9.8 2.62 0 5.08 1.03 6.94 2.88a9.75 9.75 0 0 1 2.87 6.93c0 5.4-4.4 9.8-9.81 9.8M20.52 3.45A11.78 11.78 0 0 0 12.05 0C5.6 0 .35 5.24.35 11.69c0 2.06.54 4.07 1.56 5.85L.25 24l6.6-1.73a11.7 11.7 0 0 0 5.2 1.24h.01c6.44 0 11.69-5.24 11.69-11.69 0-3.12-1.22-6.06-3.43-8.27",
  },
];

/** Add real accounts here when they exist. */
const PROFILE_LINKS: { label: string; href: string }[] = [];

const SHARE_TEXT = "CareNBuddi — healthcare, connected. Find care, book appointments and manage your health in one place.";

export function SiteFooter() {
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? "" : window.location.origin + window.location.pathname;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Link href="/" aria-label="CareNBuddi home" className="flex items-center gap-2.5">
              <LogoMark className="h-9 w-9" />
              <span className="text-lg font-semibold tracking-tight text-slate-900">
                CareNBuddi
              </span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-slate-600">Healthcare, connected.</p>
            <Link
              href="/app"
              className="mt-4 inline-flex rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-800"
            >
              Open the app
            </Link>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="text-sm font-semibold text-slate-900">{col.title}</h2>
              <ul className="mt-3 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith("#") ? (
                      <a
                        href={link.href}
                        className="text-sm text-slate-600 transition-colors hover:text-brand-700"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-slate-600 transition-colors hover:text-brand-700"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-6 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Share HealthLink</h2>
            <p className="mt-1 text-xs text-slate-500">
              Know someone who should use this? Send it to them.
            </p>
            <ul className="mt-3 flex items-center gap-2">
              {SHARE_TARGETS.map((target) => (
                <li key={target.label}>
                  <a
                    href={target.href(encodeURIComponent(url), encodeURIComponent(SHARE_TEXT))}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={target.label}
                    title={target.label}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-brand-300 hover:text-brand-700"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
                      <path d={target.path} />
                    </svg>
                  </a>
                </li>
              ))}
              {PROFILE_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer me"
                    className="flex h-10 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 transition-colors hover:border-brand-300 hover:text-brand-700"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={copyLink}
                  aria-label="Copy link to CareNBuddi"
                  title="Copy link"
                  className="flex h-10 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 transition-colors hover:border-brand-300 hover:text-brand-700"
                >
                  {copied ? "Copied" : "Copy link"}
                </button>
              </li>
            </ul>
          </div>

          <p className="text-xs text-slate-500">&copy; 2026 CareNBuddi. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
