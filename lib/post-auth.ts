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