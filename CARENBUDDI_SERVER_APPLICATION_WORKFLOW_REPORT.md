# CarenBuddi — Server-Authoritative Provider Application Workflow (Migration 0007)

Status: **implemented and verified against PGlite; NOT verified against a real
Supabase project, and NOT production-ready until that integration test is run
in a controlled environment.**

> Follow-up (same session): migration **0008** adds the Storage bucket
> upload configuration requested for pre-release — 8 MiB limit and the
> four-type MIME allowlist. See section "Storage configuration (0008)"
> below. The real-Supabase integration environment could not be started
> (Docker is not installed on this machine); the requirement is recorded,
> not substituted. Nothing is release-ready declared.

## What changed and why

Previously an applicant's application status lived only in
`localStorage` (`healthlink:provider-applications`), and the admin review
modal accepted decisions without persisting anything at all. Verification
state therefore had no single authority: a device could believe an
application was submitted or verified while the server had no row at all,
and no decision was ever recorded in the audit table.

Migration 0007 makes `public.provider_applications` the only authority:

- **Applicants** can write only their own row, and only through
  `upsert_provider_application(jsonb, boolean)` — a SECURITY DEFINER
  function that takes the real identity from `auth.uid()` (or refuses),
  forces `user_id`, validates the document storage paths (segment [2] must
  be the caller, segment [3] must name the row id), enforces submission
  preconditions (terms/privacy accepted, category, identity document),
  locks rows the moment they leave draft/needs-info, preserves a
  `needs-info` request across draft saves, and tolerates no status,
  timestamp or review-field writes.
- **Administrators** can change status only through
  `review_provider_application(uuid, text, text, text, text)`: transition
  matrix (`can_review_transition`), mandatory reason for needs-info /
  rejected / suspended, row update + audit insert in ONE transaction, and
  the reviewer id recorded is always the administrator's own uid derived
  from the JWT — no caller-controllable reviewer field exists.
- **UPDATE/DELETE are revoked** from `anon` and `authenticated` on the
  applications table (the Supabase default grants plus the 0005 update
  policy would otherwise let an admin session change status without a
  audit trace). service_role and database owners retain their inherent
  privileges — this is documented, not hidden: a service key or DBA can
  bypass RLS by design, which is why the anon key is role-free and the
  admin identity is stored in the profile table, not client state.
