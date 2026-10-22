import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import {
  QUARANTINE_NS,
  currentPrincipal,
  currentScopedKey,
  isPrivateKey,
  keysForPrincipal,
  migrationComplete,
  purgePrincipal,
  quarantineLegacyData,
  recoverQuarantinedFor,
  scopedKey,
  type Principal,
} from "../lib/storage-scope";
import { endSession, pendingPrivateKeys } from "../lib/session";

/**
 * Storage isolation.
 *
 * The failure being prevented: two people share a phone, or one person signs
 * out and signs in as somebody else, and the second sees the first's records.
 *
 * These tests drive the same helpers the app uses, against a fake localStorage,
 * so they exercise the real key resolution rather than a copy of it.
 */

/** Minimal localStorage stand-in. Node has no DOM. */
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

const KEYS = {
  records: "healthlink:records",
  journal: "healthlink:journal",
  menstrual: "healthlink:menstrual-cycles",
  mood: "healthlink:mood-entries",
  reminders: "healthlink:reminders",
  bookings: "healthlink:bookings",
  careCircle: "healthlink:care-circle",
  photos: "healthlink:profile-photos",
  support: "healthlink:support-messages",
  applications: "healthlink:provider-applications",
  practice: "healthlink:practice-settings",
  // device-scoped
  theme: "healthlink:theme",
  units: "healthlink:prefs-units",
  users: "healthlink:users",
  session: "healthlink:session",
};

function signInAs(userId: string) {
  store.setItem(KEYS.session, JSON.stringify({ userId, lang: "en" }));
}
function signOutRaw() {
  store.removeItem(KEYS.session);
}

beforeEach(() => {
  store.clear();
  // The migration flag is sticky in a real browser; clearing it here keeps the
  // quarantine tests independent.
});

/* ------------------------------------------------ classification */

test("health and identity collections are private", () => {
  for (const k of [
    KEYS.records, KEYS.journal, KEYS.menstrual, KEYS.mood, KEYS.reminders,
    KEYS.bookings, KEYS.careCircle, KEYS.photos, KEYS.support,
    KEYS.applications, KEYS.practice,
  ]) {
    assert.equal(isPrivateKey(k), true, `${k} should be private`);
  }
});

test("preferences, catalogues and the account registry are not private", () => {
  for (const k of [KEYS.theme, KEYS.units, KEYS.users, KEYS.session]) {
    assert.equal(isPrivateKey(k), false, `${k} should not be private`);
  }
});

/* ------------------------------------------- 1. guest vs signed-in */

test("a guest never reads a signed-in user's records", () => {
  signInAs("user-a");
  const scopedA = currentScopedKey(KEYS.records);
  store.setItem(scopedA, JSON.stringify([{ id: "r1", title: "Patient A blood panel" }]));

  signOutRaw(); // become a guest
  const guestKey = currentScopedKey(KEYS.records);
  assert.notEqual(guestKey, scopedA);
  assert.equal(store.getItem(guestKey), null, "guest must not see the user's records");

  // And the user's data is untouched, just not reachable.
  assert.equal(store.getItem(scopedA), JSON.stringify([{ id: "r1", title: "Patient A blood panel" }]));
});

test("a guest writes only to the guest namespace", () => {
  signOutRaw();
  store.setItem(currentScopedKey(KEYS.journal), JSON.stringify([{ id: "j1" }]));
  const keys = Array.from({ length: store.length }, (_, i) => store.key(i)!);
  assert.ok(keys.some((k) => k.startsWith("healthlink:guest:")));
  assert.ok(!keys.some((k) => k.startsWith("healthlink:u:")));
});

/* --------------------------------------------- 2. user A vs user B */

test("one account cannot read another account's namespaced data", () => {
  signInAs("user-a");
  const keyA = currentScopedKey(KEYS.records);
  store.setItem(keyA, JSON.stringify([{ id: "a1", title: "A's lab result" }]));

  signInAs("user-b");
  const keyB = currentScopedKey(KEYS.records);
  assert.notEqual(keyA, keyB);
  assert.equal(store.getItem(keyB), null, "B must not see A's records");
  assert.equal(
    store.getItem(currentScopedKey(KEYS.menstrual)),
    null,
    "B must not see A's cycle history",
  );
});

/* ----------------------------------------- 3. switching sessions */

test("user B does not see user A's records after a session switch", () => {
  signInAs("user-a");
  for (const k of [KEYS.records, KEYS.menstrual, KEYS.mood, KEYS.bookings]) {
    store.setItem(currentScopedKey(k), JSON.stringify([{ id: `${k}-a`, title: "A private" }]));
  }

  // Switch without signing out first - the worst case for a stale cache.
  signInAs("user-b");
  for (const k of [KEYS.records, KEYS.menstrual, KEYS.mood, KEYS.bookings]) {
    assert.equal(store.getItem(currentScopedKey(k)), null, `B saw A's ${k}`);
  }

  // Switch back: A's data is still theirs, just not while B is signed in.
  signInAs("user-a");
  assert.notEqual(store.getItem(currentScopedKey(KEYS.records)), null);
});

