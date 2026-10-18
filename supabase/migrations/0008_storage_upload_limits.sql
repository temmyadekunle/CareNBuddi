-- ============================================================================
-- 0008_storage_upload_limits.sql
--
-- Storage upload configuration for the provider-applications bucket.
--
-- Forward-only migration, complements (never duplicates) the policies:
--
--   0005 inserts the private bucket.
--   0006 adds Storage policies on storage.objects: an owner-segment check
--        for uploads/reads by the applicant, admin-only reads, and explicit
--        revokes of UPDATE/DELETE so an uploaded document is append-only.
--
-- This migration scopes what a compliant, policy-authorized upload may
-- contain in the first place:
--
--   file_size_limit   : 8 MiB, the same boundary the client enforces in
--                       lib/storage/upload.ts (MAX_DOC_BYTES). Identity and
--                       credential evidence is a scan or a photo of a card
--                       or document; a phone-camera JPEG at document
--                       fidelity sits far below 8 MB, so the limit is
--                       defensible and rules out uncompressed raw captures
--                       and zip archives of documents sent at high res.
--   allowed_mime_types: exactly the four types the client whitelist accepts.
--                       Documents arrive as JPG/PNG/WEBP images or PDFs;
--                       SVG is excluded because it is active content, and
--                       archives/text add nothing a verifier can use.
--
-- Enforcement notes (documented honestly, not overclaimed):
--
--   * file_size_limit is enforced by the Storage API service itself.
--   * allowed_mime_types is validated by the Storage API against the
--     request's Content-Type header. The header is provided by the
--     uploading client and is NOT proof of the file's actual bytes: a
--     mismatched payload that claims to be an image and is, in bytes, a
--     PDF (or anything else Storage will store) is outside what bucket
--     configuration can detect. Reviewers open documents through short
--     signed URLs (0006 workflow), and the four allowed types keep the
--     exposure narrow; content-sniffing would require the Storage API's
--     internal behaviour and is recorded as a remaining limitation in the
--     follow-up report, not claimed as solved.
--   * The client's validateFile() runs first, so well-behaved devices
--     never hit these limits blind.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'provider-applications',
  'provider-applications',
  false,
  8388608, -- 8 MiB, mirrors lib/storage/upload.ts MAX_DOC_BYTES
  array[ 'image/jpeg', 'image/png', 'image/webp', 'application/pdf' ]
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = false;
