"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Badge, BottomSheet, Button, Card, EmptyState, Screen, SectionHeader } from "./app-ui";
import {
  BellIcon,
  ChatIcon,
  ClockIcon,
  StethoscopeIcon,
  UserIcon,
} from "./icons";
import { useT } from "@/lib/i18n";
import { useProviderApplications } from "@/lib/use-provider-application";
import {
  KEYS,
  seedBookings,
  seedProviderRequests,
  seedProviders,
  seedUsers,
  todayIso,
  useSession,
  useStoredCollection,
} from "@/lib/storage";
import { seedProviderFor } from "@/lib/content";
import { dashboardCounts, providerIdFor, workspaceAccess } from "@/lib/provider-workspace";

/**
 * The chrome shared by every provider screen: the access guard, the section
 * navigation and the mobile More sheet.
 *
 * Kept in one place so the seven sections cannot each decide for themselves
 * who is allowed in, which is how a workspace ends up with a section the guard
 * forgot about.
 */

export interface ProviderContext {
  providerId: string | null;
  /** Present only when a facility record is actually linked. */
  facilityName: string | null;
  counts: ReturnType<typeof dashboardCounts>;
  /** Unread practice notifications, derived from open bookings. */
  unread: number;
}

/** The sections, in the order they appear. */
export const PROVIDER_SECTIONS = [
  { href: "/provider", key: "pws_dash", fallback: "Dashboard", icon: StethoscopeIcon },
  { href: "/provider/patients", key: "pws_care", fallback: "Patient Care", icon: UserIcon },
  { href: "/provider/practice", key: "pws_practice", fallback: "Practice", icon: ClockIcon },
  { href: "/provider/health", key: "pws_myhealth", fallback: "My Health", icon: UserIcon },
  { href: "/provider/community", key: "pws_community", fallback: "Community", icon: ChatIcon },
  { href: "/provider/rapid-response", key: "pws_rapid", fallback: "Rapid Response", icon: BellIcon },
  { href: "/provider/profile", key: "pws_profile", fallback: "Profile", icon: UserIcon },
] as const;

/** How many tabs sit in the mobile bar before the rest fold into More. */
const MOBILE_TABS = 4;

export function useProviderContext(): ProviderContext & { access: ReturnType<typeof workspaceAccess> } {
  const [session] = useSession();
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const [providers] = useStoredCollection(KEYS.providers, seedProviders);
  const [requests] = useStoredCollection(KEYS.providerRequests, seedProviderRequests);
  const [bookings] = useStoredCollection(KEYS.bookings, seedBookings);
  const { forUser } = useProviderApplications();

  const me = users.find((u) => u.id === session.userId);
  const application = forUser(me?.id ?? null);
  const access = workspaceAccess({ role: me?.role, application });

  const providerId = providerIdFor({
    email: me?.email,
    requests,
    providers,
    seededFor: seedProviderFor,
  });

  const counts = dashboardCounts({ bookings, providerId, today: todayIso() });
  const facilityName =
    providers.find((p) => p.id === providerId)?.name ?? null;

  return {
    providerId,
    facilityName,
    counts,
    unread: counts.newRequests + counts.awaitingConfirmation,
    access,
  };
}

/**
 * Wraps a provider screen with the access check and the section navigation.
 */
export function ProviderShell({ children }: { children: ReactNode }) {
  const t = useT();
  const ctx = useProviderContext();

  /* Not signed in, or signed in as a patient. */
  if (ctx.access === "not-a-provider") {
    return (
      <Screen>
        <SectionHeader
          title={t("pv_title", "Provider")}
          subtitle={t("pv_guard", "Sign in as a provider or admin to continue.")}
        />
        <Card className="mt-4 text-center">
          <EmptyState
            icon={<StethoscopeIcon className="h-6 w-6" />}
            title={t("pvx_staff_only", "Provider access only")}
            body={t("pv_guard", "Sign in as a provider or admin to continue.")}
            action={
              <Link href="/auth/sign-in" className="inline-block min-h-11">
                <Button className="min-h-11">{t("a_signin", "Sign in")}</Button>
              </Link>
            }
          />
        </Card>
      </Screen>
    );
  }

  /* An applicant who is not verified yet belongs on the status screen. */
  if (ctx.access === "locked") {
    return (
      <Screen>
        <SectionHeader
          title={t("pv_title", "Provider")}
          subtitle={t("pr_under_review", "Your application is under review")}
        />
        <Card className="mt-4">
          <EmptyState
            icon={<ClockIcon className="h-6 w-6" />}
            title={t("pr_workspace_locked", "Provider workspace not available yet")}
            body={t(
              "pr_workspace_locked_d",
              "The professional workspace opens once your application has been verified by the CareNBuddi review team.",
            )}
            action={
              <Link href="/provider/status" className="inline-block min-h-11">
                <Button className="min-h-11">
                  {t("pr_view_status", "View application status")}
                </Button>
              </Link>
            }
          />
        </Card>
      </Screen>
    );
  }

  return (
    <>
      <ProviderSectionNav />
      {children}
      <ProviderMobileNav />
    </>
  );
}

