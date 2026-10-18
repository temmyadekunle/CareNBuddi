import type { Role, User } from "./types";

/**
 * The route access rule, as a pure function.
 *
 * This used to live inline in components/app-guard.tsx, where it could only be
 * exercised by rendering the app. It is here so the decision can be tested
 * directly, because the single most important property is the one that is
 * hardest to see by reading: a session value on its own is a claim, not proof.
 */

/**
 * Routes that need a signed-in account.
 *
 * Note that "/provider/register" is deliberately absent: it is where an account
 * is created, so requiring a session would lock out exactly the person who
 * needs it.
 */
export const PRIVATE_PATHS = [
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
  "/provider/onboarding",
  "/provider/status",
];

/** Staff areas, matched as an exact path or as a parent of it. */
export const STAFF_PATHS = ["/worker", "/admin"];

/**
 * The professional workspace only, matched exactly.
 *
 * Its children are applicant routes (/provider/register, /provider/onboarding,
 * /provider/status), not staff areas. Treating them as staff is what sent new
 * applicants back to the sign-in screen, so "/provider" must not be a prefix.
 */
export const STAFF_EXACT = ["/provider"];

/**
 * Strips a trailing slash. The static export is served with trailing slashes,
 * so without this "/provider/" would miss the exact-match staff list and a
 * guest would be let through.
 */
function normalize(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

/**
 * Exact segment match, not a prefix test.
 *
 * `pathname.startsWith("/provider")` also matched "/provider/register", so an
 * unauthenticated applicant following "Create account as Healthcare provider"
 * was told to sign in and could never reach the registration form.
 */
export function matchesPath(pathname: string, base: string): boolean {
  const path = normalize(pathname);
  if (path === base) return true;
  return path.startsWith(`${base}/`);
}

export function isPrivateRoute(pathname: string): boolean {
  const path = normalize(pathname);
  return PRIVATE_PATHS.some((p) => matchesPath(path, p));
}

export function isStaffRoute(pathname: string): boolean {
  const path = normalize(pathname);
  return STAFF_PATHS.some((p) => matchesPath(path, p)) || STAFF_EXACT.includes(path);
}

/**
 * The account a session refers to.
 *
 * Resolving the id against the real account list is the point of this function.
 * A userId written straight into local storage resolves to `undefined`, so it
 * cannot stand in for a session on its own.
 */
export function resolveSessionUser(users: User[], userId: string | null | undefined): User | undefined {
  if (!userId) return undefined;
  return users.find((u) => u.id === userId);
}

/** What the guard should render. */
export type GateDecision = "allow" | "require-sign-in" | "require-staff";

/**
 * Decides whether a route may render.
 *
 * `user` must come from resolveSessionUser, never straight from storage. The
 * consumer check comes first so a patient landing on a staff route is told to
 * go back to their profile rather than being asked to sign in again.
 */
export function routeAccess(args: {
  pathname: string;
  user: User | undefined;
}): GateDecision {
  const { pathname, user } = args;

  if (isStaffRoute(pathname) && user && user.role === "consumer") return "require-staff";

  // Requires a real account record, not merely a truthy session value.
  if ((isPrivateRoute(pathname) || isStaffRoute(pathname)) && !user) return "require-sign-in";

  return "allow";
}

/** True only for a provider who has passed verification. Mirrors the workspace rule. */
export function isVerifiedProvider(args: {
  user: User | undefined;
  applicationStatus: string | null | undefined;
}): boolean {
  const { user, applicationStatus } = args;
  if (user?.role !== "provider" && user?.role !== "admin") return false;
  if (user?.role === "admin") return true;
  return applicationStatus === "verified";
}

/** Convenience for call sites that only care about the staff roles. */
export function isStaffRole(role: Role | undefined): boolean {
  return role === "provider" || role === "admin";
}