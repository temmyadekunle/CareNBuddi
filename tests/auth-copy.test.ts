import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Supabase answers a signup for an existing address with the same shape as a
 * new signup (empty `identities`), and no confirmation email is sent. The
 * screens therefore cannot promise that an email is on its way; the copy has
 * to read correctly in both cases without revealing which one happened.
 */
const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

const i18n = read("../lib/i18n.ts");
const provider = read("../app/(app)/provider/register/page.tsx");
const signUp = read("../app/auth/sign-up/page.tsx");
const verify = read("../app/auth/verify/page.tsx");

test("the signup toast is neutral about whether an email was sent", () => {
  assert.match(i18n, /auth_check_email:\s*"If this address needs confirming, check your inbox\."/);
  assert.doesNotMatch(i18n, /auth_check_email:\s*"Check your email to confirm your account"/);
  for (const page of [provider, signUp]) {
    assert.match(page, /If this address needs confirming, check your inbox\./);
    assert.doesNotMatch(page, /Check your email to confirm your account/);
  }
});

test("the verify screen does not claim an email or a code was sent", () => {
  assert.match(
    i18n,
    /auth_verify_sub:\s*"If we sent a confirmation to this address, open its link or enter the 6-digit code it contains\."/,
  );
  assert.doesNotMatch(i18n, /We sent a confirmation link and a 6-digit code/);
  // Resending has the same anti-enumeration property.
  assert.match(i18n, /auth_resent:\s*"If this address needs confirming, a new code is on its way\."/);
});

test("the localised copy makes the same neutral statement", () => {
  for (const dict of ["yo", "ha", "ig"]) {
    const source = read(`../lib/dict/${dict}.ts`);
    assert.doesNotMatch(
      source,
      /auth_check_email: "[^"]*(Duba imel|Lelee ozi-e|Ṣàyẹ̀wò àpò ìmẹ̀lẹ̀ rẹ láti)/,
      `${dict} still tells the user to confirm an account`,
    );
    assert.match(source, /auth_check_email: "[^"]*(bá nílò ìfìdí|yana buƙatar tabbatarwa|chọrọ nkwenye)/, dict);
    assert.match(source, /auth_verify_sub: "[^"]*(Bí a bá|Idan mun aika|Ọ bụrụ na anyị ezitela)/, dict);
  }
});

test("the verify screen promotes the sign-in route and keeps the pending address", () => {
  assert.match(verify, /<Link[\s\S]{0,200}href=\{[\s\S]{0,200}\/auth\/sign-in\?email=\$\{encodeURIComponent\(email\.trim\(\)\)\}/);
  assert.match(verify, /auth_verify_hint/);
});