/** The horizontal section tabs, shown on tablet and desktop. */
function ProviderSectionNav() {
  const t = useT();
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("pws_nav", "Provider sections")}
      className="no-scrollbar flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
    >
      {PROVIDER_SECTIONS.map((s) => {
        const active = pathname === s.href;
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={active ? "page" : undefined}
            className={`tap shrink-0 border-b-2 px-3 py-3 text-sm font-semibold ${
              active
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400"
            }`}
          >
            {t(s.key, s.fallback)}
          </Link>
        );
      })}
      <Link
        href="/provider/notifications"
        aria-label={t("pws_notifs", "Notifications")}
        aria-current={pathname === "/provider/notifications" ? "page" : undefined}
        className="tap ml-auto flex shrink-0 items-center px-2 text-slate-500"
      >
        <BellIcon className="h-5 w-5" />
      </Link>
    </nav>
  );
}

/**
 * The mobile bar. Four tabs plus More, so the phone screen is never crowded -
 * the remaining sections open in a sheet instead of a scrolling strip.
 */
function ProviderMobileNav() {
  const t = useT();
  const pathname = usePathname();
  const ctx = useProviderContext();

  const tabs = PROVIDER_SECTIONS.slice(0, MOBILE_TABS);
  const overflow = PROVIDER_SECTIONS.slice(MOBILE_TABS);
  const overflowActive = overflow.some((s) => pathname === s.href);

  return (
    <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95 md:hidden">
      <div className="flex items-stretch">
        {tabs.map((s) => {
          const active = pathname === s.href;
          return (
            <Link
              key={s.href}
              href={s.href}
              aria-current={active ? "page" : undefined}
              className={`tap flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${
                active ? "text-brand-700" : "text-slate-500"
              }`}
            >
              <s.icon className="h-5 w-5" />
              {t(s.key, s.fallback)}
            </Link>
          );
        })}
        <MoreSheet overflow={overflow} active={overflowActive} unread={ctx.unread} />
      </div>
    </div>
  );
}

function MoreSheet({
  overflow,
  active,
  unread,
}: {
  overflow: readonly (typeof PROVIDER_SECTIONS)[number][];
  active: boolean;
  unread: number;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        className={`tap relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${
          active ? "text-brand-700" : "text-slate-500"
        }`}
      >
        <span className="relative">
          <StethoscopeIcon className="h-5 w-5" />
          {unread > 0 ? (
            <span className="absolute -right-3 -top-1.5">
              <Badge tone="amber">{unread}</Badge>
            </span>
          ) : null}
        </span>
        {t("pws_more", "More")}
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={t("pws_more", "More")}>
        <div className="space-y-1">
          {overflow.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              onClick={() => setOpen(false)}
              className="tap flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <s.icon className="h-5 w-5 shrink-0 text-slate-500" />
              {t(s.key, s.fallback)}
            </Link>
          ))}
          <Link
            href="/provider/notifications"
            onClick={() => setOpen(false)}
            className="tap flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <BellIcon className="h-5 w-5 shrink-0 text-slate-500" />
            {t("pws_notifs", "Notifications")}
          </Link>
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="tap flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <UserIcon className="h-5 w-5 shrink-0 text-slate-500" />
            {t("pws_account", "Account & sign out")}
          </Link>
        </div>
      </BottomSheet>
    </>
  );
}