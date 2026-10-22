import assert from "node:assert/strict";
import test from "node:test";

import {
  clearAvatarOnCloud,
  hydrateServerPhoto,
  resetPhotoHydration,
  type ServerPhotoPort,
  type ServerPhotoRow,
} from "../lib/profile-photo-server";
import { readPhoto, removePhoto, savePhoto } from "../lib/profile-photo";
import { principalForUser } from "../lib/storage-scope";
import { endSessionFor } from "../lib/session";

/**
 * Profile photo hydration and adoption semantics.
 *
 * The regression being prevented: a patient's photo existed only on the
 * device (fast upload failing offline, or taken before any cloud session),
 * sign-in arrives with photo_path NULL on the server, and hydration treats
 * that absence as authority and DELETES the picture. Absence must mean
 * "adopt", never "discard"; deletion is an explicit user action only.
 *
 * These tests exercise the real hydration decision function with an injected
 * server port and the real localStorage read/write paths (shimmed below),
 * including the ownership-scoped key resolution. Each test uses its own
 * account id because hydration remembers one attempt per account per page
 * load; a fresh id is the equivalent of a fresh page load. Since the
 * production bug: the gate is a module-level set, and the same account
 * signing in again WITHOUT a page load (sign-out is a client-side route
 * change in the static app) must go through `resetPhotoHydration` — the
 * way the cloud auth listener does at every session end.
 */

const JPEG = "data:image/jpeg;base64,AAAA" + "B".repeat(64);

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

/** Distinct, syntactically valid account id per test. */
function mkUser(n: number): string {
  const tail = (1000000000000 + n + 1).toString(16).slice(1).padStart(12, "0");
  return `00000000-0000-4000-8000-${tail}`;
}

/** Track every side effect a hydration pass could perform. */
function recordingPort(row: Partial<ServerPhotoRow> = {}, options: {
  downloadFails?: boolean;
  adoptFails?: boolean;
} = {}) {
  const effects = {
    adopted: [] as string[],
    downloaded: [] as string[],
    /** Accounts whose profile lookup actually ran (the hydration gate target). */
    fetched: [] as string[],
  };
  const port: ServerPhotoPort = {
    async fetchPhotoPath(userId: string): Promise<ServerPhotoRow> {
      effects.fetched.push(userId);
      return {
        found: row.found ?? true,
        photoPath: row.photoPath ?? null,
      };
    },
    async downloadAvatar(bucketPath) {
      if (options.downloadFails) throw new Error("signed-url-call-failed");
      effects.downloaded.push(bucketPath);
      if (options.adoptFails) throw new Error("transfer-failed");
      return JPEG;
    },
    async adoptLocalAvatar(userId, dataUrl) {
      if (options.adoptFails) throw new Error("upload-failed");
      effects.adopted.push(dataUrl);
      void userId;
    },
  };
  return { port, effects };
}

test("setup: the shim drives the real scoped photo map", () => {
  const u = mkUser(0);
  assert.equal(savePhoto(u, JPEG), true);
  assert.equal(readPhoto(u), JPEG);
  assert.equal(removePhoto(u), true);
  assert.equal(readPhoto(u), null);
});

test("REGRESSION: a device-local photo survives hydration when the server has photo_path NULL, and is adopted", async () => {
  const u = mkUser(1);
  // The photo exists locally only (its upload failed offline earlier).
  assert.equal(savePhoto(u, JPEG), true);

  const { port, effects } = recordingPort({ found: true, photoPath: null });

  await hydrateServerPhoto(u, port);

  assert.equal(effects.adopted.length, 1);
  assert.equal(effects.adopted[0], JPEG);
  assert.equal(effects.downloaded.length, 0);
  assert.equal(readPhoto(u), JPEG, "adoption keeps the device copy");
});

test("adoption failure keeps the local photo and resolves quietly", async () => {
  const u = mkUser(2);
  assert.equal(savePhoto(u, JPEG), true);
  const { port, effects } = recordingPort({ found: true, photoPath: null }, { adoptFails: true });

  await hydrateServerPhoto(u, port);

  assert.equal(effects.adopted.length, 0);
  assert.equal(readPhoto(u), JPEG, "the local photo must never be lost to a failed adoption");
});

