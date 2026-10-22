/**
 * Pure path rules for the avatars Storage bucket (migration 0009).
 *
 * Kept dependency-free so the unit test suite can exhaust the rules without
 * touching the Supabase client, and so lib/profile-photo-server.ts and the
 * migrations agree on one spelling of a path.
 *
 * Object path scheme (identical spirit to the provider-applications scheme in
 * lib/storage/upload.ts — bucket name repeated as the first in-bucket folder,
 * owning user id as the second):
 *
 *   avatars/{userId}/{timestamp}.jpg
 *
 * The second segment is the authenticated user's id, which the Storage
 * policies in migration 0009 verify against auth.uid().
 */

export const AVATAR_BUCKET = "avatars";
export const AVATAR_NAME_PREFIX = "avatars/";
/** The only content this app ever puts in the bucket is a re-encoded JPEG. */
export const AVATAR_MIME_TYPE = "image/jpeg";
/** Server-side bucket limit is 2 MiB (migration 0009); mirrors that. */
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
/** Hydration refuses to cache anything larger than a freshly encoded photo. */
export const MAX_AVATAR_DATA_URL_CHARS = 1_500_000;

/** A cheap ownership sanity check: opaque slot ids used for storage paths. */
const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;

/**
 * True for values that can legally appear as the owner segment of a storage
 * path. Profile ids are either Supabase uuids or short local slot ids; both
 * are filename-safe. Anything with separators or odd characters is refused —
 * a malformed id must never survive into a path hoping the database will
 * catch it.
 */
export function isSafeOwnerId(userId: unknown): userId is string {
  return typeof userId === "string" && SAFE_ID.test(userId);
}

/**
 * Builds the object path for a fresh avatar upload. Opaque and monotonically
 * newer per call via the stamp, which is what lets photo_path repoint itself
 * without ever mutating or deleting an existing object (UPDATE/DELETE on
 * storage.objects are revoked from client roles — 0006/0009).
 *
 * @param userId - owner's id (auth user id on the cloud path)
 * @param stamp  - caller-provided monotonic-ish stamp (e.g. Date.now())
 * @throws when the owner id is not filename-safe, so a caller can never
 *         construct a path that sneaks past the ownership checks.
 */
export function avatarObjectNameFor(userId: string, stamp: number): string {
  if (!isSafeOwnerId(userId)) {
    throw new Error("invalid-avatar-owner");
  }
  if (!Number.isFinite(stamp) || stamp < 0) {
    throw new Error("invalid-avatar-stamp");
  }
  return `${AVATAR_NAME_PREFIX}${userId}/${Math.floor(stamp)}.jpg`;
}

/**
 * The path handed to supabase.storage.from(bucket).upload()/createSignedUrl():
 * those take a bucket-relative path. Returns null when the value does not
 * carry the expected prefix — callers must fail, not guess, on foreign data
 * (photo_path is caller-storable, so it cannot be trusted unchecked).
 */
export function avatarBucketPath(objectName: string): string | null {
  if (typeof objectName !== "string" || !objectName.startsWith(AVATAR_NAME_PREFIX)) {
    return null;
  }
  const stripped = objectName.slice(AVATAR_NAME_PREFIX.length);
  if (!stripped || stripped.startsWith("/") || stripped.includes("\0")) {
    return null;
  }
  return stripped;
}

/**
 * Whether an object path may be treated as this user's avatar. Enforces, in
 * order: the known prefix, the exact owner segment, a non-empty file name,
 * the fixed extension and no traversal characters anywhere.
 *
 * The database CHECK in 0009 validates the same rules for writes; this exists
 * so reads (hydration) independently refuse to ask Storage for a path that
 * could not possibly be the user's — a hostile profile row can only fail
 * closed.
 */
export function isValidAvatarPathFor(userId: string, objectName: unknown): boolean {
  if (!isSafeOwnerId(userId) || typeof objectName !== "string") return false;
  if (!objectName.startsWith(AVATAR_NAME_PREFIX)) return false;
  const segments = objectName.split("/");
  if (segments.length !== 3) return false;
  if (segments[1] !== userId) return false;
  if (!segments[2] || !segments[2].endsWith(".jpg")) return false;
  if (segments[2].includes("..") || segments[2].includes("\\")) return false;
  if (isSafeOwnerId(segments[2].slice(0, -4)) === false) return false;
  return true;
}
