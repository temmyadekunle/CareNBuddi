import assert from "node:assert/strict";
import test from "node:test";

import { newApplication, type ProviderApplication } from "./provider-application";
import {
  canAccessProviderWorkspace,
  landingPathFor,
  providerAccessRefusal,
  providerLandingPath,
  providerRegisterEntry,
} from "./post-auth";

const NOW = "2026-10-13T10:00:00.000Z";
const CONSUMER = { id: "u1", role: "consumer" as const };
const PROVIDER = { id: "u2", role: "provider" as const };
const ADMIN = { id: "u3", role: "admin" as const };

function app(over: Partial<ProviderApplication> = {}): ProviderApplication {
  return { ...newApplication({ id: "a1", userId: "u2", email: "p@example.com", now: NOW }), ...over };
}

test("a patient lands on the patient home screen", () => {
  assert.equal(landingPathFor(CONSUMER, null), "/app");
});

test("an admin lands on the admin console", () => {
  assert.equal(landingPathFor(ADMIN, null), "/admin");
});

test("a provider resumes onboarding rather than being dropped at sign-in", () => {
  assert.equal(landingPathFor(PROVIDER, null), "/provider/onboarding");
  assert.equal(
    landingPathFor(PROVIDER, app({ acceptedTerms: true, acceptedPrivacy: true })),
    "/provider/onboarding?step=profile",
  );
});

test("a provider who has submitted sees their status, not the workspace", () => {
  assert.equal(landingPathFor(PROVIDER, app({ status: "submitted", submittedAt: NOW })), "/provider/status");
  // Defensive: a record carrying a submission timestamp is treated as submitted
  // even if its status was not advanced.
  assert.equal(landingPathFor(PROVIDER, app({ submittedAt: NOW })), "/provider/status");
});

test("only a verified provider reaches the workspace", () => {
  assert.equal(canAccessProviderWorkspace(app({ status: "under-review" })), false);
  assert.equal(canAccessProviderWorkspace(app({ status: "needs-info" })), false);
  assert.equal(canAccessProviderWorkspace(app({ status: "rejected" })), false);
  assert.equal(canAccessProviderWorkspace(app({ status: "suspended" })), false);
  assert.equal(canAccessProviderWorkspace(app({ status: "verified" })), true);
  assert.equal(canAccessProviderWorkspace(null), false);

  assert.equal(landingPathFor(PROVIDER, app({ status: "under-review" })), "/provider/status");
  assert.equal(landingPathFor(PROVIDER, app({ status: "verified" })), "/provider");
});

test("a rejected or suspended applicant sees their status, never the form again", () => {
  // Regression: these used to fall through to onboarding.
  assert.equal(providerLandingPath(app({ status: "rejected" })), "/provider/status");
  assert.equal(providerLandingPath(app({ status: "suspended" })), "/provider/status");
  assert.equal(providerLandingPath(app({ status: "needs-info" })), "/provider/status");
});

test("no account means the sign-in screen", () => {
  assert.equal(landingPathFor(null, null), "/auth/sign-in");
});

test("a patient is offered the provider application route, not a silent upgrade", () => {
  const refusal = providerAccessRefusal(CONSUMER, null);
  assert.equal(refusal.reason, "not-a-provider");
  assert.equal(refusal.path, "/provider/register");
});

test("a signed-out visitor is sent to sign in with a return path", () => {
  const refusal = providerAccessRefusal(null, null);
  assert.equal(refusal.reason, "signed-out");
  assert.match(refusal.path, /^\/auth\/sign-in\?next=/);
});

test("an unverified provider is pointed at their own status, not the workspace", () => {
  const refusal = providerAccessRefusal(PROVIDER, app({ status: "under-review" }));
  assert.equal(refusal.reason, "awaiting-verification");
  assert.equal(refusal.path, "/provider/status");
});
test("revisiting the registration page never starts a second application", () => {
  // An account that already applied is sent back to where it actually is.
  const entry = providerRegisterEntry({
    account: PROVIDER,
    application: app({ status: "under-review", submittedAt: NOW }),
    emailExists: true,
  });
  assert.equal(entry.action, "resume");
  assert.equal(entry.path, "/provider/status");
});

test("a signed-in applicant with no application skips the account form", () => {
  const entry = providerRegisterEntry({
    account: CONSUMER,
    application: null,
    emailExists: true,
  });
  assert.equal(entry.action, "start");
  assert.equal(entry.path, "/provider/onboarding");
});

test("an email that already has an account is sent to sign in, not registered again", () => {
  const entry = providerRegisterEntry({
    account: null,
    application: null,
    emailExists: true,
  });
  assert.equal(entry.action, "sign-in");
  // The destination survives the detour so they land back on this page, where
  // the signed-in branch performs the upgrade.
  assert.match(entry.path, /^\/auth\/sign-in\?next=/);
  assert.match(decodeURIComponent(entry.path), /next=\/provider\/register/);
});

test("a genuinely new email gets the registration form", () => {
  const entry = providerRegisterEntry({
    account: null,
    application: null,
    emailExists: false,
  });
  assert.equal(entry.action, "create");
  assert.equal(entry.path, "/provider/register");
});

test("a draft applicant is resumed at their first outstanding step", () => {
  const entry = providerRegisterEntry({
    account: PROVIDER,
    application: app({ acceptedTerms: true, acceptedPrivacy: true }),
    emailExists: true,
  });
  assert.equal(entry.action, "resume");
  assert.equal(entry.path, "/provider/onboarding?step=profile");
});
