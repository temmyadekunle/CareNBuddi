import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * A Supabase session is already server-verified when `getSession`/`signIn`
 * resolves. The local mirror (`healthlink:session` + `healthlink:users`) is
 * what the route guard and the onboarding page read, so it must be written
 * even when the `profiles` read fails. Previously adoption happened only after
 * `fetchProfile` resolved, so a transient RLS/network failure showed
 * "Sign in to continue" to a validly signed-in provider.
 */
const cloud = readFileSync(new URL("../lib/supabase/cloud.tsx", import.meta.url), "utf8");

function adoptionBeforeFetch(source: string, adoptCall: string, fetchCall: string, label: string) {
  const adopt = source.indexOf(adoptCall);
  const fetch = source.indexOf(fetchCall);
  assert.ok(adopt > -1, `${label}: ${adoptCall} not found`);
  assert.ok(fetch > -1, `${label}: ${fetchCall} not found`);
  assert.ok(adopt < fetch, `${label}: the session must be adopted before the profile read`);
}

test("the restored session is adopted before the profile read", () => {
  adoptionBeforeFetch(cloud, "adoptCloudUser(current, null)", "await fetchProfile(current.id)", "restore");
});

test("auth events adopt the session before the profile read", () => {
  adoptionBeforeFetch(cloud, "adoptCloudUser(next, null)", "fetchProfile(next.id)", "listener");
});

test("password sign-in adopts the session before the profile read", () => {
  adoptionBeforeFetch(cloud, "adoptCloudUser(signedIn, null)", "await fetchProfile(signedIn.id)", "sign-in");
});

test("the role still comes from the profile, never from client metadata", () => {
  assert.match(cloud, /role: profile\?\.role \?\? previous\?\.role \?\? "consumer"/);
  assert.doesNotMatch(cloud, /role:\s*\(?\s*user\.user_metadata\?\.role/);
});

test("a later profile read still replaces the provisional mirror", () => {
  // Every path adopts twice: once from the verified session, once with the
  // profile that supplies the authoritative role/language.
  const withProfile = cloud.match(/adoptCloudUser\((\w+), p\)/g) ?? [];
  assert.ok(withProfile.length >= 3, `expected profile adoption in every path, found ${withProfile.length}`);
});
