/**
 * Where to send a user after they authenticate, and who may enter what.
 *
 * A pure module with no runtime imports — only a type-only import, which is
 * erased before the code runs — so it can be unit tested under plain
 * `node --test` the same way lib/provider-application.ts is. Keeping the routing
 * rules in one place means "provider lands in the right place" is decided once
 * and reused by the sign-in screen, the sign-up screen and the guard screens.
 */

import type { ProviderApplication } from "./provider-application";
import { nextIncompleteStep } from "./provider-application";

export interface AccountLike {
  id: string;
  role: "consumer" | "provider" | "admin";
}

/**
 * Whether the applicant may enter the professional workspace.
 *
 * Requires a verified application. An applicant who is merely waiting, or who
 * has been asked for more information, is not verified and gets the status
 * screen instead.
 */
export function canAccessProviderWorkspace(app: ProviderApplication | null | undefined): boolean {
  return app?.status === "verified";
}

/** Where a provider should land straight after authenticating. */
export function providerLandingPath(app: ProviderApplication | null | undefined): string {
  if (!app) return "/provider/onboarding";
  if (canAccessProviderWorkspace(app)) return "/provider";

  // Only a draft that nobody has looked at resumes onboarding. Any other state
  // — submitted, under review, awaiting information, rejected, suspended —
  // belongs on the status screen, so a decided applicant is never invited
  // straight back into the form.
  if (app.submittedAt || app.status !== "draft") return "/provider/status";

  const step = nextIncompleteStep(app);
  return step ? `/provider/onboarding?step=${step}` : "/provider/status";
}

/**
 * Landing route for a freshly authenticated account.
 *
 * - admin                        → the admin console
 * - provider, verified           → the professional workspace
 * - provider, anything else      → resume onboarding, or the status screen
 * - patient                      → the patient home screen
 */
export function landingPathFor(
  account: AccountLike | null | undefined,
  application: ProviderApplication | null | undefined,
): string {
  if (!account) return "/auth/sign-in";
  if (account.role === "admin") return "/admin";
  if (account.role === "provider") return providerLandingPath(application);
  return "/app";
}

/**
 * What the provider registration screen should do when it opens.
 *
 * Four cases, and getting them right is what stops anyone registering twice:
 *
 * - an account with an application  → resume it, never a second form
 * - a signed-in account with none   → skip straight to onboarding
 * - an email that already exists    → sign in first, on the same account
 * - a genuinely new email           → create the account
 */
export type ProviderRegisterEntry =
  | { action: "resume"; path: string }
  | { action: "start"; path: string }
  | { action: "sign-in"; path: string }
  | { action: "create"; path: string };

export function providerRegisterEntry(args: {
  account: AccountLike | null | undefined;
  application: ProviderApplication | null | undefined;
  /** Whether an account already uses the email being entered. */
  emailExists: boolean;
}): ProviderRegisterEntry {
  const { account, application, emailExists } = args;

  // Already have an application: send them to wherever it actually is. This is
  // what makes re-visiting the registration page safe.
  if (account && application) {
    return { action: "resume", path: providerLandingPath(application) };
  }

  // Signed in but never applied — no need to ask for the account again.
  if (account) {
    return { action: "start", path: "/provider/onboarding" };
  }

  // The address belongs to somebody. Send them to sign in on that same account
  // and come straight back, rather than creating a second one.
  if (emailExists) {
    return {
      action: "sign-in",
      path: `/auth/sign-in?next=${encodeURIComponent("/provider/register")}`,
    };
  }

  return { action: "create", path: "/provider/register" };
}

/**
 * Why a provider-only screen refused the current account, and where to go
 * instead. A patient is offered the provider application route on their
 * existing account; they are never silently upgraded.
 */
export function providerAccessRefusal(
  account: AccountLike | null | undefined,
  application: ProviderApplication | null | undefined,
): { reason: "signed-out" | "not-a-provider" | "awaiting-verification"; path: string } {
  if (!account) {
    return { reason: "signed-out", path: `/auth/sign-in?next=${encodeURIComponent("/provider")}` };
  }
  if (account.role !== "provider") {
    return { reason: "not-a-provider", path: "/provider/register" };
  }
  if (!canAccessProviderWorkspace(application)) {
    return { reason: "awaiting-verification", path: providerLandingPath(application) };
  }
  return { reason: "awaiting-verification", path: "/provider" };
}