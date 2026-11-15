import assert from "node:assert/strict";
import test from "node:test";

import { classifySignInFailure } from "../lib/signin-feedback";

/**
 * Sign-in copy must not repeat Supabase's raw message or reveal whether an
 * address is registered. Both "invalid credentials" and "email not confirmed"
 * get credential advice; reachability failures get connection advice.
 */
test("invalid credentials are a credentials failure", () => {
  assert.equal(classifySignInFailure("Invalid login credentials"), "credentials");
});

test("an unconfirmed account still gets credential advice", () => {
  // Supabase only says this after the password was accepted, so it does not
  // enumerate accounts; the advice points at the confirmation email.
  assert.equal(classifySignInFailure("Email not confirmed"), "credentials");
});

test("reachability failures are not blamed on the password", () => {
  for (const message of [
    "Failed to fetch",
    "TypeError: Failed to fetch",
    "Network request failed",
    "Request timed out",
    "You are offline",
  ]) {
    assert.equal(classifySignInFailure(message), "network", message);
  }
});

test("empty or unknown messages fail toward credential guidance", () => {
  assert.equal(classifySignInFailure(""), "credentials");
  assert.equal(classifySignInFailure(null), "credentials");
  assert.equal(classifySignInFailure("Something unexpected"), "credentials");
});
