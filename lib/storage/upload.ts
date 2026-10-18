/**
 * Private document upload and retrieval for provider applications.
 *
 * All operations run client-side through the Supabase Storage client and are
 * governed by Supabase Auth + Storage policies (migration 0006). No document
 * bytes are ever stored in localStorage, and no permanent public URLs are
 * ever generated.
 *
 * Path scheme (application-scoped, prevents cross-applicant access):
 *
 *   provider-applications/{userId}/{applicationId}/{docType}/{fileName}
 *
 * The second path segment is the authenticated user's ID, which Storage
 * policies verify against auth.uid().
 */

import { getSupabase, isCloudEnabled } from "../supabase/client";
import type { DocumentRef } from "../provider-application";

const MAX_DOC_BYTES = 8 * 1024 * 1024; // 8 MB
const ACCEPTED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

/** Document type values used in storage paths and database metadata. */
export type DocumentCategory = "identity" | "credentials";

/** Validation result for a file before upload. */
export interface FileValidation {
  ok: boolean;
  error?: string;
}

/**
 * Validate a file's MIME type and size before upload. Extension is never
 * trusted alone; the MIME type reported by the browser is checked.
 */
export function validateFile(file: File): FileValidation {
  if (!ACCEPTED_MIME.includes(file.type)) {
    return {
      ok: false,
      error: "Use a JPG, PNG, WEBP or PDF file.",
    };
  }
  if (file.size > MAX_DOC_BYTES) {
    return {
      ok: false,
      error: "That file is too large. The maximum is 8 MB.",
    };
  }
  return { ok: true };
}

/**
 * Build an application-scoped storage path. Never accepts caller-supplied
 * path segments that could traverse directories or cross applicant
 * boundaries.
 *
 * @param userId - authenticated user's ID (from auth, never client-supplied)
 * @param applicationId - the provider application's ID
 * @param docType - "identity" or "credentials"
 * @param fileName - original file name (sanitised below)
 */
export function buildStoragePath(
  userId: string,
  applicationId: string,
  docType: DocumentCategory,
  fileName: string,
): string {
  // Sanitise the file name: strip directory components so a malicious file
  // name cannot traverse paths.
  const safeName = fileName.replace(/^.*[\\/]/, "").replace(/[^a-zA-Z0-9._-]/g, "_");
  return `provider-applications/${userId}/${applicationId}/${docType}/${safeName}`;
}

/**
 * Extract the user ID from a storage path. Returns null if the path is not
 * application-scoped or does not start with the expected bucket prefix.
 */
export function userIdFromStoragePath(path: string): string | null {
  const parts = path.split("/");
  if (parts.length < 5 || parts[0] !== "provider-applications") {
    return null;
  }
  return parts[1];
}

/**
 * Upload a document to private Supabase Storage.
 *
 * Returns the DocumentRef metadata and the storage path on success. The
 * caller is responsible for storing the DocumentRef in the database
 * (identity_document or credential_evidence) only after the upload succeeds.
 *
 * Throws on upload failure; callers must display an error and must NOT mark
 * the document as complete.
 */
export async function uploadDocument(
  userId: string,
  applicationId: string,
  docType: DocumentCategory,
  file: File,
): Promise<{ documentRef: DocumentRef; storagePath: string }> {
  const validation = validateFile(file);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase is not configured. Cannot upload documents.");
  }

  const storagePath = buildStoragePath(userId, applicationId, docType, file.name);

  const { error } = await supabase.storage
    .from("provider-applications")
    .upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false, // never replace an existing document
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const documentRef: DocumentRef = {
    docType,
    fileName: file.name,
    sizeBytes: file.size,
    mimeType: file.type,
    addedAt: new Date().toISOString(),
  };

  return { documentRef, storagePath };
}

/**
 * Create a short-lived signed URL for downloading a document. Only
 * authenticated administrators or the document's owner can obtain a URL
 * (enforced by Storage policies).
 *
 * Returns null if Supabase is not configured.
 */
export async function getDocumentUrl(
  storagePath: string,
  expiresInSeconds = 900, // 15 minutes
): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from("provider-applications")
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}

/**
 * Check whether Supabase cloud storage is configured and available.
 */
export function isDocumentStorageAvailable(): boolean {
  return isCloudEnabled;
}

/**
 * Build a DocumentRef from a File, without uploading. Used for client-side
 * preview before upload completes.
 */
export function buildDocumentRef(
  file: File,
  docType: DocumentCategory,
): DocumentRef {
  return {
    docType,
    fileName: file.name,
    sizeBytes: file.size,
    mimeType: file.type,
    addedAt: new Date().toISOString(),
  };
}

/**
 * The storage key prefix used for provider applications. Shared with
 * lib/provider-application.ts so both modules agree on the namespace.
 */
export const PROVIDER_DOCUMENT_BUCKET = "provider-applications";
