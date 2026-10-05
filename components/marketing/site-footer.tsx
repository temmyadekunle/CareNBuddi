import Link from "next/link";
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
      { label: "Why HealthLink", href: "#why" },
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

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Link href="/" aria-label="HealthLink home" className="flex items-center gap-2.5">
              <LogoMark className="h-9 w-9" />
              <span className="text-lg font-semibold tracking-tight text-slate-900">
                HealthLink
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

        <div className="mt-10 flex flex-col gap-2 border-t border-slate-200 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; 2026 HealthLink. All rights reserved.</p>
          <p>Photography via Pexels, free to use under the Pexels License.</p>
        </div>
      </div>
    </footer>
  );
}