test("hydration runs at most once per page load per account", async () => {
  const u = mkUser(3);
  assert.equal(savePhoto(u, JPEG), true);
  const { port, effects } = recordingPort({ found: true, photoPath: null });

  await hydrateServerPhoto(u, port);
  assert.equal(effects.adopted.length, 1);

  await hydrateServerPhoto(u, port);
  assert.equal(effects.adopted.length, 1, "no second attempt on the same page load");
});

test("absence stays absence: row says NULL and the device has no photo -> nothing is uploaded", async () => {
  const u = mkUser(4);
  const { port, effects } = recordingPort({ found: true, photoPath: null });

  await hydrateServerPhoto(u, port);

  assert.equal(effects.adopted.length, 0);
  assert.equal(effects.downloaded.length, 0);
  assert.equal(readPhoto(u), null);
});

test("an explicit removal is not undone by a later hydration pass on a fresh page load", async () => {
  const u = mkUser(5);
  const { port, effects } = recordingPort({ found: true, photoPath: null });

  // Simulate the removal that already happened before this page load: the
  // device cache is empty and the server reference is cleared (NULL).
  await hydrateServerPhoto(u, port);

  assert.equal(effects.adopted.length, 0, "hydration must not resurrect a removed photo");
  assert.equal(readPhoto(u), null);
});

test("explicit local removal is honoured after adoption, within the same page load", async () => {
  const u = mkUser(6);
  assert.equal(savePhoto(u, JPEG), true);
  const { port, effects } = recordingPort({ found: true, photoPath: null });
  await hydrateServerPhoto(u, port);
  assert.equal(effects.adopted.length, 1);

  removePhoto(u);
  assert.equal(readPhoto(u), null);

  await hydrateServerPhoto(u, port);
  assert.equal(effects.adopted.length, 1, "the same page load cannot re-adopt behind the user's back");
});

test("server photo is authoritative: an empty device cache is filled from the owner-scoped path", async () => {
  const u = mkUser(7);
  const objectName = `avatars/${u}/1719999999999.jpg`; // the shape photo_path stores (0009 CHECK)
  const { port, effects } = recordingPort({ found: true, photoPath: objectName });

  await hydrateServerPhoto(u, port);

  // The storage API takes a bucket-relative path; hydration strips "avatars/"
  // only AFTER validation, so the port never sees a foreign spelling.
  assert.deepEqual(effects.downloaded, [`${u}/1719999999999.jpg`]);
  assert.equal(readPhoto(u), JPEG);
});

test("an existing local photo is not clobbered by the server copy mid-session", async () => {
  const u = mkUser(8);
  const serverPath = `avatars/${u}/1719999999999.jpg`;
  assert.equal(savePhoto(u, JPEG), true);
  const { port, effects } = recordingPort({ found: true, photoPath: serverPath });

  await hydrateServerPhoto(u, port);
  assert.equal(effects.downloaded.length, 0, "valid-but-redundant hydration skips the download");
  assert.equal(readPhoto(u), JPEG);
});

test("a signed-URL or transfer failure leaves the current state as is", async () => {
  const u = mkUser(9);
  const serverPath = `avatars/${u}/1.jpg`;
  assert.equal(savePhoto(u, JPEG), true);
  const { port } = recordingPort({ found: true, photoPath: serverPath }, { adoptFails: true });
  await hydrateServerPhoto(u, port);
  assert.equal(readPhoto(u), JPEG, "a failed transfer must not clear the device copy");

  const empty = mkUser(10);
  const emptyPort = recordingPort({ found: true, photoPath: `avatars/${empty}/x.jpg` }, { adoptFails: true });
  await hydrateServerPhoto(empty, emptyPort.port);
  assert.equal(readPhoto(empty), null, "and must not fabricate one");
});

test("a foreign or malformed server reference fails closed and is never fetched", async () => {
  const u = mkUser(11);
  const foreign = `avatars/00000000-0000-4000-8000-${String(1000000000000 + 99).slice(1)}/2.jpg`;
  const { port, effects } = recordingPort({ found: true, photoPath: foreign });
  await hydrateServerPhoto(u, port);
  assert.equal(effects.downloaded.length, 0);
  assert.equal(readPhoto(u), null);

  const weird = recordingPort({ found: true, photoPath: `somewhere-else/${u}/1.jpg` });
  await hydrateServerPhoto(u, weird.port);
  assert.equal(weird.effects.downloaded.length, 0, "paths outside the avatars bucket are never fetched");
  assert.equal(readPhoto(u), null);
});

