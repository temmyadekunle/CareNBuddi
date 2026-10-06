"use client";

import { readCollectionFresh, writeValueChecked } from "@/lib/storage";

/**
 * Profile photos are held on the device as small JPEG data URLs.
 *
 * A phone camera produces 2-5MB images. Storing one of those in localStorage
 * would blow the roughly 5MB origin quota almost immediately, and the write
 * would fail silently, so the picture would appear to save and then vanish on
 * the next reload. Everything here exists to make sure what gets stored is
 * small enough to actually fit.
 */

/** Longest edge of the stored square, in pixels. */
const SIZE = 320;
/** JPEG quality. 0.82 at 320x320 keeps a photo around 15-30KB. */
const QUALITY = 0.82;
/** Refuse anything larger so a huge image cannot lock up the main thread. */
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

export type PhotoMap = Record<string, string>;

/**
 * Crops an image to a centred square and returns a JPEG data URL.
 *
 * Uses createImageBitmap when available because it decodes off the main thread,
 * which keeps the UI responsive on a slow phone. Falls back to an <img> decode
 * where that is not supported.
 */
export async function fileToSquareDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("not-an-image");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("too-large");
  }

  const source = await decode(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no-canvas");

    // Centre-crop to a square, then draw down to SIZE.
    const side = Math.min(source.width, source.height);
    const sx = (source.width - side) / 2;
    const sy = (source.height - side) / 2;
    ctx.drawImage(source, sx, sy, side, side, 0, 0, SIZE, SIZE);

    const url = canvas.toDataURL("image/jpeg", QUALITY);
    if (!url.startsWith("data:image/jpeg")) throw new Error("encode-failed");
    return url;
  } finally {
    if ("close" in source && typeof source.close === "function") source.close();
  }
}

type Decoded = ImageBitmap | HTMLImageElement;

async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      // fall through to the <img> path
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("decode-failed"));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The stored photo for one account, read fresh so a large image is not cached. */
export function readPhoto(userId: string | null | undefined): string | null {
  if (!userId) return null;
  const map = readCollectionFresh<PhotoMap>("healthlink:profile-photos");
  const photo = map?.[userId];
  return typeof photo === "string" && photo.startsWith("data:image/") ? photo : null;
}

/**
 * Saves one photo, keeping any already stored for other accounts. Returns
 * false when the device has no room left, so the caller can tell the user.
 */
export function savePhoto(userId: string, dataUrl: string): boolean {
  const existing = readCollectionFresh<PhotoMap>("healthlink:profile-photos") ?? {};
  return writeValueChecked("healthlink:profile-photos", { ...existing, [userId]: dataUrl });
}

/** Removes one photo and leaves the rest alone. */
export function removePhoto(userId: string): boolean {
  const existing = readCollectionFresh<PhotoMap>("healthlink:profile-photos") ?? {};
  const next = { ...existing };
  delete next[userId];
  return writeValueChecked("healthlink:profile-photos", next);
}
