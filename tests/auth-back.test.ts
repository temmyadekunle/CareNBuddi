import assert from "node:assert/strict";
import test from "node:test";

import { headerBackFor } from "../lib/auth-back";

/**
 * The auth header used to point at "/app" on every screen: a patient
 * dashboard, not the "Back to CareNBuddi" the label promised, and a second
 * back arrow on screens that already had one pointing somewhere else. These
 * tests pin the mapping down so it cannot drift back.
 */

/** Screens that are under app/auth, and so share the header. */
const AUTH_SCREENS = [
  "/auth/choice",
  "/auth/sign-in",
  "/auth/sign-up",
  "/auth/sign-in/role",
  "/auth/sign-up/role",
  "/auth/verify",
  "/auth/forgot-password",
];

/** Every screen under app/auth that exists in the tree. */
const EXISTING = new Set(AUTH_SCREENS);

test("every auth screen has a decided outcome", () => {
  for (const screen of AUTH_SCREENS) {
    // headerBackFor returns null for "no header arrow", which is a decision.
    assert.doesNotThrow(() => headerBackFor(screen), screen);
  }
});

test("the arrow returns to the previous step in the flow", () => {
  // Onboarding finishes by pushing /auth/choice, so onboarding is its parent.
  assert.equal(headerBackFor("/auth/choice"), "/onboarding");
  // Sign-in and sign-up are always entered by picking a role first.
  assert.equal(headerBackFor("/auth/sign-in"), "/auth/sign-in/role");
  assert.equal(headerBackFor("/auth/sign-up"), "/auth/sign-up/role");
});

test("screens with their own back link do not get a second one", () => {
  // Each of these renders "Back" or "Back to sign in" in the page body. Two
  // back arrows on one screen, pointing at different places, is the bug.
  for (const screen of [
    "/auth/sign-in/role",
    "/auth/sign-up/role",
    "/auth/verify",
    "/auth/forgot-password",
  ]) {
    assert.equal(headerBackFor(screen), null, `${screen} should use its own back link`);
  }
});

test("the arrow never points at the app dashboard", () => {
  // /app is what "Continue as guest" goes to. It is a forward destination, not
  // somewhere you came back from, and it is already the logo's destination.
  for (const screen of AUTH_SCREENS) {
    assert.notEqual(headerBackFor(screen), "/app", `${screen} must not point at /app`);
  }
});

test("the arrow stays inside the sign-in flow", () => {
  for (const screen of EXISTING) {
    const target = headerBackFor(screen);
    if (!target) continue;
    assert.ok(
      target === "/onboarding" || target.startsWith("/auth/"),
      `${screen} points outside the flow at ${target}`,
    );
  }
});

test("unknown screens get no arrow rather than a wrong one", () => {
  assert.equal(headerBackFor("/auth/does-not-exist"), null);
  assert.equal(headerBackFor("/app"), null);
  assert.equal(headerBackFor("/"), null);
});

test("a trailing slash does not drop the arrow", () => {
  // The static export is served with trailing slashes, so this is the shape
  // usePathname() actually returns in production.
  assert.equal(headerBackFor("/auth/choice/"), "/onboarding");
  assert.equal(headerBackFor("/auth/sign-in/"), "/auth/sign-in/role");
  assert.equal(headerBackFor("/auth/sign-up/"), "/auth/sign-up/role");
  // A screen with its own back still must not grow a second one.
  assert.equal(headerBackFor("/auth/verify/"), null);
  assert.equal(headerBackFor("/auth/sign-up/role/"), null);
});