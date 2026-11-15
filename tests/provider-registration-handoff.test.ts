import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * The provider signup handoff used to stop at `/auth/verify` with no email and
 * no destination, and it never saved the details already typed. These
 * assertions pin the pieces that make the provider journey mirror the patient
 * one: pending email, a destination through confirmation, the real Supabase id,
 * and a draft written into the account's own storage namespace.
 */
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

const provider = read("../app/(app)/provider/register/page.tsx");
const verify = read("../app/auth/verify/page.tsx");
const authForm = read("../components/auth-form.tsx");

test("provider signup remembers the pending email", () => {
  assert.match(provider, /writeAuthPending\(key\)/);
});

test("provider signup sends the email and destination through verification", () => {
  assert.match(provider, /\/auth\/verify\?email=\$\{encodeURIComponent\(key\)\}/);
  assert.match(provider, /next=\$\{encodeURIComponent\("\/provider\/onboarding"\)\}/);
  // The confirmation email carries the same destination.
  assert.match(provider, /next:\s*"\/provider\/onboarding"/);
});

test("the verify screen reads the pending email and destination", () => {
  assert.match(verify, /readAuthPending\(\)\?\.email/);
  assert.match(verify, /searchParams\.get\("email"\)/);
  assert.match(verify, /safeNext\(searchParams\.get\("next"\)\)/);
  assert.match(verify, /navigateOnConfirmed/);
});

test("cloud signup never manufactures a user id", () => {
  assert.doesNotMatch(provider, /userId\s*=\s*uid\(\)/);
  assert.match(provider, /userId:\s*signedUpUserId/);
  assert.match(provider, /if \(!signedUpUserId\)/);
});

test("a confirmation-required signup keeps the draft under the real id", () => {
  assert.match(provider, /function persistDraftForUser\(userId: string\)/);
  assert.match(provider, /readCollectionForUser<ProviderApplication>/);
  assert.match(provider, /writeCollectionForUser\(userId, PROVIDER_APPLICATIONS_KEY/);
  // Written before redirecting, and not for an address that already exists.
  assert.match(provider, /if \(signedUpUserId && !existingAccount\) persistDraftForUser\(signedUpUserId\)/);
  // The ordinary in-session draft path is still used after a session exists.
  assert.match(provider, /persistDraftForUser\(userId\)/);
});

test("the draft is stored but never presented as submitted", () => {
  // No server call and no status change in the pre-confirmation path.
  assert.doesNotMatch(provider, /saveApplicationToServer/);
  assert.doesNotMatch(provider, /status:\s*"submitted"/);
});

test("an existing-account response is answered neutrally", () => {
  assert.match(provider, /existingAccount/);
  assert.match(provider, /auth_signup_try_signin/);
  // The raw Supabase text is only passed through when it is a real error, not
  // the "already registered" signal.
  assert.match(provider, /already registered/i);
});

test("required fields and consent are still enforced", () => {
  assert.match(provider, /if \(!fullName\.trim\(\)\)/);
  assert.match(provider, /if \(password\.length < 8\)/);
  assert.match(provider, /if \(confirm !== password\)/);
  assert.match(provider, /if \(!category\)/);
  assert.match(provider, /if \(!acceptedTerms \|\| !acceptedPrivacy\)/);
});

test("validation marks fields and points the user at the first problem", () => {
  assert.match(provider, /role="alert"/);
  assert.match(provider, /aria-live="assertive"/);
  assert.match(provider, /function focusFirstError/);
  assert.match(provider, /scrollIntoView\(\{ block: "center", behavior: "smooth" \}\)/);
  assert.match(provider, /errorId=\{`\$\{FIELD_IDS\.fullName\}-error`\}/);
  assert.match(provider, /aria-invalid=\{errors\.category \? true : undefined\}/);
  assert.match(provider, /aria-describedby=\{errors\.consent \? "provider-register-consent-error" : undefined\}/);
});

test("the shared auth field wires aria state from its error", () => {
  assert.match(authForm, /aria-invalid=\{props\["aria-invalid"\] \?\? \(error \? true : undefined\)\}/);
  assert.match(authForm, /aria-describedby=\{props\["aria-describedby"\] \?\? \(error \? errorId : undefined\)\}/);
});
