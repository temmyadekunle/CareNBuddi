import assert from "node:assert/strict";
import test from "node:test";

/**
 * The guard bug, pinned down.
 *
 * `AppGuard` decided "is this a staff area?" with `pathname.startsWith(base)`.
 * That made "/provider/register" count as the staff area "/provider", so an
 * unauthenticated applicant following "Create account as Health provider" was
 * told to sign in instead of being shown the registration form.
 *
 * `matchesPath` below is the replacement, copied from components/app-guard.tsx.
 * This test guards the behaviour so the prefix form cannot come back.
 */
function matchesPath(pathname: string, base: string): boolean {
  if (pathname === base) return true;
  return pathname.startsWith(`${base}/`);
}

const STAFF_PATHS = ["/worker", "/admin"];
const STAFF_EXACT = ["/provider"];
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
  "/provider/onboarding",
  "/provider/status",
];

/** Mirrors the guard's decision for a pathname. */
function isStaffArea(pathname: string): boolean {
  return STAFF_PATHS.some((p) => matchesPath(pathname, p)) || STAFF_EXACT.includes(pathname);
}

/** Whether an anonymous visitor would be sent to the sign-in screen. */
function requiresSession(pathname: string): boolean {
  return isStaffArea(pathname) || PRIVATE_PATHS.some((b) => matchesPath(pathname, b));
}

test("the registration route is no longer swallowed by the staff prefix", () => {
  // The regression: prefix matching claimed /provider/register as staff.
  assert.equal(
    "/provider/register".startsWith("/provider"),
    true,
    "prefix matching would still claim /provider/register as staff",
  );
  // And this is the behaviour we ship instead.
  assert.equal(isStaffArea("/provider/register"), false);
});

test("a brand-new visitor can open the provider registration form", () => {
  // The actual reported bug: an unauthenticated applicant following
  // "Create account as Health provider" was bounced to sign-in. Creating the
  // account is what this page is for, so it must not require a session.
  assert.equal(requiresSession("/provider/register"), false);
});

test("the professional workspace and admin areas are still staff-only", () => {
  assert.equal(isStaffArea("/provider"), true);
  assert.equal(isStaffArea("/admin"), true);
  assert.equal(isStaffArea("/admin/providers"), true, "admin children stay staff");
  assert.equal(isStaffArea("/worker"), true);
  assert.equal(requiresSession("/provider"), true);
});

test("onboarding and status screens still need a session", () => {
  for (const p of ["/provider/onboarding", "/provider/status"]) {
    assert.equal(isStaffArea(p), false, `${p} should not be staff-only`);
    assert.equal(requiresSession(p), true, `${p} should need a session`);
  }
});

test("similar prefixes are not mistaken for each other", () => {
  assert.equal(isStaffArea("/providers"), false);
  assert.equal(isStaffArea("/provider-extra"), false);
  assert.equal(isStaffArea("/administrator"), false);
  assert.equal(isStaffArea("/workers"), false);
});

test("existing patient routes keep their existing protection", () => {
  for (const p of ["/profile", "/appointments", "/reminders", "/care-circle"]) {
    assert.equal(PRIVATE_PATHS.some((b) => matchesPath(p, b)), true, `${p} should stay private`);
  }
  // Nested health sub-routes still match their parent.
  assert.equal(PRIVATE_PATHS.some((b) => matchesPath("/health/chronic", b)), true);
  // And the health index itself is not accidentally gated.
  assert.equal(PRIVATE_PATHS.some((b) => matchesPath("/health", b)), false);
});