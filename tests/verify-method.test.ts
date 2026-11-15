import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Which `verifyOtp` type is correct is a fact about the installed SDK, not a
 * naming preference. auth-js 2.x for email OTPs documents `email` as the
 * current type and marks `signup`/`magiclink` as deprecated for verifyOtp;
 * `resend` still requires `signup`. The screen must keep the documented value
 * and must not claim success from a response that carries no user.
 */
const root = new URL("../", import.meta.url);
/** Normalise EOLs so multi-line source excerpts match on CRLF checkouts. */
const read = (rel: string) =>
  readFileSync(new URL(rel, root), "utf8").replace(/\r\n/g, "\n");

const sdkPackage = JSON.parse(
  readFileSync(new URL("node_modules/@supabase/auth-js/package.json", root), "utf8"),
) as { version: string };
const sdkClient = read("node_modules/@supabase/auth-js/dist/module/GoTrueClient.js");
const sdkTypes = read("node_modules/@supabase/auth-js/dist/module/lib/types.d.ts");
const verify = read("app/auth/verify/page.tsx");

test("the installed SDK documents email as the current signup OTP type", () => {
  assert.match(sdkPackage.version, /^2\./);
  assert.match(sdkClient, /signup` and `magiclink` types are deprecated/);
  assert.match(sdkClient, /`email`[^\n]*Used when verifying an OTP sent to the user's email during sign-up or sign-in/);
  assert.match(sdkTypes, /export type EmailOtpType = 'signup' \| 'invite' \| 'magiclink' \| 'recovery' \| 'email_change' \| 'email'/);
});

test("the typed-code path uses the documented type and resend uses signup", () => {
  const start = verify.indexOf("supabase.auth.verifyOtp({\n        email: trimmed");
  assert.ok(start > -1, "typed-code verifyOtp call not found");
  const call = verify.slice(start, verify.indexOf("});", start));
  assert.match(call, /type: "email"/);
  assert.doesNotMatch(call, /type: "signup"/);
  assert.match(verify, /supabase\.auth\.resend\(\{ type: "signup", email: trimmed \}\)/);
});

test("a verification response without a user is not reported as confirmed", () => {
  assert.match(verify, /if \(!data\.user\) \{/);
  const missingUser = verify.slice(verify.indexOf("if (!data.user) {"));
  assert.match(missingUser, /setFormError\(/, "missing user must fail closed");
  // The old fallback marked the page verified and sent the user to /app.
  assert.doesNotMatch(
    missingUser.slice(0, missingUser.indexOf("finishConfirmation")),
    /setVerified\(true\)/,
  );
});
