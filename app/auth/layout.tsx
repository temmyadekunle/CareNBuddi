"use client";

import Link from "next/link";
import { ToastProvider } from "@/components/app-ui";
import { ChevronLeftIcon } from "@/components/icons";
import { LogoMark } from "@/components/logo";
import { LangSwitcher } from "@/components/ui";
import { useT } from "@/lib/i18n";
import { CloudProvider } from "@/lib/supabase/cloud";

/**
 * Auth screens live outside the (app) group, so they bring their own chrome:
 * a small top bar and a scrollable main area. No app header, no bottom nav.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useT();

  return (
    <div className="app-canvas">
      <CloudProvider>
        <ToastProvider>
          <div id="app-shell">
            <header className="z-30 flex shrink-0 items-center gap-2.5 border-b border-slate-200/70 bg-white/92 px-3 py-2.5 backdrop-blur-md">
              <Link
                href="/app"
                aria-label={t("auth_back", "Back to HealthLink")}
                className="tap flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </Link>
              <Link href="/app" aria-label={t("auth_home", "HealthLink home")} className="tap shrink-0">
                <LogoMark className="h-9 w-9 rounded-xl" />
              </Link>
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight text-slate-900">
                {t("brand_name", "HealthLink")}
              </span>
              <LangSwitcher compact />
            </header>

            <main className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {children}
            </main>
          </div>
        </ToastProvider>
      </CloudProvider>
    </div>
  );
}
