"use client";

import {
  MAX_AVATAR_BYTES,
  MAX_AVATAR_DATA_URL_CHARS,
  AVATAR_BUCKET,
  AVATAR_MIME_TYPE,
  avatarObjectNameFor,
  avatarBucketPath,
  isValidAvatarPathFor,
} from "@/lib/avatar-storage";
import { readPhoto, savePhoto } from "@/lib/profile-photo";
import { getSupabase } from "@/lib/supabase/client";

/**
 * Durable profile photos: server side.
 *
 * The device copy (lib/profile-photo.ts) stays the instant, offline-first
 * source every renderer reads. This module gives it a server master copy so
 * the photo survives the things the device copy cannot: sign-out purging,
 * a reinstall, or a second device. The reactive wiring lives in
 * lib/profile-photo-hook.tsx; this file holds the decisions and effects.
 *
 *   upload  : handleCropSave -> uploadAvatarToCloud   (Storage + photo_path)
 *   restore : useProfilePhoto -> hydrateServerPhoto   (signed URL -> cache)
 *   adopt   : hydrateServerPhoto -> a device-local photo with no server
 *             master copy is PUSHED to the user's own avatar path, never
 *             deleted: sign-in must not cost anyone a photo that only
 *             existed locally before (fast uploads failing offline, a
 *             device that was offline, or a photo taken before the account
 *             was ever connected).
 *   remove  : clearPhoto -> clearAvatarOnCloud
 *
 * Absence and deletion are different facts and this module keeps them
 * separate: a NULL photo_path on the server means "not yet synced here" —
 * the local copy is adopted, not discarded. Deletion only happens where the
 * user explicitly removes the photo (clearPhoto), which clears both the
 * local entry and the server reference; after that, hydration sees no local
 * copy to adopt and correctly does nothing.
 *
 * Failure shape is fail-soft by design: if the server copy is unreachable,
 * stale, or the migration has not been applied yet, the local picture (or a
 * neutral fallback avatar) is shown — never an error state, never a retry
 * loop, never data loss. Adoption failures keep the local photo; a later
 * page load retries once per load (the attempt set below, which is what
 * makes "absence" and "just failed" stop short of a request loop).
 */

const SIGNED_TTL_SECONDS = 600;

/** One hydration attempt per user per page load; retry only helps nothing. */
const attempted = new Set<string>();
/** Re-entrancy guard so a fast render never fires parallel fetches. */
const inflight = new Set<string>();

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("avatar-read-failed"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  if (!res.ok) throw new Error("avatar-decode-failed");
  return res.blob();
}

/**
 * Uploads the freshly cropped photo and points the profile row at it.
 * Throws so the caller can show a "saved here, upload failed" message;
 * the local copy has already been written by that point.
 */
export async function uploadAvatarToCloud(userId: string, dataUrl: string): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("cloud-not-configured");
  if (!dataUrl.startsWith("data:image/jpeg")) throw new Error("not-an-avatar-jpeg");

  const blob = await dataUrlToBlob(dataUrl);
  if (blob.size > MAX_AVATAR_BYTES) throw new Error("too-large");

  const objectPath = avatarObjectNameFor(userId, Date.now());
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(objectPath, blob, {
    contentType: AVATAR_MIME_TYPE,
    cacheControl: "31536000",
    upsert: false, // objects are immutable; photo_path repoints instead
  });
  if (error) throw new Error(error.message);

  const { error: refError } = await supabase
    .from("profiles")
    .update({ photo_path: objectPath })
    .eq("id", userId);
  if (refError) throw new Error(refError.message);
  return objectPath;
}

/** Best-effort clearing of the server reference when the user removes their photo. */
export async function clearAvatarOnCloud(userId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase
    .from("profiles")
    .update({ photo_path: null })
    .eq("id", userId);
  if (error) throw error;
}

/* ------------------------------------------------------------------------- */
/* Server side effects for hydration live behind this port so the decision    */
/* logic is testable end to end with no network and no Supabase client.       */
/* The default port uses the real client and validates everything it is       */
/* handed, exactly as before; injections only redirect WHERE it looks, never   */
/* WHAT it accepts.                                                          */
/* ------------------------------------------------------------------------- */