- **Reading**: `provider_applications_select_own` lets applicants read
  their own row; the pre-existing admin select policy lets administrators
  read all rows; `provider_application_audit_select_admin` (0006) already
  restricted the audit table to administrators and the table remains
  append-only (explicit `revoke` in 0007's chain, no update grant).

## Files

New:
- `supabase/migrations/0007_application_workflow.sql` — select policy, both
  RPCs, transition helper, rolls back grants/revokes.
- `lib/server-provider-applications.ts` — the one place the browser
  touches these tables/RPCs: `saveApplicationToServer`,
  `applyReviewDecision`, `fetchAuditTrail`, `useServerApplications`,
  `useServerApplication`, row/payload mapping.
- `tests/pglite/applications.js` — 36-check harness over 0001..0007.
- `tests/provider-server.test.ts` — 12 unit tests (contract with 0007).

Modified:
- `app/(app)/provider/onboarding/page.tsx` — drafts best-effort sync to
  the server (failures ignored; drafts stay usable offline), submission is
  server-authoritative and asynchronous with a submitting/spinner and a
  persistent error. A failed submission never marks the local application
  submitted.
- `app/(app)/admin/provider-applications/page.tsx` — dashboard reads the
  server only (loading / ready / error-with-retry / offline states, no
  localStorage fallback), decision buttons are filtered through
  `APPLICATION_TRANSITIONS` for the row's current status, and the decision
  submits through the RPC. A refused decision leaves the modal open with
  the error; nothing is persisted without the database accepting it.
- `app/(app)/provider/status/page.tsx` — status is the server's row;
  local state is displayed only while the server knows no row and reads
  as "draft"; server-error and offline states are distinct.
- `lib/provider-application.ts` — adds `APPLICATION_TRANSITIONS` and
  `canTransition` (mirrors the SQL matrix; `reviewApplication` untouched
  on purpose — the transition rule is the database's, not the pure
  module's, and existing tests submit from draft).
- `lib/i18n.ts` — new copy keys for loading/error/offline/retry states
  (inline English fallbacks accompany every call; other dictionaries
  inherit the English key via the translate() chain until translated).

## Review transaction, end to end

1. Admin opens a row; only decisions legal for `status` are offered.
2. `applyReviewDecision(id, decision, reason)` calls the RPC; the DB
   derives the reviewer, locks the row, validates the transition and the
   reason and writes both the row update and the audit row in one
   statement-set; any refusal rolls back completely.
3. On success the dashboard reloads; the applicant's status page shows
   the new status the next time it reads the server. Nothing in the
   client ever decides a status.

## What this deliberately does NOT fix

- Supabase Storage buckets from 0005 still have no `file_size_limit` or
  `allowed_mime_types` (the client-side `validateFile` remains the only
  MIME/size gate). Documented in the previous report.
- `fetchAuditTrail` is exposed by the client lib but not yet rendered in
  the detail modal; the reviewed-at/reviewed-by summary on the row
  remains.
- Devices carrying pre-0007 local "submitted" rows and no server row now
  see "no application yet" + an explanatory note; re-submitting through
  the wizard works (the server row is created fresh).
- The SQL function's error strings are part of the operator contract;
  `describeServerFailure` maps identity/permission/network ones to calm
  copy and passes the rest through.

## Test results (this session, all green)

| suite | result |
| --- | --- |
| node:test units (`npm test`) | 223/223 (211 prior + 12 new) |
| PGlite applications (0001..0007) | 36/36 |
| PGlite documents (0001..0006) | 27/27 |
| `npm run build` (Turbopack) | clean |
| eslint on touched files | 0 errors (12 pre-existing warnings) |

PGlite highlights: applicant cannot read/write another account's row;
submission preconditions; applicant cannot update rows directly even as
an admin (0007 revokes); review call requires admin; matrix refusals
leave no audit row; five decision sequence from submitted→rejected
leaves exactly five audit rows with the admin uid; document paths naming
another user or application refused; anonymous calls refused on both
RPCs.

## Still required before release

1. **Real-Supabase integration test** in a staging project: apply
   0001..0007 against Supabase (supabase db push), exercise sign-in /
   upload-to-storage / submit / review / audit with one provider and one
   admin. Migration 0007's functions depend on PostgREST's
   `on_conflict`-free rpc path — the RPC carries its own id-adoption
   logic, but the first real call is what actually proves the SQL.
2. Snapshot the SQL upsert/review functions again after any future
   credential-verification change to keep the client matrix, helper and
   SQL list identical (regenerate and re-run
   `tests/provider-server.test.ts`).
3. Bucket-level `allowed_mime_types`/`file_size_limit` on uploads once
   storage limits are finalised — **done in 0008** (below); the remaining
   real-Storage execution checks are item 4.
4. Production deploy only after (1) and the item-4 checks; no production
   secret is stored in this repo (env vars only).

---

# Storage configuration (0008) — follow-up pre-release work

## The migration

`supabase/migrations/0008_storage_upload_limits.sql` (new, forward-only,
idempotent): `insert into storage.buckets ... on conflict (id) do update`
pins the existing private `provider-applications` bucket to:

- **`file_size_limit = 8388608`** (8 MiB) — the same boundary the client
  already enforces (`MAX_DOC_BYTES` in `lib/storage/upload.ts`). Chosen
  against the actual documents the flow collects: identity/credential
  evidence is a phone photo or scan of a NIN slip, licence, or
  registration certificate; a document-quality JPEG/PNG/PDF sits well
  below 8 MB, so 8 MiB rules out raw camera dumps and document bundles
  without rejecting real submissions.
- **`allowed_mime_types = {image/jpeg, image/png, image/webp,
  application/pdf}`** — exactly the client whitelist. SVG is excluded
  (active content), archives/text/key files excluded (nothing a verifier
  needs).
- **`public = false`** restated in the upsert — the bucket stays private.

It touches only this one bucket row; other buckets, every policy, and
authentication settings are untouched.

## Why client validation alone was not enough

Before 0008, the 8 MB / MIME checks lived only in `validateFile()` inside
the browser bundle — a request against the Storage API could bypass them
completely. Bucket configuration closes that gap for **size** fully:
`file_size_limit` is enforced by the Storage API service itself, without
any client cooperation.

**Honest limitation:** the MIME list is validated against the Content-Type
*header*, which is supplied by the uploading client. A byte stream that is
not actually an image but is sent with an allowed header can still be
stored, and the server-side MIME check does not prove file contents.
Storage-API file-content sniffing is outside what bucket configuration can
do; this remains an open limitation. Narrow mitigations in place: only
four low-risk types accepted, the bucket is private, reviewer access is
via short-lived signed URLs (0006), and the applicant cannot rewrite or
delete objects after upload (0006 revokes).

## What PGlite could and could not verify

Verified in the extended documents harness (`node tests/pglite/documents.js`,
now **effectively the 0005–0008 storage chain**: 31/31 checks, including 4
new 0008 checks):

1. 0001→0008 apply strictly in order (0007 included in the chain now).
2. The bucket row carries `file_size_limit = 8388608`.
3. `allowed_mime_types` equals the four expected strings, order and all.
4. The bucket remains private after 0008; no public buckets exist.
5. 0008 re-applies cleanly (idempotent upsert, limits unchanged).
6. All previous storage-policy guarantees still hold in the same DB
   state: owner-segment uploads, no cross-applicant upload/read, append-
   only uploads, anon denied, admin review read, audit immutability.

Complementary-scope sanity (why policies + limits are both needed):
the policies decide **who may upload where**, and 0008 decides **what an
authorized upload may contain** — neither can substitute for the other:
without 0008 an authorized client could bypass client-side validation on
size/MIME; without 0006-policies nobody could upload at all or everybody
could upload anywhere.

## Real-Supabase integration environment — could NOT be run

Requirement for a faithful check, this session could not provide it:

- `npx supabase` (CLI 2.121.0) **is available** on the machine.
- Starting a disposable local stack (`supabase init` + `supabase start`)
  requires **Docker Desktop/Engine**, and **Docker, Podman, and Docker
  Desktop are not installed** on this machine (checked binaries,
  Program Files, and services). No local Supabase stack can start here.
- PGlite + the storage stub was used instead for SQL/state verification.
  It legitimately verifies migration SQL and RLS policy outcomes, but
  the storage stub does NOT execute the real Storage API: it cannot
  enforce `file_size_limit` on real request bytes, cannot validate the
  Content-Type/byte-stream gap, and cannot issue or expire signed URLs.

### Tests that therefore remain UNRUN (recorded, not substituted)

Real-Storage items from the Phase-4 checklist that need a Docker-backed
local stack (or a disposable cloud project), in priority order:

1. Size rejected: an 8 MiB + 1 byte upload via `storage.from("provider-
   applications").upload(...)` fails with 400/`limit exceeded`, while
   exactly-8-MiB passes — proving the row value is honored by the service.
2. MIME rejected: a `.docx`/`.exe`/`.txt` upload whose request Content-
   Type is outside the allowlist fails, though the DB-side policy would
   have allowed the path.
3. Content-Type/byte mismatch is nominally *not* caught server-side
   (documented limitation) — record the actual service behavior.
4. Signed-URL retrieval: admin can open expiring URLs; an unsigned,
   unsignable anon/cross-user attempt fails.
5. `supabase init` + `apply migrations 0001..0008 + seed` via `supabase
   db reset`, then re-run the two emulation harnesses' logic as real
   JWT sessions against auth + PostgREST.

### Setup required to run them later

On a machine with Docker running:

```powershell
npm exec supabase@2 init            # creates supabase/config.toml (untracked)
npm exec supabase@2 start           # disposable local stack, ephemeral keys
npm exec supabase@2 db reset        # applies 0001..0008 in order
# then run the same Phase-4 scenario against the printed local
# URL/anon key (they are printed to console, not stored anywhere)
```

Everything above is disposable/no-production; no credentials or keys are
stored in the repo at any point.

## Additional reviewed items in this pass

- Client MIME/size choices re-checked against what each step uploads
  (identity/credential scans, PNG/WEBP screenshot fallbacks, PDF for
  official documents): 8 MiB and the four types are defensible; both
  now enforced once client-side and once storage-side.
- Docs effectively confirm: 0006's explicit UPDATE/DELETE revokes are
  still what makes applicant uploads append-only; 0008 adds no policy
  and never weakens any.
- The Emergency-privacy migration 0004 is untouched, as instructed.

## Regression status for this pass

Distinguishing test families clearly:

| suite | family | result |
| --- | --- | --- |
| `node tests/pglite/documents.js` (0001→0008 strict) | PGlite harness (with storage stub) | **31/31** (27 prior + 4 new) |
| `node tests/pglite/applications.js` (0001→0007) | PGlite harness (workflow RPCs) | **36/36** |
| `npm test` | node:test units (client-side, incl. `tests/provider-server.test.ts` 12 checks and `tests/storage-upload.test.ts` 13 checks) | **223/223** |
| `npm run build` | Next.js static export | **clean** |
| eslint touched files | 0 errors, 12 pre-existing warnings |

Not available this session: any real-Supabase stack (Docker missing) — see above; nothing about PGlite results is to be read as proof of real-Storage API behaviour.

## Current Git state

- Working tree: **51 changed paths** (uncommitted, as required). HEAD is
  still the same commit this session started from; no commits, pushes,
  or staging.