/* --------------------------------------------- 4. sign-out clears */

test("sign-out removes private information from the device", () => {
  signInAs("user-a");
  for (const k of [KEYS.records, KEYS.journal, KEYS.menstrual, KEYS.bookings, KEYS.photos]) {
    store.setItem(currentScopedKey(k), JSON.stringify([{ id: "x", title: "private" }]));
  }
  assert.ok(pendingPrivateKeys() > 0);

  const result = endSession("signout");
  assert.equal(result.principal, "user");
  assert.ok(result.removed >= 5, `expected >=5 removed, got ${result.removed}`);

  const keys = Array.from({ length: store.length }, (_, i) => store.key(i)!);
  assert.ok(!keys.some((k) => k.startsWith("healthlink:u:")), "a user namespace survived sign-out");
  // The session is rewritten signed-out (userId null), not deleted: the
  // language preference must survive logout. No user namespace may remain.
  const session = JSON.parse(store.getItem(KEYS.session)!);
  assert.equal(session.userId, null, "sign-out must clear the user pointer");
});

test("sign-out purges the guest namespace and rotates the guest id", () => {
  signOutRaw();
  store.setItem(currentScopedKey(KEYS.records), JSON.stringify([{ id: "g1" }]));
  const firstGuestId = currentPrincipal().kind === "guest"
    ? (currentPrincipal() as { guestId: string }).guestId
    : "";

  endSession("signout");

  const second = currentPrincipal();
  assert.equal(second.kind, "guest");
  assert.notEqual(
    (second as { guestId: string }).guestId,
    firstGuestId,
    "the next guest must start from a new namespace",
  );
  assert.equal(store.getItem(currentScopedKey(KEYS.records)), null);
});

/* ------------------------------------ 5. preferences survive sign-out */

test("non-sensitive preferences survive sign-out", () => {
  signInAs("user-a");
  store.setItem(KEYS.theme, '"dark"');
  store.setItem(KEYS.units, '"imperial"');
  store.setItem(KEYS.users, JSON.stringify([{ id: "user-a", email: "a@qa.test" }]));
  store.setItem(currentScopedKey(KEYS.records), JSON.stringify([{ id: "r1" }]));

  endSession("signout");

  assert.equal(store.getItem(KEYS.theme), '"dark"', "theme must survive");
  assert.equal(store.getItem(KEYS.units), '"imperial"', "units must survive");
  assert.notEqual(store.getItem(KEYS.users), null, "the account registry must survive");
  assert.equal(store.getItem(currentScopedKey(KEYS.records)), null, "records must not");
});

test("sign-out never calls localStorage.clear", () => {
  signInAs("user-a");
  store.setItem(KEYS.theme, '"light"');
  let cleared = false;
  const original = store.clear.bind(store);
  store.clear = () => { cleared = true; original(); };
  try {
    endSession("signout");
  } finally {
    store.clear = original;
  }
  assert.equal(cleared, false, "sign-out must not wipe unrelated preferences");
});

/* --------------------------------- 6. legacy records are quarantined */

test("legacy unscoped records are not attributed to a new user", () => {
  // Someone used the app before namespacing existed.
  store.setItem(KEYS.records, JSON.stringify([{ id: "old", title: "legacy panel" }]));
  store.setItem(KEYS.menstrual, JSON.stringify([{ id: "old-cycle" }]));
  signInAs("brand-new-user");

  quarantineLegacyData();

  // The new account must not inherit them.
  assert.equal(store.getItem(currentScopedKey(KEYS.records)), null, "legacy records leaked to a new account");
  assert.equal(store.getItem(currentScopedKey(KEYS.menstrual)), null);
  // They are preserved, not destroyed.
  assert.notEqual(store.getItem(`${QUARANTINE_NS}records`), null, "legacy data must not be lost");
  assert.notEqual(store.getItem(`${QUARANTINE_NS}menstrual-cycles`), null);
  // And no ordinary screen reads them.
  assert.equal(store.getItem(KEYS.records), null, "legacy key must be gone from the live namespace");
});

test("legacy data is never exposed to a guest", () => {
  store.setItem(KEYS.journal, JSON.stringify([{ id: "old", title: "legacy journal" }]));
  signOutRaw();
  quarantineLegacyData();
  assert.equal(store.getItem(currentScopedKey(KEYS.journal)), null);
  assert.equal(migrationComplete(), true);
});

/* -------------------------------------- 7. malformed ownership fails closed */

test("a malformed session fails closed to the guest namespace", () => {
  for (const bad of [
    "{not json",
    "null",
    "[]",
    JSON.stringify({ userId: null }),
    JSON.stringify({ userId: "" }),
    JSON.stringify({ userId: 123 }),
    JSON.stringify({ userId: { nested: true } }),
    "",
  ]) {
    store.setItem(KEYS.session, bad);
    const p = currentPrincipal();
    assert.equal(p.kind, "guest", `session ${bad} should resolve to a guest, got ${p.kind}`);
  }
});

