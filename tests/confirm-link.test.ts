import assert from "node:assert/strict";
import test from "node:test";
import {
  detectConfirmLink,
  safeNext,
  scrubConfirmParams,
} from "../lib/auth-confirm-link";
import type { ProviderApplication } from "../lib/provider-application";
import { landingPathFor } from "../lib/post-auth";

test("safeNext accepts same-site paths only", () => {
  assert.equal(safeNext("/provider/onboarding"), "/provider/onboarding");
  assert.equal(safeNext("/app?step=2"), "/app?step=2");
  assert.equal(safeNext(null), null);
  assert.equal(safeNext(""), null);
  assert.equal(safeNext("https://evil.example/app"), null);
  assert.equal(safeNext("//evil.example/app"), null);
  assert.equal(safeNext("/\\evil.example/app"), null);
  assert.equal(safeNext("\\evil.example"), null);
  // URLSearchParams hands safeNext an already-decoded value, so %5C arrives as a raw backslash:
  assert.equal(safeNext("/app\\evil"), null);
  assert.equal(safeNext("/app\u0000"), null);
  assert.equal(safeNext("/app\u0007zone"), null);
  assert.equal(safeNext(" /relative"), null);
});

test("ordinary URLs are not confirmation callbacks", () => {
  for (const href of [
    "https://app.example/auth/verify",
    "https://app.example/auth/verify?next=/app",
    "https://app.example/auth/verify#not-a-token",
    "not a url at all",
  ]) {
    assert.deepEqual(detectConfirmLink(href), { kind: "none" }, href);
  }
});

test("implicit-grant confirmation links are detected by hash shape", () => {
  const href =
    "https://app.example/auth/verify#access_token=SECRET&refresh_token=SECRET&expires_in=3600&token_type=bearer&type=signup";
  assert.deepEqual(detectConfirmLink(href), { kind: "implicit" });
});

test("implicit-grant material is always treated as a callback attempt", () => {
  // Detection is deliberately lenient (any session token in the hash implies a
  // callback); whether the token set is complete/valid is the Supabase
  // client's job — it verifies them server-side and rejects the rest.
  assert.deepEqual(detectConfirmLink("https://app.example/x#access_token=SECRET&type=signup"), {
    kind: "implicit",
  });
});

test("otp-hash links are detected with an allowed type", () => {
  assert.deepEqual(
    detectConfirmLink("https://app.example/auth/verify?token_hash=HASH123&type=signup&next=%2Fapp"),
    { kind: "otp-hash", tokenHash: "HASH123", type: "signup" },
  );
  assert.deepEqual(
    detectConfirmLink("https://app.example/auth/verify?token_hash=HASH123&type=email"),
    { kind: "otp-hash", tokenHash: "HASH123", type: "email" },
  );
  // type omitted defaults to signup, matching Supabase's templates
  assert.deepEqual(detectConfirmLink("https://app.example/auth/verify?token_hash=H"), {
    kind: "otp-hash",
    tokenHash: "H",
    type: "signup",
  });
});

test("token-hash links with unusable types are rejected", () => {
  for (const type of ["recovery", "magiclink", "invite", "email_change", "banana"]) {
    assert.equal(
      detectConfirmLink(`https://app.example/auth/verify?token_hash=H&type=${type}`).kind,
      "error",
      type,
    );
  }
  // A verification of e.g. a recovery link must never be able to finish a signup.
  assert.equal(detectConfirmLink("https://app.example/auth/verify?token_hash=H&type=recovery").kind, "error");
});

test("error callbacks are detected and never reflected into a session", () => {
  for (const param of ["error", "error_description", "error_code"]) {
    assert.equal(detectConfirmLink(`https://app.example/auth/verify?${param}=nope`).kind, "error");
  }
});

test("scrubbing removes every token-shaped parameter but keeps next", () => {
  const scrubbed = scrubConfirmParams(
    "https://app.example/auth/verify?token_hash=SECRET&type=signup&next=%2Fprovider%2Fstatus&email=user%40example.com",
  );
  const url = new URL(scrubbed);
  assert.equal(url.searchParams.get("token_hash"), null);
  assert.equal(url.searchParams.get("type"), null);
  assert.equal(url.searchParams.get("email"), null);
  assert.equal(url.hash, "");
  assert.equal(url.searchParams.get("next"), "/provider/status");
});

test("scrubbing removes implicit-grant hash material entirely", () => {
  const scrubbed = scrubConfirmParams(
    "https://app.example/auth/verify#access_token=SECRET&refresh_token=SECRET&expires_in=3600&token_type=bearer",
  );
  const url = new URL(scrubbed);
  assert.equal(url.hash, "");
  assert.equal(url.search, "");
});

test("scrubbing removes error and PKCE-code parameters", () => {
  const scrubbed = scrubConfirmParams(
    "https://app.example/auth/verify?error=access_denied&error_code=403&code=X",
  );
  for (const field of ["error", "error_code", "code", "error_description"]) {
    assert.equal(new URL(scrubbed).searchParams.get(field), null, field);
  }
});

test("scrubbing a malformed URL is a no-op", () => {
  assert.equal(scrubConfirmParams(":: nonsense ::"), ":: nonsense ::");
});

/**
 * Landing after confirmation is decided by the same rules as sign-in, so a
 * link-confirmed provider cannot strand on a patient screen. These assertions
 * pin the composition the verify screen relies on.
 */
test("post-confirmation landing is role-aware", () => {
  assert.equal(landingPathFor({ id: "u", role: "consumer" }, null), "/app");
  assert.equal(landingPathFor({ id: "u", role: "provider" }, null), "/provider/onboarding");
  assert.equal(
    landingPathFor({ id: "u", role: "provider" }, makeApplication({ status: "verified" })),
    "/provider",
  );
});

function makeApplication(overrides: Partial<ProviderApplication>): ProviderApplication {
  return {
    status: "draft",
    submittedAt: null,
    ...overrides,
  } as ProviderApplication;
}
