import assert from "node:assert/strict";
import test from "node:test";

import {
  isPrivateRoute,
  isStaffRoute,
  matchesPath,
  resolveSessionUser,
  routeAccess,
  type GateDecision,
} from "../lib/auth-guard";
import type { Role, User } from "../lib/types";

/**
 * Route access.
 *
 * The property that matters most: a session value on its own is a claim, not
 * proof. These tests pin that, along with the path-matching bugs that have
 * already bitten this app once.
 */

function user(id: string, role: Role = "consumer"): User {
  return { id, name: `U ${id}`, email: `${id}@qa.test`, role, lang: "en", createdAt: "" };
}

const CONSUMER = user("u-consumer");
const PROVIDER = user("u-provider", "provider");
const ADMIN = user("u-admin", "admin");
const USERS = [CONSUMER, PROVIDER, ADMIN];

/* ------------------------------------------- a claim is not proof */

test("a fabricated session id does not resolve to an account", () => {
  assert.equal(resolveSessionUser(USERS, "u-attacker"), undefined);
  assert.equal(resolveSessionUser(USERS, ""), undefined);
  assert.equal(resolveSessionUser(USERS, null), undefined);
  assert.equal(resolveSessionUser(USERS, undefined), undefined);
});

test("a real session id resolves to that account", () => {
  assert.equal(resolveSessionUser(USERS, "u-consumer")?.role, "consumer");
  assert.equal(resolveSessionUser(USERS, "u-provider")?.role, "provider");
});

test("a fabricated session id cannot open a private route", () => {
  // This is the attack the old guard allowed: any truthy userId string passed.
  const forPrivate: GateDecision = routeAccess({
    pathname: "/profile",
    user: resolveSessionUser(USERS, "u-attacker"),
  });
  assert.equal(forPrivate, "require-sign-in");
});

test("a fabricated session id cannot open a staff route", () => {
  assert.equal(
    routeAccess({ pathname: "/admin", user: resolveSessionUser(USERS, "u-attacker") }),
    "require-sign-in",
  );
  assert.equal(
    routeAccess({ pathname: "/provider", user: resolveSessionUser(USERS, "u-attacker") }),
    "require-sign-in",
  );
});

test("an empty user list gates even a plausible-looking id", () => {
  assert.equal(routeAccess({ pathname: "/profile", user: resolveSessionUser([], "u-consumer") }), "require-sign-in");
});

/* ------------------------------------------------- guest behaviour */

test("a guest is gated from every private route", () => {
  for (const p of ["/profile", "/records", "/journal", "/reminders", "/appointments", "/passport"]) {
    assert.equal(routeAccess({ pathname: p, user: undefined }), "require-sign-in", p);
  }
});

test("a guest is still allowed the public product", () => {
  // Guest access is part of the product and must survive this fix.
  for (const p of ["/app", "/find-care", "/emergency", "/explore", "/health", "/auth/sign-in"]) {
    assert.equal(routeAccess({ pathname: p, user: undefined }), "allow", p);
  }
});

test("a guest cannot be represented as a signed-in patient", () => {
  // No account, no access - and no route turns a guest into a patient.
  assert.equal(routeAccess({ pathname: "/records", user: undefined }), "require-sign-in");
  assert.equal(routeAccess({ pathname: "/care-circle", user: undefined }), "require-sign-in");
});

/* --------------------------------------------------- signed-in users */

test("a signed-in patient reaches their own private routes", () => {
  for (const p of ["/profile", "/records", "/journal", "/appointments"]) {
    assert.equal(routeAccess({ pathname: p, user: CONSUMER }), "allow", p);
  }
});

test("a patient on a staff route is sent to their profile, not to sign-in", () => {
  assert.equal(routeAccess({ pathname: "/admin", user: CONSUMER }), "require-staff");
  assert.equal(routeAccess({ pathname: "/provider", user: CONSUMER }), "require-staff");
});

test("a provider and an admin reach staff routes", () => {
  assert.equal(routeAccess({ pathname: "/provider", user: PROVIDER }), "allow");
  assert.equal(routeAccess({ pathname: "/admin", user: ADMIN }), "allow");
});

/* -------------------------------------- path matching regressions */

test("path matching means 'this path or one beneath it'", () => {
  // matchesPath is a generic containment test: /provider/register IS a
  // descendant of /provider. What keeps it out of the staff area is the exact
  // match below, not this helper.
  assert.equal(matchesPath("/provider", "/provider"), true);
  assert.equal(matchesPath("/provider/register", "/provider"), true);
  assert.equal(matchesPath("/admin/providers", "/admin"), true);
  assert.equal(matchesPath("/profile", "/provider"), false);
  // A raw prefix would wrongly match these - that was the original bug.
  assert.equal(matchesPath("/profiles-archive", "/profile"), false);
  assert.equal(matchesPath("/providerx", "/provider"), false);
});

test("/provider is matched exactly, not by prefix", () => {
  // The regression that sent applicants back to sign-in: treating /provider as
  // a staff prefix made /provider/register a staff route.
  assert.equal(isStaffRoute("/provider"), true);
  assert.equal(isStaffRoute("/provider/register"), false);
  assert.equal(isStaffRoute("/provider/onboarding"), false);
  assert.equal(isStaffRoute("/provider/status"), false);
  assert.equal(isStaffRoute("/providerx"), false);
});

test("/provider/register stays public so applicants are not locked out", () => {
  // Reached by the "Create account as Healthcare provider" link. Gating it
  // locked out exactly the person who needs it.
  assert.equal(isPrivateRoute("/provider/register"), false);
  assert.equal(isStaffRoute("/provider/register"), false);
  assert.equal(routeAccess({ pathname: "/provider/register", user: undefined }), "allow");
});

test("/provider/onboarding and /provider/status stay gated", () => {
  assert.equal(isPrivateRoute("/provider/onboarding"), true);
  assert.equal(isPrivateRoute("/provider/status"), true);
  assert.equal(routeAccess({ pathname: "/provider/onboarding", user: undefined }), "require-sign-in");
});

test("staff areas match their children", () => {
  assert.equal(isStaffRoute("/admin/providers"), true);
  assert.equal(isStaffRoute("/worker"), true);
  assert.equal(isStaffRoute("/provider/patients"), false);
});

test("a trailing slash does not change the decision", () => {
  // The static export is served with trailing slashes.
  assert.equal(routeAccess({ pathname: "/profile/", user: undefined }), "require-sign-in");
  assert.equal(routeAccess({ pathname: "/provider/", user: undefined }), "require-sign-in");
  assert.equal(routeAccess({ pathname: "/app/", user: undefined }), "allow");
});