test("a user without a readable profile row keeps its local state untouched", async () => {
  const u = mkUser(12);
  assert.equal(savePhoto(u, JPEG), true);
  const { port, effects } = recordingPort({ found: false, photoPath: null });

  await hydrateServerPhoto(u, port);

  assert.equal(effects.adopted.length, 0);
  assert.equal(effects.downloaded.length, 0);
  assert.equal(readPhoto(u), JPEG, "a local-only slot id must not lose its photo");
});

/* ------------------------------------------------- sign-out → sign-in (same session) */
/**
 * The production bug: hydration remembers one attempt per account per page
 * load, but sign-out is NOT a page load in this SPA. Sign-out also purges
 * the user-scoped photo cache (deliberately — biometrics), so the ONLY way
 * the photo comes back is a fresh server fetch, which the stale gate used
 * to block. These tests exercise the REAL sign-out cleanup path
 * (endSessionFor with the real principal) and the REAL reset call shape
 * the auth listener makes, in the same module instance this file loaded.
 */

test("the gate stays shut for a second hydration attempt in the same session", async () => {
  const u = mkUser(14);
  const objectName = `avatars/${u}/1700000000001.jpg`;
  const { port, effects } = recordingPort({ found: true, photoPath: objectName });

  await hydrateServerPhoto(u, port);
  assert.equal(effects.fetched.length, 1);
  assert.equal(readPhoto(u), JPEG);

  await hydrateServerPhoto(u, port);
  await hydrateServerPhoto(u, port);
  assert.equal(
    effects.fetched.length,
    1,
    "duplicate-request protection: one fetch per account per page load, never two",
  );
});

test("REGRESSION: sign-out purge + gate reset lets hydration restore the photo without a fresh module", async () => {
  const u = mkUser(15);
  const objectName = `avatars/${u}/1700000000002.jpg`;
  // Re-sign-in on the same device: session points at this account first.
  store.setItem("healthlink:session", JSON.stringify({ userId: u, lang: "en" }));
  assert.equal(savePhoto(u, JPEG), true);

  const { port, effects } = recordingPort({ found: true, photoPath: objectName });
  await hydrateServerPhoto(u, port);
  assert.equal(effects.fetched.length, 1, "first sign-in: the gate allowed a fetch");
  assert.equal(readPhoto(u), JPEG);

  // Real session end (expiry-style revocation cleanup — the same purge the
  // listener and explicit sign-out share).
  const { removed } = endSessionFor(principalForUser(u), "expired");
  assert.ok(removed > 0, "the real sign-out cleanup must have purged private keys");
  assert.equal(
    store.getItem(`healthlink:u:${u}:profile-photos`),
    null,
    "sign-out really did purge the device photo cache",
  );

  // Re-sign-in WITHOUT a page load: session points at the account again.
  store.setItem("healthlink:session", JSON.stringify({ userId: u, lang: "en" }));
  assert.equal(readPhoto(u), null, "the cache is empty — only a server fetch can restore");

  // Exactly what the auth listener does at session end, before this hydrate.
  resetPhotoHydration(u);

  await hydrateServerPhoto(u, port);
  assert.deepEqual(effects.downloaded, [`${u}/1700000000002.jpg`], "hydration fetched again");
  assert.equal(readPhoto(u), JPEG, "the photo came back from the server in-session");

  // The reestablished gate: without another reset, further hydrates stay no-ops.
  await hydrateServerPhoto(u, port);
  assert.equal(effects.fetched.length, 2, "and the one-attempt property is intact again");
});

test("repeated resets are idempotent and scoped", () => {
  const a = mkUser(16);
  const b = mkUser(17);
  resetPhotoHydration(a);
  resetPhotoHydration(a);
  resetPhotoHydration();
  // Whether gates were conceptually open or closed, reset must never throw
  // and cleaning up everything (no argument) must not disturb other state.
  removePhoto(a);
  removePhoto(b);
  assert.equal(readPhoto(a), null);
  assert.equal(readPhoto(b), null);
});

test("clearAvatarOnCloud stays silent without cloud configuration", async () => {
  const u = mkUser(13);
  // No NEXT_PUBLIC_* env vars in the test process: the helper must exit
  // quietly rather than pretending an update succeeded.
  await clearAvatarOnCloud(u);
  assert.equal(readPhoto(u), null);
});