test("a malformed userId is not used to build a namespace", () => {
  // A path-traversal-shaped id must be encoded so it cannot escape the
  // namespace. The separators are percent-encoded; dots alone are harmless
  // because localStorage keys are flat strings, not paths.
  store.setItem(KEYS.session, JSON.stringify({ userId: "../../admin", lang: "en" }));
  const key = currentScopedKey(KEYS.records);
  const namespace = key.slice(0, key.lastIndexOf(":") + 1);
  assert.ok(key.startsWith("healthlink:u:"), `unexpected namespace: ${key}`);
  assert.ok(!namespace.includes("/"), `separators were not encoded: ${namespace}`);
  assert.ok(namespace.includes("%2F"), `expected an encoded separator: ${namespace}`);
});

test("a session pointing at no resolvable data reads as empty, never as someone else's", () => {
  signInAs("user-a");
  const keyA = currentScopedKey(KEYS.records);
  store.setItem(keyA, JSON.stringify([{ id: "a1" }]));
  signInAs("user-a-missing");
  assert.equal(store.getItem(currentScopedKey(KEYS.records)), null);
});

/* ------------------------------------ 8. migration is safe to repeat */

test("repeating the migration does not duplicate or corrupt records", () => {
  store.setItem(KEYS.records, JSON.stringify([{ id: "old", title: "legacy" }]));
  store.setItem(KEYS.journal, JSON.stringify([{ id: "old-j" }]));

  const first = quarantineLegacyData();
  assert.equal(first.moved.length, 2);
  const snapshot = store.getItem(`${QUARANTINE_NS}records`);

  const second = quarantineLegacyData();
  assert.equal(second.moved.length, 0, "a repeat run must move nothing");
  assert.equal(second.skipped.length > 0, true);

  assert.equal(store.getItem(`${QUARANTINE_NS}records`), snapshot, "quarantine content changed");
  assert.equal(
    (JSON.parse(store.getItem(`${QUARANTINE_NS}records`)!) as unknown[]).length,
    1,
    "records were duplicated",
  );
});

test("migration does not clobber quarantine data written since", () => {
  store.setItem(KEYS.records, JSON.stringify([{ id: "orig" }]));
  quarantineLegacyData();
  // Someone re-creates the legacy key; a later run must not overwrite the
  // already-quarantined original.
  store.setItem(KEYS.records, JSON.stringify([{ id: "newer" }]));
  const before = store.getItem(`${QUARANTINE_NS}records`);
  quarantineLegacyData();
  assert.equal(store.getItem(`${QUARANTINE_NS}records`), before);
});

/* ------------------------------------------- 9. recovery is explicit */

test("quarantined data is only recovered on an explicit request", () => {
  store.setItem(KEYS.records, JSON.stringify([{ id: "old", title: "mine" }]));
  signInAs("user-a");
  quarantineLegacyData();
  assert.equal(store.getItem(currentScopedKey(KEYS.records)), null);

  const recovered = recoverQuarantinedFor(currentPrincipal());
  assert.deepEqual(recovered, [KEYS.records]);
  assert.notEqual(store.getItem(currentScopedKey(KEYS.records)), null);
});

test("recovery never overwrites data the account already has", () => {
  store.setItem(KEYS.records, JSON.stringify([{ id: "old" }]));
  signInAs("user-a");
  quarantineLegacyData();
  store.setItem(currentScopedKey(KEYS.records), JSON.stringify([{ id: "mine" }]));

  recoverQuarantinedFor(currentPrincipal());
  assert.equal(
    (JSON.parse(store.getItem(currentScopedKey(KEYS.records))!) as { id: string }[])[0].id,
    "mine",
    "existing data was clobbered",
  );
});

/* ------------------------------------------------- helpers behave */

test("scopedKey leaves non-private keys untouched", () => {
  const p: Principal = currentPrincipal();
  assert.equal(scopedKey(p, KEYS.theme), KEYS.theme);
  assert.equal(scopedKey(p, KEYS.users), KEYS.users);
  assert.notEqual(scopedKey(p, KEYS.records), KEYS.records);
});

test("keysForPrincipal only returns that principal's keys", () => {
  signInAs("user-a");
  store.setItem(currentScopedKey(KEYS.records), "[]");
  store.setItem(KEYS.theme, '"light"');
  signInAs("user-b");
  store.setItem(currentScopedKey(KEYS.records), "[]");

  const bKeys = keysForPrincipal(currentPrincipal());
  assert.equal(bKeys.length, 1);
  assert.ok(bKeys[0].includes("user-b"));

  // Purging B must leave A alone.
  purgePrincipal(currentPrincipal());
  signInAs("user-a");
  assert.notEqual(store.getItem(currentScopedKey(KEYS.records)), null, "A's data was destroyed by B's purge");
});