/** What the profile lookup said about one user's avatar reference. */
export interface ServerPhotoRow {
  /** true when a profile row was readable at all (a guest's local slot id has no row) */
  found: boolean;
  /** NULL when the row exists but no server avatar is referenced */
  photoPath: string | null;
}

export interface ServerPhotoPort {
  fetchPhotoPath(userId: string): Promise<ServerPhotoRow>;
  /** Fetch the avatar bytes through a short-lived signed URL. Null on failure. */
  downloadAvatar(bucketPath: string): Promise<string | null>;
  /**
   * Push an existing device-local photo to the user's own avatar path.
   * Must throw on failure so hydration can fail-soft and keep the local copy.
   */
  adoptLocalAvatar(userId: string, dataUrl: string): Promise<void>;
}

function defaultPort(): ServerPhotoPort {
  return {
    async fetchPhotoPath(userId) {
      const supabase = getSupabase();
      if (!supabase) return { found: false, photoPath: null };
      const { data, error } = await supabase
        .from("profiles")
        .select("photo_path")
        .eq("id", userId)
        .maybeSingle();
      if (error || !data) return { found: false, photoPath: null };
      const path = typeof data.photo_path === "string" && data.photo_path.length > 0
        ? data.photo_path
        : null;
      return { found: true, photoPath: path };
    },
    async downloadAvatar(bucketPath) {
      const supabase = getSupabase();
      if (!supabase) return null;
      if (!bucketPath || bucketPath.includes("\0")) return null;
      const { data: signed, error: signError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .createSignedUrl(bucketPath, SIGNED_TTL_SECONDS);
      if (signError || !signed?.signedUrl) return null;
      const res = await fetch(signed.signedUrl);
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!blob || blob.size === 0 || blob.size > MAX_AVATAR_BYTES) return null;
      const dataUrl = await blobToDataUrl(blob);
      if (!dataUrl.startsWith("data:image/jpeg") || dataUrl.length > MAX_AVATAR_DATA_URL_CHARS) {
        return null;
      }
      return dataUrl;
    },
    async adoptLocalAvatar(userId, dataUrl) {
      await uploadAvatarToCloud(userId, dataUrl);
    },
  };
}

/**
 * Restores or adopts the server relationship for one account's photo.
 *
 * Rules, in order:
 *   1. no readable profile row -> do nothing, keep local state untouched
 *      (a guest's or local-only slot id owns no server row);
 *   2. server has no reference (photo_path NULL -> "not yet synced") and the
 *      device HAS a photo -> adopt: upload it to the user's own avatar path
 *      and save the reference. The local copy is kept in every branch;
 *      if the adopt fails the local photo stays and a later load retries;
 *   3. server has a valid reference -> server is authoritative: fill an
 *      empty local cache from the signed URL. A foreign or malformed
 *      reference fails closed (nothing is fetched, local state is kept);
 *   4. query/transfer failures of any kind leave current state as is.
 *
 * Never deletes: absence (rules 1 and 2 with no local copy) simply does
 * nothing. Deletion is the explicit clearAvatarOnCloud / removePhoto path.
 */
export async function hydrateServerPhoto(userId: string, port: ServerPhotoPort = defaultPort()): Promise<void> {
  if (!userId || attempted.has(userId) || inflight.has(userId)) return;
  attempted.add(userId);
  inflight.add(userId);
  try {
    const row = await port.fetchPhotoPath(userId);
    if (!row.found) return;

    // The device copy is read AFTER the row lookup resolves, so a photo the
    // user saves (or removes) while the request is in flight is honoured.
    const local = readPhoto(userId);
    if (!row.photoPath) {
      // Absence, not deletion: adopt whatever the device already has.
      if (local) await port.adoptLocalAvatar(userId, local);
      return;
    }

    // A foreign or malformed path fails closed: no signed URL is ever
    // requested for something the profile row merely CLAIMS is ours.
    if (!isValidAvatarPathFor(userId, row.photoPath) || local) return;

    const bucketPath = avatarBucketPath(row.photoPath);
    if (!bucketPath) return;

    const dataUrl = await port.downloadAvatar(bucketPath);
    if (dataUrl) savePhoto(userId, dataUrl);
  } catch {
    /* offline / unconfigured / adoption failed: the local copy wins, no loss */
  } finally {
    inflight.delete(userId);
  }
}
