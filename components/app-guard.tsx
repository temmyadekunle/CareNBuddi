"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n";
import { KEYS, seedUsers, useSession, useStoredCollection } from "@/lib/storage";
import { Button, Card, Screen } from "@/components/app-ui";
import { LockIcon } from "@/components/icons";

const PRIVATE_PATHS = [
  "/journal",
  "/records",
  "/reminders",
  "/passport",
  "/care-circle",
  "/health/chronic",
  "/health/journey",
  "/health/exercise",
  "/appointments",
  "/profile",
  // Onboarding and the status screen read the applicant's own application, so
  // they need a session. /provider/register is deliberately NOT here: it is the
  // page where an account is created, so requiring a session would lock out
  // exactly the person who needs it.
  "/provider/onboarding",
  "/provider/status",
];

/**
 * Staff areas, matched as an exact path or as a parent of it.
 */
const STAFF_PATHS = ["/worker", "/admin"];

/**
 * The professional workspace only, matched exactly.
 *
 * Its children are applicant routes (/provider/register, /provider/onboarding,
 * /provider/status), not staff areas. Treating them as staff is what sent new
 * applicants back to the sign-in screen, so `/provider` must not be used as a
 * prefix here.
 */
const STAFF_EXACT = ["/provider"];

/**
 * Exact segment match, not a prefix test.
 *
 * `pathname.startsWith("/provider")` also matched `/provider/register`, so an
 * unauthenticated applicant following "Create account as Health provider" was
 * told to sign in and could never reach the registration form.
 */
function matchesPath(pathname: string, base: string): boolean {
  if (pathname === base) return true;
  return pathname.startsWith(`${base}/`);
}

export function AppGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [session] = useSession();
  const [users] = useStoredCollection(KEYS.users, seedUsers);
  const gate = useGateStrings();
  const me = users.find((u) => u.id === session.userId);

  const isPrivate = PRIVATE_PATHS.some((p) => matchesPath(pathname, p));
  const isStaff =
    STAFF_PATHS.some((p) => matchesPath(pathname, p)) || STAFF_EXACT.includes(pathname);

  if (isStaff && me && me.role === "consumer") {
    return (
      <GateCard
        title={gate.staffTitle}
        body={gate.staffBody}
        href="/profile"
        linkLabel={gate.backToProfile}
      />
    );
  }

  if ((isPrivate || isStaff) && !session.userId) {
    return (
      <GateCard
        title={gate.signInTitle}
        body={gate.signInBody}
        href="/auth/sign-in"
        linkLabel={gate.signInCta}
      />
    );
  }

  return <>{children}</>;
}

function useGateStrings() {
  const t = useT();
  return {
    signInTitle: t("gate_signin_title", "Sign in to continue"),
    signInBody: t(
      "gate_signin_body",
      "This part of the app keeps your personal health information. Sign in to see your records.",
    ),
    signInCta: t("gate_signin_cta", "Sign in"),
    staffTitle: t("gate_staff_title", "Staff access only"),
    staffBody: t("gate_staff_body", "This area is for CareNBuddi providers and staff."),
    backToProfile: t("gate_back_profile", "Back to profile"),
  };
}

function GateCard({
  title,
  body,
  href,
  linkLabel,
}: {
  title: string;
  body: string;
  href: string;
  linkLabel: string;
}) {
  const t = useT();
  return (
    <Screen>
      <Card className="mt-6 flex flex-col items-center gap-3 py-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
          <LockIcon className="h-6 w-6" />
        </span>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="max-w-[18rem] text-sm text-slate-500">{body}</p>
        <Link href={href} className="mt-2 w-full max-w-[16rem]">
          <Button full>{linkLabel}</Button>
        </Link>
        <Link href="/app" className="text-xs font-semibold text-slate-500">
          {t("gate_continue_guest", "Continue as guest")}
        </Link>
      </Card>
    </Screen>
  );
}