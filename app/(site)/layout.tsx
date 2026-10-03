import Link from "next/link";
import { Logo } from "@/components/logo";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" aria-label="HealthLink home">
            <Logo />
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium text-slate-600">
            <a href="#about" className="hover:text-slate-900">About</a>
            <a href="#team" className="hover:text-slate-900">Team</a>
            <a href="#download" className="hover:text-slate-900">Download</a>
          </nav>
        </div>
      </header>
      <div className="flex-1">{children}</div>
      <footer className="border-t border-slate-200/80 bg-white py-6 text-center text-xs text-slate-500">
        © 2026 HealthLink — Better Information. Healthier You.
      </footer>
    </div>
  );
}
