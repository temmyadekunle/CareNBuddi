import assert from "node:assert/strict";
import test from "node:test";
import {
  AVATAR_BUCKET,
  AVATAR_MIME_TYPE,
  MAX_AVATAR_BYTES,
  avatarBucketPath,
  avatarObjectNameFor,
  isSafeOwnerId,
  isValidAvatarPathFor,
} from "../lib/avatar-storage";

const UID = "00000000-0000-4000-8000-00000000aa01";

test("avatar object paths are owner-scoped and versioned", () => {
  const path = avatarObjectNameFor(UID, 1719999999999);
  assert.equal(path, `avatars/${UID}/1719999999999.jpg`);
  assert.equal(avatarObjectNameFor(UID, Date.now()).startsWith(`avatars/${UID}/`), true);
});

test("avatar owner ids that cannot form a path are rejected", () => {
  for (const bad of ["", "has/slash", "has\\slash", "has space", "a".repeat(129), null, 42]) {
    assert.throws(() => avatarObjectNameFor(bad as string, 1), String(bad));
  }
  assert.equal(isSafeOwnerId("u-admin"), true);
  assert.equal(isSafeOwnerId(UID), true);
});

test("avatar stamp must be a non-negative finite number", () => {
  for (const bad of [-1, NaN, Infinity, "1719999999999" as unknown as number, null]) {
    assert.throws(() => avatarObjectNameFor(UID, bad as number), String(bad));
  }
  assert.equal(avatarObjectNameFor(UID, 0).endsWith("/0.jpg"), true);
});

test("avatarBucketPath strips the owner pin only on an exact prefix", () => {
  assert.equal(avatarBucketPath(`avatars/${UID}/1.jpg`), `${UID}/1.jpg`);
  assert.equal(avatarBucketPath(`avatarss/${UID}/1.jpg`), null);
  assert.equal(avatarBucketPath("avatars/"), null);
  assert.equal(avatarBucketPath(""), null);
  assert.equal(avatarBucketPath("/leading"), null);
  assert.equal(avatarBucketPath("avatars/\0x"), null);
});

test("isValidAvatarPathFor fails closed on foreign or malformed paths", () => {
  assert.equal(isValidAvatarPathFor(UID, `avatars/${UID}/1719999999999.jpg`), true);
  assert.equal(isValidAvatarPathFor(UID, `avatars/${UID}/1.jpg`), true);

  // pointing at somebody else's object
  assert.equal(isValidAvatarPathFor(UID, `avatars/00000000-0000-4000-8000-00000000bb01/1.jpg`), false);
  // wrong bucket folder
  assert.equal(isValidAvatarPathFor(UID, `provider-applications/${UID}/1.jpg`), false);
  // missing/odd segments
  assert.equal(isValidAvatarPathFor(UID, `avatars/${UID}`), false);
  assert.equal(isValidAvatarPathFor(UID, `avatars/${UID}/a/b.jpg`), false);
  assert.equal(isValidAvatarPathFor(UID, `avatars/${UID}/`), false);
  // non-image or traversal-ish file names
  assert.equal(isValidAvatarPathFor(UID, `avatars/${UID}/1.png`), false);
  assert.equal(isValidAvatarPathFor(UID, `avatars/${UID}/..jpg`), false);
  assert.equal(isValidAvatarPathFor(UID, `avatars/${UID}/1..jpg`), false);
  assert.equal(isValidAvatarPathFor(UID, `avatars/${UID}/..\\evil.jpg`), false);
  // wrong types
  assert.equal(isValidAvatarPathFor(UID, null), false);
  assert.equal(isValidAvatarPathFor("", `avatars/${UID}/1.jpg`), false);
});

test("module contract stays in step with the migration", () => {
  assert.equal(AVATAR_BUCKET, "avatars");
  assert.equal(AVATAR_MIME_TYPE, "image/jpeg");
  assert.equal(MAX_AVATAR_BYTES, 2 * 1024 * 1024);
});
