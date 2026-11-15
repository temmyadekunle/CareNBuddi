import assert from "node:assert/strict";
import test from "node:test";

import {
  isAdminRoute,
  isPrivateRoute,
  isStaffRoute,
  matchesPath,
  resolveAccessIdentity,
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

test("a provider reaches the workspace but not the administrator console", () => {
  // "Staff" covers both roles; "admin" is a narrower check on top of it. A
  // provider used to satisfy the staff test and reach /admin.
  assert.equal(routeAccess({ pathname: "/provider", user: PROVIDER }), "allow");
  assert.equal(routeAccess({ pathname: "/admin", user: PROVIDER }), "require-staff");
  assert.equal(routeAccess({ pathname: "/admin/providers", user: PROVIDER }), "require-staff");
  assert.equal(routeAccess({ pathname: "/worker", user: PROVIDER }), "require-staff");
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

/* ------------------------------------------- administrator routes */

test("administrator routes match their children", () => {
  assert.equal(isAdminRoute("/admin"), true);
  assert.equal(isAdminRoute("/admin/providers"), true);
  assert.equal(isAdminRoute("/worker"), true);
  assert.equal(isAdminRoute("/administrator"), false);
  assert.equal(isAdminRoute("/provider"), false);
});

test("only an administrator role opens an administrator route", () => {
  assert.equal(routeAccess({ pathname: "/admin", user: ADMIN }), "allow");
  // A hand-made consumer account is not enough even if it reaches staff code.
  assert.equal(routeAccess({ pathname: "/admin/provider-applications", user: CONSUMER }), "require-staff");
});

/* --------------------------------- trusted identity in cloud mode */

const LOCAL_SEEDED_ADMIN: User = {
  id: "seeded-admin",
  name: "Seeded Administrator",
  email: "admin@carenbuddi.ng",
  role: "admin",
  lang: "en",
  createdAt: "",
};

test("a local account claiming admin grants nothing once cloud auth is on", () => {
  // This is the bypass: editing healthlink:users or the local session in a
  // cloud build must not produce an administrator.
  const identity = resolveAccessIdentity({
    cloudEnabled: true,
    cloudReady: true,
    cloudUserId: "supabase-user-1",
    cloudRole: "consumer",
    localSessionUserId: "seeded-admin",
    localUsers: [LOCAL_SEEDED_ADMIN],
  });
  assert.equal(identity.user?.role, "consumer");
  assert.equal(identity.pending, false);
  assert.equal(
    routeAccess({ pathname: "/admin", user: identity.user }),
    "require-staff",
  );
});

test("a local session id is ignored when cloud auth is enabled", () => {
  const identity = resolveAccessIdentity({
    cloudEnabled: true,
    cloudReady: true,
    cloudUserId: null,
    cloudRole: null,
    localSessionUserId: "seeded-admin",
    localUsers: [LOCAL_SEEDED_ADMIN],
  });
  assert.equal(identity.user, undefined);
  assert.equal(identity.pending, false);
  assert.equal(routeAccess({ pathname: "/admin", user: identity.user }), "require-sign-in");
});

test("a missing server role fails closed rather than guessing", () => {
  const identity = resolveAccessIdentity({
    cloudEnabled: true,
    cloudReady: true,
    cloudUserId: "supabase-user-1",
    cloudRole: null,
    localSessionUserId: null,
    localUsers: [LOCAL_SEEDED_ADMIN],
  });
  assert.equal(identity.user, undefined);
  assert.equal(identity.pending, false);
});

test("cloud restore in flight is pending, not signed out", () => {
  const identity = resolveAccessIdentity({
    cloudEnabled: true,
    cloudReady: false,
    cloudUserId: null,
    cloudRole: null,
    localSessionUserId: "seeded-admin",
    localUsers: [LOCAL_SEEDED_ADMIN],
  });
  assert.equal(identity.pending, true);
  assert.equal(identity.user, undefined);
});

test("the server role is what the guard trusts in cloud mode", () => {
  const identity = resolveAccessIdentity({
    cloudEnabled: true,
    cloudReady: true,
    cloudUserId: "supabase-user-1",
    cloudRole: "admin",
    localSessionUserId: null,
    localUsers: [],
  });
  assert.equal(identity.user?.id, "supabase-user-1");
  assert.equal(routeAccess({ pathname: "/admin", user: identity.user }), "allow");
});

test("without cloud auth the demo session still resolves locally", () => {
  // The offline demo is a product feature; its roles grant access to device
  // data only, never to a server resource.
  const identity = resolveAccessIdentity({
    cloudEnabled: false,
    cloudReady: false,
    cloudUserId: null,
    cloudRole: null,
    localSessionUserId: "seeded-admin",
    localUsers: [LOCAL_SEEDED_ADMIN],
  });
  assert.equal(identity.user?.role, "admin");
  assert.equal(identity.pending, false);
});

test("without cloud auth a fabricated session id still resolves to nothing", () => {
  const identity = resolveAccessIdentity({
    cloudEnabled: false,
    cloudReady: false,
    cloudUserId: null,
    cloudRole: null,
    localSessionUserId: "u-attacker",
    localUsers: [LOCAL_SEEDED_ADMIN],
  });
  assert.equal(identity.user, undefined);
});