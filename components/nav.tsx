"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogoMark } from "@/components/logo";
import { LangSwitcher } from "@/components/ui";
import { Avatar, BottomSheet, ListRow } from "@/components/app-ui";
import {
  ActivityIcon,
  BookIcon,
  BookIcon as RecordsIcon,
  CalendarIcon,
  ChatIcon,
  FileTextIcon,
  GridIcon,
  HeartPulseIcon,
  HomeIcon,
  PillIcon,
  SearchIcon,
  SettingsIcon,
  ShieldIcon,
  StethoscopeIcon,
  UserIcon,
  WalletIcon,
  BellIcon,
} from "@/components/icons";
import { useT } from "@/lib/i18n";
import { KEYS, seedUsers, useSession, useStoredCollection } from "@/lib/storage";

const TABS = [
  { href: "/app", labelKey: "n_home", Icon: HomeIcon },
  { href: "/find-care", labelKey: "n_find", Icon: SearchIcon },
  { href: "/health", labelKey: "n_health", Icon: HeartPulseIcon },
  { href: "/appointments", labelKey: "n_appts", Icon: CalendarIcon },
  { href: "/profile", labelKey: "n_profile", Icon: UserIcon },
] as const;

const TITLES: { prefix: string; titleKey: string; subKey?: string }[] = [
  { prefix: "/app", titleKey: "n_home" },
  { prefix: "/appointments", titleKey: "n_appts" },
  { prefix: "/find-care/", titleKey: "f_title" },
  { prefix: "/find-care", titleKey: "n_find" },
  { prefix: "/health/diary", titleKey: "mh_title", subKey: "mh_sub" },
  { prefix: "/health/exercise", titleKey: "hx_title", subKey: "hx_sub" },
  { prefix: "/health/chronic", titleKey: "n_chronic", subKey: "n_chronic_d" },
  { prefix: "/health/journey", titleKey: "jt_title", subKey: "jt_sub" },
  { prefix: "/health", titleKey: "n_health" },
  { prefix: "/passport", titleKey: "pp_title", subKey: "pp_sub" },
  { prefix: "/care-circle", titleKey: "n_carecircle", subKey: "n_carecircle_d" },
  { prefix: "/journal", titleKey: "hh_journal", subKey: "hh_journal_d" },
  { prefix: "/records", titleKey: "hh_records", subKey: "hh_records_d" },
  { prefix: "/reminders", titleKey: "hh_reminders", subKey: "hh_reminders_d" },
  { prefix: "/explore", titleKey: "e_title", subKey: "e_sub" },
  { prefix: "/ask", titleKey: "n_ask", subKey: "n_ask_d" },
  { prefix: "/services", titleKey: "s_title", subKey: "s_sub" },
  { prefix: "/health-days", titleKey: "n_healthdays", subKey: "n_healthdays_d" },
  { prefix: "/emergency", titleKey: "em_title", subKey: "em_sub" },
  { prefix: "/worker", titleKey: "w_title", subKey: "w_sub" },
  { prefix: "/provider", titleKey: "pv_title", subKey: "pv_sub" },
  { prefix: "/admin", titleKey: "ad_title" },
  { prefix: "/account", titleKey: "a_title", subKey: "a_sub" },
  { prefix: "/profile", titleKey: "n_profile" },
];

