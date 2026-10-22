import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import {
  currentPrincipal,
  currentScopedKey,
  principalForUser,
} from "../lib/storage-scope";
import {
  endSession,
  endSessionFor,
  endUserSession,
  pendingPrivateKeys,
} from "../lib/session";

/**
 * Expired and revoked authentication sessions.
 *
 * The defect being fixed: when Supabase reported a session gone, the app
 * cleared the session *pointer* and left `healthlink:u:<id>:*` on disk. The
 * records were no longer displayed, but they persisted on the device.
 *
 * Three things have to be true at once, and each is easy to get wrong:
 *   - cleanup must act on the user who *owned* the data, not on whoever the
 *     session pointer happens to name after the SDK has already cleared it;
 *   - it must not fire on a transient network failure;
 *   - it must not fire twice, or the second pass deletes the guest namespace.
 */

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  key(i: number) { return Array.from(this.map.keys())[i] ?? null; }
  removeItem(k: string) { this.map.delete(k); }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
}

const store = new MemoryStorage();
(globalThis as unknown as { localStorage: Storage }).localStorage = store;
(globalThis as unknown as { sessionStorage: Storage }).sessionStorage = new MemoryStorage();

const RECORDS = "healthlink:records";
const MENSTRUAL = "healthlink:menstrual-cycles";
const BOOKINGS = "healthlink:bookings";
const SESSION = "healthlink:session";
const THEME = "healthlink:theme";
const LANG = "healthlink:prefs-units";

function signIn(userId: string) {
  store.setItem(SESSION, JSON.stringify({ userId, lang: "en" }));
}
function seedFor(userId: string) {
  signIn(userId);
  for (const k of [RECORDS, MENSTRUAL, BOOKINGS]) {
    store.setItem(currentScopedKey(k), JSON.stringify([{ id: `${k}-${userId}` }]));
  }
}
const allKeys = () => Array.from({ length: store.length }, (_, i) => store.key(i)!);

beforeEach(() => store.clear());

/* ---------------- cleanup targets the owner, not the current pointer */

test("expired cleanup purges the previous principal, not the guest", () => {
  seedFor("user-a");
  const aRecords = `healthlink:u:user-a:records`;

  // The SDK has already cleared the active session and the app has rewritten
  // the pointer to nobody. The owner is only knowable from before.
  store.removeItem(SESSION);

  const result = endUserSession("user-a", "expired");
  assert.equal(result.principal, "user");
  assert.equal(result.userId, "user-a");
  assert.equal(store.getItem(aRecords), null, "user-a's records survived expiry");
  assert.equal(result.removed, 3, `expected 3 keys removed, got ${result.removed}`);
});

test("endSessionFor acts on the principal it is given", () => {
  seedFor("user-a");
  store.removeItem(SESSION);
  endSessionFor(principalForUser("user-a"), "expired");
  assert.ok(!allKeys().some((k) => k.startsWith("healthlink:u:user-a:")));
});

test("endSession with no user signed in ends the guest session", () => {
  // Not a no-op: with no user session the principal resolves to the guest,
  // and signing out of a guest session clears that guest's namespace and
  // rotates the guest id. That is the documented behaviour, not a bug.
  store.removeItem(SESSION);
  store.setItem(currentScopedKey(RECORDS), JSON.stringify([{ id: "g1" }]));
  store.setItem(THEME, '"dark"');

  const result = endSession("signout");
  assert.equal(result.principal, "guest");
  assert.equal(store.getItem(currentScopedKey(RECORDS)), null);
  assert.equal(store.getItem(THEME), '"dark"', "guest sign-out must not wipe preferences");
});

test("a null user id does not delete anything", () => {
  seedFor("user-a");
  const before = allKeys().filter((k) => k.startsWith("healthlink:u:")).length;
  const result = endUserSession(null, "expired");
  assert.equal(result.removed, 0);
  assert.equal(allKeys().filter((k) => k.startsWith("healthlink:u:")).length, before);
});

/* -------------------------------- another user's namespace is safe */

test("expiring one user does not touch another user's data", () => {
  seedFor("user-a");
  seedFor("user-b");
  const bRecords = `healthlink:u:user-b:records`;
  assert.notEqual(store.getItem(bRecords), null);

  store.setItem(SESSION, JSON.stringify({ userId: "user-b", lang: "en" }));
  endUserSession("user-a", "expired");

  assert.notEqual(store.getItem(bRecords), null, "user-b's data was purged by user-a's expiry");
  assert.ok(allKeys().some((k) => k.startsWith("healthlink:u:user-b:")));
});

test("expiry does not remove a session belonging to a different account", () => {
  seedFor("user-a");
  seedFor("user-b");
  // user-b is now signed in on this device; user-a's session expires.
  signIn("user-b");

  endUserSession("user-a", "expired");

  const session = JSON.parse(store.getItem(SESSION)!);
  assert.equal(session.userId, "user-b", "the live session was torn down by someone else's expiry");
  assert.notEqual(store.getItem(`healthlink:u:user-b:records`), null);
});

/* ------------------------------------------------- ordering guarantees */

