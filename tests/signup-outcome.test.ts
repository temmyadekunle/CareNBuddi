import assert from "node:assert/strict";
import test from "node:test";

import { describeSignUpResult } from "../lib/signup-outcome";

/**
 * A Supabase signup with email confirmation on returns a user but no session.
 * The provider flow needs that user's real id; inventing one with `uid()` made
 * the saved draft and the confirmed account disagree.
 */
test("a session supplies the authenticated user id", () => {
  const outcome = describeSignUpResult({
    session: { user: { id: "session-user" } },
    user: { id: "response-user", identities: [{ id: "i1" }] },
  });
  assert.equal(outcome.needsConfirmation, false);
  assert.equal(outcome.userId, "session-user");
  assert.equal(outcome.existingAccount, false);
});

test("confirmation-required returns the response user id without a session", () => {
  const outcome = describeSignUpResult({
    session: null,
    user: { id: "new-user", identities: [{ id: "i1" }] },
  });
  assert.equal(outcome.needsConfirmation, true);
  assert.equal(outcome.userId, "new-user");
  assert.equal(outcome.existingAccount, false);
});

test("an empty identities array marks the existing-account shape", () => {
  const outcome = describeSignUpResult({
    session: null,
    user: { id: "obfuscated", identities: [] },
  });
  assert.equal(outcome.existingAccount, true);
  // The id is still returned as-is; it is Supabase's value, not a local one.
  assert.equal(outcome.userId, "obfuscated");
});

test("missing identities is handled without throwing", () => {
  const outcome = describeSignUpResult({ session: null, user: { id: "u" } });
  assert.equal(outcome.existingAccount, false);
  assert.equal(outcome.userId, "u");
});

test("a response with no user yields no id rather than a fabricated one", () => {
  const outcome = describeSignUpResult({ session: null, user: null });
  assert.equal(outcome.needsConfirmation, true);
  assert.equal(outcome.userId, null);
  assert.equal(outcome.existingAccount, false);
});

test("a missing response is treated as confirmation-required and empty", () => {
  const outcome = describeSignUpResult(undefined);
  assert.deepEqual(outcome, {
    needsConfirmation: true,
    userId: null,
    existingAccount: false,
  });
});
