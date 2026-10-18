# CareNBuddi — Provider Document Verification Report

**Scope:** end-to-end verification workflow for provider applications — private document upload, administrator download/review, and an append-only audit history.
**Constraints honoured:** no production connection or modification, no migrations against production, no deploy, no push, **no commits** (all work below is uncommitted in the working tree), no RLS removal, no permanent document URLs, no anonymous document access.

---

## 1. What was built

### Database — `supabase/migrations/0006_storage_policies.sql` (new)
- **Three Storage policies** on `storage.objects`, all scoped to the `provider-applications` bucket only:
  - `provider_applications_upload_own` (INSERT, `to authenticated`): the path's second segment (built with `storage.foldername(name)`) must equal `auth.uid()::text`, so an applicant can only upload under their own path.
  - `provider_applications_view_own` (SELECT): same owner-segment check.
  - `provider_applications_admin_view` (SELECT): any object in the bucket for profiles with `role = 'admin'` — admin review access enforced by the database, not frontend visibility.
- **Append-only uploads, as revocations, not omissions.** Postgres RLS treats an UPDATE/DELETE with no dedicated policy as "visible per the SELECT policy" rather than an error, and Supabase's baseline privileges grant UPDATE/DELETE broadly. 0006 therefore explicitly revokes UPDATE/DELETE on `storage.objects` from `anon, authenticated` — otherwise an applicant could rewrite their own object's name into another applicant's path. [006:110]
- **Append-only audit table** `public.provider_application_audit` (application_id FK, reviewer_id FK, previous/new status with the same statuses check as 0005, reason, credential_type/path, created_at) with RLS: SELECT and INSERT restricted to authenticated admins, INSERT with check `auth.uid() = reviewer_id` (no forging on another reviewer's behalf), plus explicit `revoke update, delete` so history cannot be rewritten or erased by anyone. [006:171]
- **Path helper** `public.validate_provider_document_path(p_user_id, p_application_id, p_doc_type, p_file_name)` returning the canonical application-scoped path. [006:201]
- All storage-policy blocks are wrapped in `if to_regclass('storage.objects') is not null` so the migration is still loadable where the storage schema is absent (PGlite) without silently weakening anything: the policies simply don't exist there and neither does the table they'd guard.

### Client library — `lib/storage/upload.ts` (new)
- `validateFile` — MIME whitelist (`image/jpeg|png|webp`, `application/pdf`) and 8 MB limit; extensions are never trusted.
- `buildStoragePath` — sanitises file names (traversal is stripped down to the base name; every character outside `[a-zA-Z0-9._-]` becomes `_`), then composes `provider-applications/{userId}/{applicationId}/{docType}/{safeName}` where `docType` is the typed `"identity" | "credentials"` category, never user-chosen free text.
- `uploadDocument` — `supabase.storage.from("provider-applications").upload(..., { upsert: false })`; never replaces an existing document; throws on failure **before** any DocumentRef is saved, so a failed upload can never leave metadata that pretends a document exists.
- `getDocumentUrl` — short-lived signed URL only (default 15 min); no public/permanent URLs.

### Applicant flow — `app/(app)/provider/onboarding/page.tsx` (modified)
- `DocumentPicker` now accepts `userId`, `applicationId`, `docType` and performs the actual upload when cloud storage is available, showing an error and refecting the pick on failure; offline mode still stores metadata-only, clearly marked.
- `StepIdentity` passes `docType="identity"`, `StepCredentials` passes `docType="credentials"`, plus session user id and application id. The user-facing document-type dropdown (NIN slip, licence, etc.) is stored in `DocumentRef.docType` as before and is never used in storage paths.

### Admin flow — `app/(app)/admin/provider-applications/page.tsx` (modified)
- Each document card gains a **Download** button (only when `storagePath` is present) that calls `getDocumentUrl` and redirects to the short-lived signed URL. A "storage unavailable" note renders when Supabase is not configured.

### i18n — `lib/i18n.ts`
- New keys: `aa_download`, `aa_download_failed`, `aa_storage_not_available`, `aa_storage_not_available_note`; `aa_review_sub` interpolation fixed.

### Type change — `lib/provider-application.ts`
- `DocumentRef` gains optional `storagePath?: string` — metadata-only by design; file bytes never touch localStorage, and the path alone can't be used to read anything (policy check + signed URLs rule that out).

---

## 2. Migration reconciliation (pre-existing fix preserved)

The uncommitted `0001_init.sql` fix — `is_staff()` moved after the tables it references — was verified and preserved (byte-identical body). It is NOT in commit `3dc7cbc`; the working tree is authoritative here.

- `0001–0004` apply cleanly on fresh PGlite with `check_function_bodies = on` (no harness workarounds).
- `0005` initially failed in PGlite on `storage.buckets`. Rather than skipping it, the new documents harness (`tests/pglite/documents.js`) stubs a minimal Supabase-shaped `storage` schema (buckets/objects + `foldername()`), so 0005 and 0006 run for real.

## 3. Verification — the two bugs the harness caught in this migration tree

These would have failed on a real Supabase project, not just PGlite:

1. **`%TYPE` in `CREATE TABLE`** — 0006 used `public.provider_applications.status%type` for audit statuses. `%TYPE` is PL/pgSQL-only; plain SQL DDL rejects it (`syntax error at or near "%"`, reproduced). Fixed by declaring `text` explicitly with the same check constraint as 0005, plus a comment.
2. **`CREATE POLICY IF NOT EXISTS`** — not valid Postgres either (`syntax error at or near "not"`). Fixed with the repo's established drop-if-exists-then-create pattern.

Both were caught by requiring the whole sequence (0001→0006) to apply at `check_function_bodies = on` — the same strictness a `supabase db push` would apply: 6/6 migrations now apply in order.

## 4. Database behaviour verification — `tests/pglite/documents.js`: 27/27 checks

Runs as `anon` / `authenticated` / `service_role` with JWT sub/claim emulation, never as the table owner, so RLS and grants decide every outcome. Highlights:

| Area | Result |
|---|---|
| Bucket exists and is private; no public buckets | OK (0005) |
| Applicant uploads under own path segment | OK |
| Applicant upload into *another* applicant's path | rejected by policy |
| Policies leak into other buckets (`avatars`) | rejected |
| Applicant reads back own document | OK |
| Applicant cannot read other applicants' documents | OK (own-only) |
| Applicant cannot **delete or rewrite** their own upload | rejected (revocation) |
| Anonymous: read objects / upload / read audit | all nothing |
| Admin (via documented `grant_role()` path, not signup self-assignment — signup as admin correctly lands as `consumer`) reads all documents | OK |
| Admin appends audit row as themselves | OK |
| Admin forges review as someone else | rejected (`auth.uid() = reviewer_id`) |
| Applicant/anonymous read or append audit | rejected |
| **Any** principal updates or deletes audit history | rejected (permission denied; revokes hold) |
| Path helper returns the canonical scoped path | OK |

Also verified along the way: the 0005 admin insert policy means application rows are provisioned via the admin/service path — consistent with 0003's "grant_role is the only supported promotion path".

## 5. Unit/integration verification — `tests/storage-upload.test.ts`: 13 checks
- MIME whitelist accept/reject (incl. SVG, zip, empty type), 8 MB boundary at exactly and above the limit.
- Path scheme: segment [2] is the user id; `../..` traversal and `C:\Users\evil\...` are collapsed to the safe file name only; unsafe characters become `_` one-for-one; `.env` is preserved but harmless because ownership is re-verified by the policy on segment [2], not the file name.
- `userIdFromStoragePath` returns null outside the namespace or for over-short paths.

## 6. Regression status

- `npm test`: **209/209 pass** (196 pre-existing + 13 new; no regressions).
- `npm run build` (Next.js 16 / Turbopack, static export): **compiles clean**, no type errors.
- `node tests/pglite/documents.js`: **27/27 checks pass**, full 0001→0006 sequence, strict.
- Pre-existing harnesses (`migrate.js`, `privacy.js`, etc.) untouched; bootstrap harness intentionally still stops at 0004 (0005/0006 need the storage stub, which `documents.js` provides).

## 7. Security posture summary

- Document bytes live only in a private bucket; metadata in `provider_applications` JSONB; **nothing in localStorage**.
- Cross-applicant upload/read prevented at the DB layer by path-segment ownership + admin-gated view policy; `storagePath` alone in metadata grants nothing without a valid session.
- Admin downloads are 15-minute signed URLs; no OCR/public URL/pass-through of document contents anywhere; no broad anon/authenticated policy.
- Audit trail cannot be forged, rewritten, or erased — the only even-admin mutation is an insert as themselves.
- Off-path confirmed untouched: emergency-request and coverage-area policies unmodified (privacy.js tiny suite still passes in the 209).

## 8. Known limits / follow-ups

- `handleDownload` uses `window.location.assign` on the signed URL — session-cookie-free redirect, no content-type enforcement client-side (signed-URL semantics handle it).
- The audit table has no UI surface yet for *showing* history in the admin page (records exist from the review action wiring place: currently the admin page's review modal saves `reviewNote`/`reviewed_by` on the application row; wiring an audit insert into `reviewApplication` path is a small follow-up).
- `0006` is unverified on a real Supabase project (`supabase db push` in CI/prod) — by constraint this session never touched production. The PGlite harness covers SQL shape and RLS behaviour; Supabase-specific `storage` internals are stubbed and rely on those stubs mirroring documented semantics.

## 9. Change inventory (all uncommitted)

| File | Change |
|---|---|
| `supabase/migrations/0006_storage_policies.sql` | new — storage policies, audit table, path helper, revokes |
| `supabase/migrations/0001_init.sql` | pre-existing uncommitted fix preserved (is_staff ordering) |
| `lib/storage/upload.ts` | new — validateFile/buildStoragePath/uploadDocument/getDocumentUrl |
| `app/(app)/provider/onboarding/page.tsx` | upload-on-pick wiring for both document steps |
| `app/(app)/admin/provider-applications/page.tsx` | signed-URL download for admins |
| `lib/i18n.ts` | 4 new keys + review_sub fix |
| `lib/provider-application.ts` | DocumentRef.storagePath optional field |
| `tests/pglite/documents.js` | new — 27-check DB behaviour harness (0001→0006) |
| `tests/storage-upload.test.ts` | new — 13 unit checks |
| `tests/pglite/migrate.js` | unchanged-but-note: documents.js authored reusing its helpers |

Nothing was committed, pushed, or deployed. The repair step for the reviewer is: keep `bootstrap-output.txt`, etc. untracked; when the user says the word, the 41-line change set (incl. 6 pre-existing modified files + 20 untracked) is the commit candidate set.