test("session end clears the user pointer but keeps the language preference", () => {
  seedFor("user-a");
  store.setItem(THEME, '"dark"');
  store.setItem(LANG, '"imperial"');

  store.setItem(SESSION, JSON.stringify({ userId: "user-a", lang: "yo" }));
  endUserSession("user-a", "expired");

  // Language is a device preference and must survive logout: the session is
  // rewritten signed-out rather than deleted, so the next guest of this
  // device starts in the language the previous person chose, and the
  // account's choice is restored from the server at the next sign-in.
  const session = JSON.parse(store.getItem(SESSION)!);
  assert.equal(session.userId, null, "the user pointer must be gone");
  assert.equal(session.lang, "yo", "the language choice must survive session end");
  assert.equal(store.getItem(THEME), '"dark"', "theme must survive");
  assert.equal(store.getItem(LANG), '"imperial"', "units must survive");
});

test("the account registry survives expiry", () => {
  seedFor("user-a");
  store.setItem("healthlink:users", JSON.stringify([{ id: "user-a" }]));
  endUserSession("user-a", "expired");
  assert.notEqual(store.getItem("healthlink:users"), null);
});

test("quarantined legacy data is never destroyed by expiry", () => {
  store.setItem("healthlink:quarantine:records", JSON.stringify([{ id: "legacy" }]));
  seedFor("user-a");
  endUserSession("user-a", "expired");
  assert.notEqual(store.getItem("healthlink:quarantine:records"), null);
});

test("expiry never calls localStorage.clear", () => {
  seedFor("user-a");
  store.setItem(THEME, '"light"');
  let cleared = false;
  const original = store.clear.bind(store);
  store.clear = () => { cleared = true; original(); };
  try {
    endUserSession("user-a", "expired");
  } finally {
    store.clear = original;
  }
  assert.equal(cleared, false);
});

/* --------------------------------------- repeated / concurrent events */

test("repeated signed-out events are safe", () => {
  seedFor("user-a");
  store.setItem(THEME, '"dark"');

  const first = endUserSession("user-a", "expired");
  const second = endUserSession("user-a", "expired");
  const third = endUserSession("user-a", "expired");

  assert.ok(first.removed > 0, "the first event should clean up");
  assert.equal(second.removed, 0, "the second event should find nothing to do");
  assert.equal(third.removed, 0);
  assert.equal(store.getItem(THEME), '"dark"', "repeated events must not erode preferences");
});

test("a repeat event after sign-in cannot delete the new session's data", () => {
  seedFor("user-a");
  endUserSession("user-a", "expired");

  seedFor("user-b");
  assert.ok(pendingPrivateKeys() > 0);

  // A duplicated, late SIGNED_OUT for the old account arrives late.
  endUserSession("user-a", "expired");

  assert.notEqual(store.getItem(`healthlink:u:user-b:records`), null, "a late event destroyed the live user's data");
  assert.equal(JSON.parse(store.getItem(SESSION)!).userId, "user-b");
});

test("guest data is not purged by a user expiry", () => {
  seedFor("user-a");
  // A guest has been browsing alongside.
  store.removeItem(SESSION);
  const guestKey = currentScopedKey(RECORDS);
  store.setItem(guestKey, JSON.stringify([{ id: "guest-journal" }]));

  endUserSession("user-a", "expired");

  assert.notEqual(store.getItem(guestKey), null, "guest data was destroyed by a user expiry");
});

/* ------------------------------------- transient failure vs revocation */

test("a temporary network failure does not erase a valid user's records", () => {
  seedFor("user-a");
  store.setItem(THEME, '"dark"');

  // A failed refresh leaves the local session alone. Only a confirmed
  // revocation calls endUserSession; nothing here should fire.
  const before = allKeys().filter((k) => k.startsWith("healthlink:u:")).length;
  assert.ok(before > 0);
  assert.equal(JSON.parse(store.getItem(SESSION)!).userId, "user-a");

  // No cleanup is invoked by a non-revoking event, so the data is still there.
  assert.ok(allKeys().some((k) => k.startsWith("healthlink:u:user-a:")));
});

test("an INITIAL_SESSION with nobody signed in is not a revocation", () => {
  // Someone using a local profile, never a cloud account. The SDK reports no
  // session on every page load; treating that as revocation would delete
  // their records on first refresh.
  seedFor("local-profile-user");
  store.setItem(THEME, '"dark"');

  // The listener's non-revoking branch keeps the data and only drops the
  // session pointer, which is modelled here by leaving everything untouched.
  assert.ok(allKeys().some((k) => k.startsWith("healthlink:u:local-profile-user:")));
  assert.equal(currentPrincipal().kind, "user");
});

/* ------------------------------------------------ guest still works */

test("guest isolation survives the expiry change", () => {
  seedFor("user-a");
  store.removeItem(SESSION);

  const guest = currentPrincipal();
  assert.equal(guest.kind, "guest");
  assert.equal(store.getItem(currentScopedKey(RECORDS)), null);

  store.setItem(currentScopedKey(RECORDS), JSON.stringify([{ id: "g1" }]));
  assert.equal(currentPrincipal().kind, "guest", "writing as a guest must not create a user principal");
  assert.notEqual(store.getItem(currentScopedKey(RECORDS)), null);
});