export function Nav() {
  const pathname = usePathname();
  const t = useT();
  const [session] = useSession();
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const me = users.find((u) => u.id === session.userId);
  const [moreOpen, setMoreOpen] = useState(false);

  const match = TITLES.find((entry) =>
    entry.prefix.endsWith("/") ? pathname.startsWith(entry.prefix) : pathname === entry.prefix,
  );

  return (
    <>
      <header className="z-30 shrink-0 border-b border-slate-200/70 bg-white/92 backdrop-blur-md">
        <div className="flex items-center gap-2.5 px-4 py-2.5">
          <Link href="/app" aria-label="CareNBuddi home" className="tap shrink-0">
            <LogoMark className="h-9 w-9 rounded-xl" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-semibold leading-tight tracking-tight text-slate-900">
              {match ? t(match.titleKey) : "CareNBuddi"}
            </h1>
            {match?.subKey && (
              <p className="truncate text-[11px] leading-tight text-slate-500">{t(match.subKey)}</p>
            )}
          </div>

          <Link
            href="/reminders"
            aria-label={t("n_notifications")}
            className="tap relative flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
          >
            <BellIcon className="h-5 w-5" />
            {session.userId && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-coral-500 ring-2 ring-white" />
            )}
          </Link>

          <button
            type="button"
            aria-label={t("n_more")}
            onClick={() => setMoreOpen(true)}
            className="tap flex h-9 w-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
          >
            <GridIcon className="h-5 w-5" />
          </button>

          {me ? (
            <Link href="/profile" aria-label={t("n_profile")} className="tap shrink-0">
              <Avatar name={me.name} size={34} />
            </Link>
          ) : (
            <Link
              href="/auth/sign-in"
              className="tap shrink-0 rounded-full bg-brand-700 px-3.5 py-1.5 text-xs font-semibold text-white"
            >
              {t("a_signin")}
            </Link>
          )}
        </div>
      </header>

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} isStaff={me?.role === "provider" || me?.role === "admin"} />
    </>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const t = useT();

  return (
    <nav
      aria-label={t("n_main_nav")}
      className="safe-bottom absolute inset-x-0 bottom-0 z-30 shrink-0 border-t border-slate-200/70 bg-white/95 backdrop-blur-md"
    >
      <div className="flex items-stretch justify-between px-1.5 pt-1.5">
        {TABS.map(({ href, labelKey, Icon }) => {
          const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="tap flex min-h-[3.25rem] flex-1 flex-col items-center gap-0.5"
            >
              <span
                className={`flex h-8 w-14 items-center justify-center rounded-xl transition-colors ${
                  active ? "bg-brand-50 text-brand-700" : "text-slate-400"
                }`}
              >
                <Icon className="h-[1.15rem] w-[1.15rem]" />
              </span>
              <span
                className={`text-[10px] leading-tight ${
                  active ? "font-semibold text-brand-700" : "font-medium text-slate-500"
                }`}
              >
                {t(labelKey)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function MoreSheet({
  open,
  onClose,
  isStaff,
}: {
  open: boolean;
  onClose: () => void;
  isStaff: boolean;
}) {
  const t = useT();

  const groups: { titleKey: string; items: { href: string; titleKey: string; icon: React.ReactNode }[] }[] = [
    {
      titleKey: "n_my_health",
      items: [
        { href: "/health/diary", titleKey: "mh_title", icon: <CalendarIcon className="h-5 w-5" /> },
        { href: "/passport", titleKey: "pp_title", icon: <ShieldIcon className="h-5 w-5" /> },
        { href: "/records", titleKey: "hh_records", icon: <RecordsIcon className="h-5 w-5" /> },
        { href: "/journal", titleKey: "hh_journal", icon: <FileTextIcon className="h-5 w-5" /> },
        { href: "/reminders", titleKey: "hh_reminders", icon: <PillIcon className="h-5 w-5" /> },
        { href: "/care-circle", titleKey: "n_carecircle", icon: <ActivityIcon className="h-5 w-5" /> },
        { href: "/health/exercise", titleKey: "hx_title", icon: <ActivityIcon className="h-5 w-5" /> },
      ],
    },
    {
      titleKey: "n_care",
      items: [
        { href: "/services", titleKey: "s_title", icon: <CalendarIcon className="h-5 w-5" /> },
        { href: "/ask", titleKey: "n_ask", icon: <ChatIcon className="h-5 w-5" /> },
        { href: "/explore", titleKey: "e_title", icon: <BookIcon className="h-5 w-5" /> },
        { href: "/health-days", titleKey: "n_healthdays", icon: <CalendarIcon className="h-5 w-5" /> },
        { href: "/emergency", titleKey: "em_title", icon: <StethoscopeIcon className="h-5 w-5" /> },
      ],
    },
    {
      titleKey: "n_account",
      items: [
        { href: "/profile", titleKey: "n_profile", icon: <UserIcon className="h-5 w-5" /> },
        { href: "/account", titleKey: "a_cloud", icon: <WalletIcon className="h-5 w-5" /> },
        { href: "/worker", titleKey: "n_worker", icon: <StethoscopeIcon className="h-5 w-5" /> },
      ],
    },
  ];

  if (isStaff) {
    groups.push({
      titleKey: "n_staff",
      items: [
        { href: "/provider", titleKey: "pv_title", icon: <StethoscopeIcon className="h-5 w-5" /> },
        { href: "/admin", titleKey: "ad_title", icon: <SettingsIcon className="h-5 w-5" /> },
      ],
    });
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={t("n_more")}>
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.titleKey}>
            <p className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {t(group.titleKey)}
            </p>
            <div className="-mx-4 divide-y divide-slate-100">
              {group.items.map((item) => (
                <ListRow
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  title={t(item.titleKey)}
                  onClick={undefined}
                />
              ))}
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
          <span className="text-xs font-semibold text-slate-600">{t("a_language")}</span>
          <LangSwitcher compact />
        </div>
      </div>
    </BottomSheet>
  );
}