import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * The offline sign-in vulnerability, pinned shut.
 *
 * CareNBuddi shipped a sign-in that looked the account up by email and set a
 * session without reading `password`, so knowing an email address was enough
 * to reach that account's health records. The same class of bug existed as a
 * sign-up "existing account" branch and as a demo-role switcher on /account.
 *
 * The fix was removal, not repair: there is nothing trusted to check a password
 * against on the client, so a client-side comparison would have been theatre.
 * These tests read the source so the vulnerable code cannot quietly come back.
 */

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

const signIn = read("../app/auth/sign-in/page.tsx");
const signUp = read("../app/auth/sign-up/page.tsx");
const account = read("../app/(app)/account/page.tsx");

/* -------------------------------------------------- the removed path */

test("signInOffline no longer exists anywhere", () => {
  for (const [name, src] of [
    ["sign-in", signIn],
    ["sign-up", signUp],
    ["account", account],
  ] as const) {
    assert.doesNotMatch(src, /signInOffline/, `${name} reintroduced signInOffline`);
  }
});

test("sign-in never resolves an account by email into a session", () => {
  // The original shape was:
  //   const existing = users.find(u => u.email.toLowerCase() === key)
  //   setSession(prev => ({ ...prev, userId: existing.id }))
  // The only email lookup left chooses the landing route after a real Supabase
  // sign-in, and it never touches the session.
  assert.doesNotMatch(signIn, /userId:\s*existing\.id/);
  assert.doesNotMatch(signIn, /setSession\([^)]*userId/);
  assert.match(signIn, /cloud\.signIn\(email, password\)/);
});

test("sign-in does not fall back to a local session when cloud is absent", () => {
  // No "if (cloudMode) { sign in } else { local sign in }" shape.
  assert.doesNotMatch(signIn, /if\s*\(\s*cloudMode\s*\)\s*\{[^}]*\}\s*else\s*\{[^}]*setSession/);
});

test("sign-in refuses rather than accepting any password", () => {
  assert.match(signIn, /!cloudMode/);
  assert.match(signIn, /auth_signin_unavailable/);
});

/* ------------------------------------------ same bug, in sign-up */

test("sign-up cannot claim an existing account", () => {
  // Duplicating an email used to overwrite the victim's phone number and adopt
  // their account. It must now be refused.
  assert.doesNotMatch(signUp, /userId:\s*existing\.id/);
  assert.match(signUp, /auth_signup_exists/);
});

test("sign-up does not claim a secure account was created", () => {
  // "You are signed in" / "Account created" are both false offline.
  assert.doesNotMatch(signUp, /alreadyRegistered/);
  assert.match(signUp, /auth_local_profile_created/);
});

/* --------------------------- demonstration accounts and fake codes */

test("the demo-role switcher is gone", () => {
  // It set the session directly to seeded ids, including an admin.
  assert.doesNotMatch(account, /const demo\s*=/);
  assert.doesNotMatch(account, /demo\(d\.id\)/);
});

test("the account page no longer mints and displays a verification code", () => {
  assert.doesNotMatch(account, /randomCode/);
  assert.doesNotMatch(account, /a_demo_mode/);
  assert.doesNotMatch(account, /setSentCode/);
});

test("the account page no longer signs in by email", () => {
  assert.doesNotMatch(account, /userId:\s*existing\.id/);
  assert.doesNotMatch(account, /const finish\s*=/);
  assert.match(account, /AuthUnavailableNote/);
});

/* ------------------------------------- cloud stays off in this build */

test("cloud is not configured, so no credential path is reachable", () => {
  // Guards the premise the whole fix rests on. If this ever becomes true the
  // real Supabase path takes over and these tests stop describing production.
  assert.doesNotMatch(signIn, /NEXT_PUBLIC_SUPABASE/, "sign-in must not hardcode Supabase config");
});

/* --------------------------------------------- preferences preserved */

test("sign-out does not wipe unrelated preferences", () => {
  // Fixing sign-in must not have become "delete everything": theme and
  // language are device preferences, not user data.
  const offenders = [account, signIn].filter((s) => /localStorage\.clear\(/.test(s));
  assert.deepEqual(offenders, [], "an auth screen is calling localStorage.clear()");
});