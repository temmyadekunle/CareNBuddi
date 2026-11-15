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
  "/community",
  "/consultations",
  "/profile",
  "/provider/onboarding",
  "/provider/status",
];

/** Staff areas, matched as an exact path or as a parent of it. */
export const STAFF_PATHS = ["/worker", "/admin"];

/**
 * Administration areas. These are stricter than "staff": a provider account is
 * staff for the professional workspace but must never enter an administrator
 * console. Both lists intentionally overlap so a guest still gets "sign in"
 * rather than "staff only".
 */
export const ADMIN_PATHS = ["/worker", "/admin"];

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

export function isAdminRoute(pathname: string): boolean {
  const path = normalize(pathname);
  return ADMIN_PATHS.some((p) => matchesPath(path, p));
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
 * `user` must come from a trusted source, never straight from local storage.
 * In cloud mode that is the Supabase identity plus the server profile role
 * (see lib/access-identity.ts); only a build without cloud auth may treat the
 * device's demo accounts as identities.
 *
 * Administration routes are checked before the general staff rule: a provider
 * is staff for the professional workspace but is not an administrator, so
 * "provider" must not be enough for /admin or /worker.
 */
export function routeAccess(args: {
  pathname: string;
  user: User | undefined;
}): GateDecision {
  const { pathname, user } = args;

  if (isAdminRoute(pathname)) {
    if (!user) return "require-sign-in";
    return user.role === "admin" ? "allow" : "require-staff";
  }

  if (isStaffRoute(pathname) && user && !isStaffRole(user.role)) return "require-staff";

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

/* ------------------------------------------- trusted identity */

/**
 * The identity a route decision may trust.
 *
 * With cloud authentication configured, the only trusted role is the one the
 * server returns in `profiles.role`; the local mirror of the account supplies
 * display fields only. A hand-edited `healthlink:users` entry therefore cannot
 * turn an account into an administrator.
 *
 * Without cloud authentication this is a device demo, not an account system:
 * the local session and its local role are all there is, and they grant no
 * access to any server resource.
 */
export interface AccessIdentityInput {
  cloudEnabled: boolean;
  cloudReady: boolean;
  cloudUserId: string | null;
  /** `profiles.role`, or null while it is unknown or the read failed. */
  cloudRole: Role | null;
  localSessionUserId: string | null;
  localUsers: User[];
}

export interface AccessIdentity {
  user: User | undefined;
  /** Cloud restored but has not finished; callers should not decide yet. */
  pending: boolean;
}

export function resolveAccessIdentity(input: AccessIdentityInput): AccessIdentity {
  if (!input.cloudEnabled) {
    return {
      user: resolveSessionUser(input.localUsers, input.localSessionUserId),
      pending: false,
    };
  }

  if (!input.cloudReady) return { user: undefined, pending: true };
  if (!input.cloudUserId) return { user: undefined, pending: false };

  const mirrored = input.localUsers.find((u) => u.id === input.cloudUserId);
  /* Signed in, but no server profile. This is the fail-closed case: the
     account exists, yet the only trustworthy role source has not answered, so
     nothing that depends on a role may be treated as authorised. */
  if (!input.cloudRole) return { user: undefined, pending: false };

  return {
    user: {
      id: input.cloudUserId,
      name: mirrored?.name ?? "CareNBuddi Member",
      email: mirrored?.email ?? "",
      phone: mirrored?.phone,
      role: input.cloudRole,
      lang: mirrored?.lang ?? "en",
      createdAt: mirrored?.createdAt ?? "",
    },
    pending: false,
  };
}