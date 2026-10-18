# CareNBuddi — Security Remediation Plan

**Status:** PLAN ONLY. No application source files were modified. No migrations were executed. Production cloud authentication remains disabled.
**Prepared against:** commit `ca55822`, following `CARENBUDDI_TECHNICAL_AUDIT.md`.
**Scope:** the seven confirmed critical security and privacy findings, plus the architecture required to fix them safely.

This document distinguishes throughout between:

- **CONFIRMED** — verified against current source in this pass, with file and line references.
- **ASSUMPTION** — design premise that must be validated before implementation.
- **UNVERIFIED** — plausible but not established; listed in §11.

---

# 1. Verification of the confirmed findings

Every finding was re-checked against the source tree rather than taken from the audit report. **No contradiction was found.** Two additional architectural constraints were discovered during verification that materially change the remediation design.

## 1.1 Finding 1 — Sign-in does not verify the password — **CONFIRMED**

`app/auth/sign-in/page.tsx:79-93`

```ts
const signInOffline = (): boolean => {
  const key = email.trim().toLowerCase();
  const existing = users.find((u) => u.email.toLowerCase() === key);
  if (!existing) { /* error */ return false; }
  setSession((prev) => ({ ...prev, userId: existing.id }));   // password never consulted
  return true;
};
```

Machine-checked: the substring `password` **does not appear anywhere inside `signInOffline`**.

Dispatch gate: `app/auth/sign-in/page.tsx:50` — `const cloudMode = isCloudEnabled;`
Gate definition: `lib/supabase/client.ts:12` — `export const isCloudEnabled = Boolean(url && anonKey);`

`isCloudEnabled` is `false` in the deployed build, therefore `signInOffline` is the live sign-in path in production.

**Consequence:** knowledge of an email address is sufficient to obtain that account's session and read its complete unencrypted local health record.

Related: `app/auth/sign-up/page.tsx:120-134` — signing up with an existing email **silently claims the existing local account** (overwrites `phone`, sets session to the existing `userId`) with no credential check. The `User` type has no password field, so the collected password is discarded entirely.

## 1.2 Finding 2 — Sign-out does not clear or isolate sensitive data — **CONFIRMED**

Five sign-out sites identified:

| File:line | Action |
|---|---|
| `app/(app)/profile/page.tsx:256, 262` | `cloud.signOut()` (conditional), then `setSession(userId: null)` |
| `components/profile-settings.tsx:105, 111` | duplicate of the above |
| `lib/supabase/cloud.tsx:210` | `supabase?.auth.signOut()` — clears no local key |
| `components/cloud-account.tsx:85` | trigger only |
| `app/(app)/profile/page.tsx:840`, `components/profile-settings.tsx:338` | confirm-dialog triggers |

Machine-checked: `localStorage.clear`, `removeItem`, `clearLocal`, `eraseLocal`, `purgeLocal`, `wipeLocal`, `clearAll` → **zero occurrences across `app/`, `components/`, `lib/`.**

**Consequence:** every private key survives sign-out. `components/app-guard.tsx:130-131` offers "Continue as guest" which bypasses the private-route gate while every `useStoredCollection` hook continues reading the same keys. Only `lib/profile-photo.ts:88-93` scopes reads by `userId`; all other collections are unscoped.

## 1.3 Finding 3 — Provider document upload discards the file — **CONFIRMED**

`app/(app)/provider/onboarding/page.tsx:404-413`

```ts
const file = e.target.files?.[0];   // L404
event.target.value = "";
if (!file) return;
onPick({ docType: ..., fileName: file.name, sizeBytes: file.size,
         mimeType: file.type, addedAt: new Date().toISOString() });   // L407-413
```

Confirmed: no `FormData`, no `fetch` upload, no storage bucket anywhere in the application.
Persisted shape is `lib/provider-application.ts:109-115` — `DocumentRef { docType, fileName, sizeBytes, mimeType, addedAt }`: **no storage path, no content hash, no uploader identity, no review state.**

## 1.4 Finding 4 — RLS permits role escalation and over-broad booking access — **CONFIRMED**

| Element | Location | Verified text |
|---|---|---|
| Mutable role column | `supabase/migrations/0001_init.sql:71` | `role text not null default 'consumer' check (role in ('consumer','provider','admin'))` |
| Row-scoped, column-unscoped update | `0001_init.sql:167-169` | `for update using (auth.uid() = id) with check (auth.uid() = id)` |
| Unscoped staff read | `0001_init.sql:181-183` | `for select using (auth.uid() = user_id or public.is_staff())` |

Confirmed by search across both migrations: **no trigger guards `role`**, and there are **no column-level `GRANT`/`REVOKE` statements**. The only triggers present are `*_set_updated_at` and `on_auth_user_created`.

**Consequence:** `update public.profiles set role='admin' where id=auth.uid()` satisfies both `using` and `with check` (still the caller's own row) and passes the check constraint. `is_staff()` then unlocks every staff-scoped policy.

## 1.5 Finding 5 — Cloud authentication is disabled in the deployed bundle — **CONFIRMED**

- `lib/supabase/client.ts:3-4` reads `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `lib/supabase/client.ts:12` — `isCloudEnabled = Boolean(url && anonKey)`.
- `.env.local` **does not exist**; only `.env.local.example` (placeholders only).
- Live bundle `/_next/static/chunks/2za3y1vrn4bre.js` → **0** matches for `[A-Za-z0-9-]{6,}\.supabase\.co`.

Therefore the entire auth, sync and account subsystem is inert in production.

## 1.6 Finding 6 — Sensitive health data in browser storage — **CONFIRMED**

`lib/storage.ts:17-43` declares **22** `healthlink:`-prefixed keys, including `menstrual-cycles`, `mood-entries`, `symptom-entries`, `records`, `journal`, `reminders`, `care-circle`, `passport`, `profile-photos`, plus further keys declared outside `KEYS` (`lib/support.ts:72,76,79`, `lib/provider-practice.ts:118`, `components/auth-form.tsx:22`).

No `crypto.subtle` / `CryptoKey` usage anywhere. All values are plaintext JSON.

## 1.7 Finding 7 — Client-side provider-workspace model is sound and must be preserved — **CONFIRMED**

`lib/provider-workspace.ts` exports **8** functions; `tests/provider-workspace.test.ts` contains **16** `test()` blocks; `e2e/provider-workspace.mjs` contains 19 checks. All 76 unit tests pass.

Correct properties to preserve:
- `careRelationships()` — only bookings naming this provider with non-null `userId`.
- `canAccessCare()` — requires a non-cancelled booking connecting both parties.
- `unassignedRequests()` — guest bookings are requests, not patients.
- `dashboardCounts()` — every count derived from the same list the screens render; no invented figures.
- `workspaceAccess()` — unverified applicants locked out; accounts without an application not locked out.
- Availability is opt-in (`lib/provider-practice.ts`); blank fee is "not set", not free; undated bookings are never "upcoming".

**This plan must bring the database into line with this model, never the reverse.**

---

## 1.8 NEW — Two architectural constraints discovered during verification

These were not in the audit report and they change the migration design.

### C-1 — The database has no concept of a provider application — **CONFIRMED**

Full table inventory across both migrations:

```
public.profiles                        (0001_init.sql)
public.health_documents                (0001_init.sql)
public.bookings                        (0001_init.sql)
public.provider_requests               (0001_init.sql)
public.reports                         (0001_init.sql)
public.emergency_requests              (0002_rapid_response.sql)
public.emergency_request_events        (0002_rapid_response.sql)
public.provider_emergency_participation (0002_rapid_response.sql)
```

Searched for `provider_applications`: **absent.** Searched for `create bucket` / `storage.buckets`: **absent.**

Provider registration, onboarding, credential capture and verification status exist **only in client-side localStorage** (`lib/provider-application.ts`, key `healthlink:provider-applications`).

**Implication:** RLS **cannot** enforce "verified providers only" today, because the database does not know who a provider is or whether they were verified. A server-side representation of provider verification must be created before any provider authorisation policy can be written. This is the single largest structural gap.

### C-2 — Client and database `bookings` models diverge — **CONFIRMED**

| | Client `lib/types.ts:129-152` | Database `0001_init.sql:89-100` |
|---|---|---|
| status values | `new`, `contacted`, `confirmed`, **`completed`**, **`cancelled`** | `new`, `contacted`, `confirmed`, **`closed`** |
| date field | `date?: string`, `time?: string` | `preferred_date date` |
| type field | `kind?: ConsultationType` | `service text` |
| provider link | `providerId: string \| null` | `provider_id text` — **no foreign key** |
| extras | `specialty?`, `cancelledAt?` | — |

**Implications:**
1. The client's care-relationship rule treats `cancelled` as terminating access. The database has no `cancelled` value — only `closed`. A care-relationship predicate written today would be wrong.
2. `provider_id` is unconstrained `text` with no referential integrity. It cannot be reliably matched to an authenticated principal, so it cannot be used as an authorisation key until it references a real principal.

---

# 2. Proposed security architecture

## 2.1 Principles

1. **The client is never trusted.** A `role` in localStorage, a value in a profile row, a React state field, or `AppGuard` are all attacker-controlled. No authorisation decision may depend on them.
2. **Every sensitive authorisation decision is enforced by Supabase RLS, or by the Cloudflare Worker while holding a service-role credential.** Both are trusted server-side components.
3. **Capability is derived, not asserted.** Roles are server-managed state with a controlled transition API.
4. **Fail closed.** If session state is missing, ambiguous or expired, the request is denied — never defaulted to allow or to guest-with-previous-user-data.
5. **Deny by default in storage.** A private key that cannot be attributed to the current principal is not readable.
6. **The static export is not a security boundary.** It ships an attacker-readable copy of all client logic; only the Worker and the database are boundaries.

## 2.2 Identity and capability tiers

Seven distinct tiers. Each is defined by what a **trusted server-side component** will accept, not by what the browser asserts.

| # | Tier | Definition (trusted) | May access | Explicitly may NOT |
|---|---|---|---|---|
| 1 | **Unauthenticated visitor** | No valid Supabase JWT | Marketing, `/privacy`, `/terms`, `/careers`, `/auth/*`, public provider directory, **emergency guidance and emergency numbers** | Any PHI. Any authed-only route. |
| 2 | **Guest** | No account; no JWT | Public directory; may submit an unlinked booking request (`bookings.user_id is null`) | Any user's health_documents, bookings, applications, or support transcripts |
| 3 | **Authenticated patient** (`profiles.role='consumer'`) | Valid JWT, `profiles.role='consumer'` | **Only** `health_documents where user_id = auth.uid()`; own bookings; own profile row (non-privileged columns); own support tickets | Another patient's documents; any `provider_*` row; any staff surface; **changing own `role`** |
| 4 | **Unverified provider** (`role='provider'`, `provider_applications.status != 'verified'`) | Valid JWT, role provider, application not verified | Own `provider_applications` row and its own documents; own profile; the public provider directory | **Any** patient record. **Any** booking. The practice workspace. Any verified-provider capability. |
| 5 | **Verified provider** (`role='provider'`, application `status='verified'`) | Valid JWT, role provider, **and** server-side application status verified | Bookings and care-relationships where they are the provider of record; patients connected to them; own practice settings; own clinical notes | Patients **not** connected to them by a live care relationship. Other providers' bookings. Administrative actions. |
| 6 | **Facility administrator** (`role='facility_admin'`) | Valid JWT, role facility_admin, membership in `facility_staff` | Facility roster and rota; facility-scoped scheduling metadata | **Clinical records and consultation notes.** Free-text clinical `message` fields. Any patient's `health_documents`. Verification documents. |
| 7 | **Platform administrator** (`role='admin'`) | Valid JWT, role admin, **and** a recent MFA/re-auth assertion for privileged actions | Provider review; verification documents (read-only, audited); role transitions; emergency coordination | — |

### 2.3 Two separations that matter clinically

- **Tier 5 vs Tier 6.** A facility administrator is non-clinical. They must be able to run the facility without seeing clinical content. This requires a **redacted projection**, not merely a role check, because `bookings.message` and `bookings.phone` are PHI (`0001_init.sql:94-95`).
- **Tier 5 vs "the provider's own patients as a person."** A verified provider acting in a clinical capacity (tier 5) and the same human using the app as a patient (tier 3) are **different capability contexts**. The provider's personal health section must never expose a patient's records, and provider capability must never leak into personal browsing. This is already the intent in `lib/provider-workspace.ts`; it becomes enforceable once tier 5 is scoped server-side.

## 2.4 Where each control lives

| Control | Home | Rationale |
|---|---|---|
| Credential verification | **Supabase Auth** | Never custom. Never client-side. |
| Session issue/validate/refresh | **Supabase Auth** | Signed JWT; client holds a session, not authority |
| Row-level data access | **Postgres RLS** | Cannot be bypassed by a modified client |
| Document upload / review / role transitions | **Cloudflare Worker + service role** | Privileged mutations never run from the browser |
| Route gating (UX only) | `components/app-guard.tsx` | Retained for user experience; **not** a security control |
| Local data isolation | **`lib/storage.ts` + a key-manifest** | Prevents cross-user leakage on shared devices |

## 2.5 Why the Worker is in the path

This is a **static export** — there is no Next.js server to host privileged endpoints. Therefore:

- **Unprivileged auth** (sign-up, sign-in, recovery, session refresh) → Supabase Auth directly from the browser. This is a supported Supabase flow for static sites.
- **Privileged operations** (document upload, reviewer decision, role transition) → `worker/index.ts` endpoints that validate the caller's Supabase JWT and only then use the **service-role key held as a Wrangler secret**. The service-role key **must never** be exposed to any `NEXT_PUBLIC_*` variable or shipped in the bundle.

This extends the existing Worker, which already correctly handles a `AI_API_KEY` secret, an origin allow-list and a rate limit (`worker/index.ts:33-62, 188-200`).

---

# 3. Task 3 — Authentication remediation plan

## 3.1 Decision: use Supabase Auth; do not build a custom password system

Supabase Auth is the correct choice because:

- `@supabase/supabase-js` is already a dependency (`package.json:17`).
- Both migrations already reference `auth.users` and `auth.uid()` (`0001_init.sql:67`, `:174`, `:183`), so the schema was designed for it.
- Password hashing, breach-password screening, rate limiting, session rotation, MFA and recovery are solved and maintained upstream. Reimplementing any of this would be strictly worse.

**Explicitly rejected:** storing a hash in localStorage, client-side comparison, or any "obfuscation" of a password. Finding 1 must be fixed by **removing** the password-less path, never by adding a client-side check.

## 3.2 Missing configuration (precise)

| Requirement | Status | Action |
|---|---|---|
| Supabase project | **ABSENT** | Create a **disposable** project first (§7.2), then a production project |
| `NEXT_PUBLIC_SUPABASE_URL` | **unset** | Set only after gates pass |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **unset** | Client-safe by design (anon key is RLS-bound) |
| **Service-role key** | **ABSENT** | `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY` — **Worker only, never `NEXT_PUBLIC_*`** |
| Auth redirect allow-list | **ABSENT** | Register the site origin, `/auth/callback`, `/auth/verify`, recovery and OAuth origins |
| Email delivery (confirmations + recovery) | **ABSENT** | Configure SMTP or accept the built-in rate-limited provider |
| Email confirmation | unknown | **Must be ON** for consumer sign-up |
| Session settings | unknown | Set expiry, refresh-token rotation, idle timeout |
| Leak protection / CAPTCHA | unknown | **Must be ON** before public launch |

## 3.3 Implementation steps (ordered)

1. **Delete `signInOffline`** (`app/auth/sign-in/page.tsx:79-93`) and its call site at `:102`. Replace with an explicit error when cloud is unconfigured — e.g. *"Accounts are temporarily unavailable."* **Do not** silently fall back to a local account.
2. **Delete the existing-email takeover** in `signUpOffline` (`app/auth/sign-up/page.tsx:120-134`). Sign-up must always create a new Supabase user.
3. **Make `cloudMode === false` a hard stop**, not a degraded mode. The current fallback is the vulnerability. Consider rendering an explicit "offline demo" banner, and ensure it cannot be mistaken for a real account.
4. **Route all credential operations through Supabase Auth**: `signUp`, `signInWithPassword`, `signOut`, `resetPasswordForEmail`, OAuth (`cloud.tsx:181-243` already correct).
5. **Require email confirmation** before a consumer session is usable. Note this changes the current sign-up UX (today `signUpOffline` returns `needsConfirmation=false`).
6. **Bind the local session to the Supabase user.** Replace `healthlink:session = { userId, lang }` with the Supabase session's `user.id` as the sole identity source; `userId` must never be settable independently.
7. **Keep** the same-site `?next=` validation (`app/auth/sign-in/page.tsx:111-114`) and the role-aware landing logic (`lib/post-auth.ts`) — both are correct and should be preserved.
8. **Account recovery** must go through Supabase's recovery flow only. The offline stub at `app/auth/forgot-password/page.tsx` must not present a dead end or imply a reset occurred.
9. **Remove the on-screen verification code** shipped in `app/(app)/account/page.tsx:196, 224` ("demo mode shows the code instead of sending email"). It is misleading in production.

## 3.4 Session handling

| Requirement | Implementation |
|---|---|
| Storage | Supabase default (localStorage) is acceptable **only** while tier 3+ holds no local PHI. After Task 4, client storage holds encrypted-or-ephemeral data and is not an authority. |
| Expiry | Honour Supabase token expiry; on `TOKEN_REFRESHED` re-derive identity. |
| Idle timeout | Force re-auth after N minutes for tiers 5–7. |
| Revocation | `signOut()` scopes a `signOut(scope)`; consider global sign-out on password change. |
| Tamper resistance | Client JWT is not trusted for authorisation regardless of verification — RLS re-checks server-side. |

---

# 4. Task 4 — Local data protection plan

**Constraint honoured:** do not clear storage indiscriminately; doing so would destroy unrelated device preferences and user-visible state.

## 4.1 Current state

22 unscoped `healthlink:` keys in `lib/storage.ts:17-43`, plus keys declared in `lib/support.ts:72,76,79`, `lib/provider-practice.ts:118`, `components/auth-form.tsx:22`, `components/theme-provider.tsx:8`, `components/profile-settings.tsx:38-39`, `components/onboarding-flow.tsx:12`, `lib/analytics.ts:29`, `lib/rapid-response.ts:312`, `app/(app)/health-days/page.tsx:62`, `app/(app)/worker/page.tsx:49-50`, `lib/supabase/sync.ts:31-35`.

## 4.2 Classification (drives both isolation and cleanup)

### Class A — Private, per-user. Delete on sign-out. Never readable by another principal.

| Key | Data class |
|---|---|
| `healthlink:journal` | clinical |
| `healthlink:records` | clinical |
| `healthlink:reminders` | medication regimen |
| `healthlink:menstrual-cycles` | reproductive health — highly sensitive |
| `healthlink:mood-entries` | mental health |
| `healthlink:symptom-entries` | clinical |
| `healthlink:health-preferences` | health preferences |
| `healthlink:passport` | health passport |
| `healthlink:care-circle` | third-party PII |
| `healthlink:profile-photos` | biometric image data |
| `healthlink:fitness-profile`, `:workouts`, `:weigh-ins`, `:exercise-reminder` | health data |
| `healthlink:bookings` | PHI + PII |
| `healthlink:provider-applications` | identity + professional credentials |
| `healthlink:practice-settings` | practice configuration |
| `healthlink:auth-pending` | email address |
| `healthlink:support-conversations`, `:support-messages`, `:support-tickets` | PHI + PII |
| `healthlink:worker-log` | aggregate health data |

### Class B — Device preference. **Retained** across sign-out. Not user data.

`healthlink:theme`, `healthlink:prefs-units`, `healthlink:prefs-notifications`, `healthlink:onboarded`, `healthlink:guide-events`, `healthlink:geocode-cache`, `healthlink:worker-online`, `healthlink:synced-at:*`, `healthlink:health-days`.

### Class C — Session. `healthlink:session` (`{ userId, lang }`).

## 4.3 Namespacing strategy

**Change private keys to `healthlink:u:<userId>:<collection>`.**

- Derived from `KEYS` via a single accessor layer in `lib/storage.ts` — `useStoredCollection`/`useStoredValue` already funnel every read, so namespacing is a **central** change, not a per-callsite one.
- `useSession().userId` supplies the principal. If no principal is resolved, the namespace is `none` and **no private key is readable**.
- **Migration of existing data:** on first authenticated load under a Supabase session, copy `healthlink:<collection>` → `healthlink:u:<uid>:<collection>` for that user only, then remove the legacy key. Because current keys are demonstrably shared between accounts, legacy data must be **treated as untrusted** and migrated at most once, with the legacy key deleted afterwards. Do not attempt to attribute pre-existing data to a specific prior user.
- **Guests read `healthlink:guest:<collection>`,** which starts empty and is wiped on session end. A guest can never see a previous user's data because a guest has no `userId` to resolve a private namespace.

## 4.4 Sign-out / session-end routine (single shared function)

Replaces all five current sign-out sites. Must be **idempotent** and callable from any of them.

```
onSessionEnd({ reason: "signout" | "expired" | "switch-account" | "provider-review" })
  1. Capture userId from the current session.
  2. Push any pending Class A data to the server (if configured); on failure, RETAIN and warn.
  3. Delete every key matching `healthlink:u:<userId>:*`   (Class A only)
  4. Delete `healthlink:guest:*`
  5. Delete `healthlink:session`, `healthlink:auth-pending`
  6. Keep all Class B keys.
  7. Clear in-memory state; reset every `useStoredCollection` subscriber.
  8. Invalidate the service-worker runtime cache for any private response.
```

**File:** new `lib/session.ts`, consumed by `lib/supabase/cloud.tsx:207-215`, `components/profile-settings.tsx:101-115`, `app/(app)/profile/page.tsx:252-266`, and the Supabase `onAuthStateChange` handler at `cloud.tsx:141-159`.

## 4.5 Guest handling

- `components/app-guard.tsx:130-131` — "Continue as guest" must resolve the **`guest`** namespace only.
- While a guest is active, `AppGuard` must render no data from any `healthlink:u:*` namespace.
- Exiting guest mode → `SessionEnd(reason: "switch-account")` before establishing the next principal.

## 4.6 Interrupted sessions and shared devices

| Scenario | Required behaviour |
|---|---|
| Tab closed mid-session | On next load, if a Supabase session exists and refreshes, resume; otherwise treat as ended and run `SessionEnd` |
| Token expiry mid-use | On `TOKEN_REFRESHED` failure → `SessionEnd("expired")`, wipe Class A, route to sign-in with a clear message |
| Device handed over | Class A is absent for any new principal by construction; guest cannot read it |
| Crash mid-write | Namespacing makes a partial write visible only to its own principal |
| Multi-tab | `storage` events already drive `onLocalChange` (`lib/storage.ts:191-196`); sign-out in one tab must sign out all tabs |

## 4.7 Additional hardening (low cost, high value)

- Encrypt Class A values at rest with a **non-extractable** `CryptoKey` held only for the session. This raises the bar against casual file/adb access; it is **not** a defence against a compromised origin and must not be presented as one.
- `android/app/src/main/AndroidManifest.xml:8` — set `allowBackup="false"`.
- Add `"cleartext"` guidance and confirm `usesCleartextTraffic="false"` (`:12`) remains.

---

# 5. Task 5 — Database security plan

**Constraint honoured:** the client-side provider-workspace model is preserved and strengthened. No policy below may widen access beyond a valid care relationship.

## 5.1 Migration sequencing

| Migration | Purpose | Rollback |
|---|---|---|
| `0003_provider_verification.sql` | Server-side provider applications, verification events, facility staff, care relationships | `DROP TABLE` (new tables only) |
| `0004_storage_buckets.sql` | Private document bucket + storage policies | `DROP POLICY` + delete bucket |
| `0005_rls_hardening.sql` | Role protection + policy scoping. **Reversible.** | Restores prior policies from `0001`/`0002` text |
| `0006_worker_endpoints.sql` | `security definer` functions for privileged transitions | `DROP FUNCTION` |

`0005` is the only one that touches existing policies. It must be applied to the disposable test project first and validated against §7.2 before production.

## 5.2 `0003` — provider verification and care relationships

Addresses **C-1**: the database has no concept of a provider.

```sql
create table public.provider_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users on delete cascade,  -- one per account
  email text not null,
  full_name text not null,
  category text not null,
  speciality text not null default '',
  qualifications text not null default '',
  institution text not null default '',
  registration_number text not null default '',
  licensing_body text not null default '',
  licence_expiry date,
  nin_ciphertext bytea,            -- encrypted; never returned by any SELECT policy
  status text not null default 'draft'
    check (status in ('draft','submitted','under-review','needs-info','verified','rejected','suspended')),
  identity_status text not null default 'not-started',
  credentials_status text not null default 'not-started',
  submitted_at timestamptz,
  decided_at timestamptz,
  decided_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.provider_verification_events (   -- append-only audit
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.provider_applications(id) on delete cascade,
  actor_id uuid not null references auth.users(id),
  action text not null check (action in ('submitted','review-started','approved','rejected','suspended','reinstated','document-uploaded','document-removed')),
  from_status text, to_status text,
  reason text,
  created_at timestamptz not null default now()
);

create table public.facility_staff (
  facility_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('facility_admin','receptionist')),
  created_at timestamptz not null default now(),
  primary key (facility_id, user_id)
);
```

**RLS for `0003`:**
- `select`: own row only (`auth.uid() = user_id`). Reviewers read via the Worker/service role, **not** via a broad policy.
- `insert`: own row only.
- `update`: own row **and only while `status = 'draft'` or `'needs-info'`**. Once `submitted`, the client must not mutate status fields. Enforce with a `with check` that the status is unchanged, or better, by **revoking** update on the privileged columns.
- `delete`: own row only while `draft`.
- `provider_verification_events`: **no client policies at all** — insert only via the Worker. `revoke all` from `authenticated`.

## 5.3 `0005` — hardening existing policies

### 5.3.1 Prevent role escalation — three layers

```sql
-- Layer 1: column-level privilege. Users cannot write privileged columns at all.
revoke update on public.profiles from authenticated;
grant  update (full_name, phone, lang, updated_at) on public.profiles to authenticated;

-- Layer 2: trigger as defence-in-depth (catches service-role paths and future mistakes)
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role then
    if current_setting('app.allow_role_change', true) is distinct from 'on' then
      raise exception 'role may only be changed by a privileged server operation';
    end if;
  end if;
  return new;
end $$;

create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();

-- Layer 3: role changes only through a privileged function
create or replace function public.set_user_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'admin') then
    raise exception 'not permitted';
  end if;
  update public.profiles set role = p_role where id = p_user;
end $$;

revoke all on function public.set_user_role(uuid, text) from public, anon, authenticated;
```

**The `app.allow_role_change` GUC must never be settable from the client.** Supabase does not expose arbitrary GUC setting to clients by default; if that cannot be guaranteed, **remove Layer 2's escape hatch entirely** and rely on Layers 1 + 3.

### 5.3.2 Restrict bookings — preserving legitimate care relationships

Addresses **C-2** (status drift, unconstrained `provider_id`) and Finding 4.

```sql
-- Step 1: make provider_id reference a real principal.
-- Existing values are plain text and cannot be trusted; migrate deliberately.
alter table public.bookings
  add column provider_user_id uuid references auth.users(id) on delete set null;

-- Step 2: a care relationship is the SAME rule the client already uses.
create or replace function public.has_care_relationship(
  p_provider uuid, p_patient uuid
) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.bookings b
    where b.provider_user_id = p_provider
      and b.user_id = p_patient
      and b.status <> 'closed'          -- 'closed' is the DB's terminal state
  );
$$;

revoke all on function public.has_care_relationship(uuid, uuid) from public, anon;
grant execute on function public.has_care_relationship(uuid, uuid) to authenticated;
```

**Step 3: policies, reviewed per verb.**

| Verb | Patient | Verified provider (tier 5) | Facility admin (tier 6) | Admin (tier 7) |
|---|---|---|---|---|
| **SELECT** | `user_id = auth.uid()` | `provider_user_id = auth.uid()` **OR** `has_care_relationship(auth.uid(), user_id)` | **none on the base table** — see redacted view | via Worker only |
| **INSERT** | `user_id = auth.uid()` OR `user_id is null` (guest request) | no | no | via Worker |
| **UPDATE** | `user_id = auth.uid()` **AND** only cancellable fields | `provider_user_id = auth.uid()` — **only** scheduling fields | none | via Worker |
| **DELETE** | `user_id = auth.uid()` AND `status = 'new'` | none — cancel, never delete | none | via Worker |

```sql
drop policy if exists bookings_select on public.bookings;
create policy bookings_select on public.bookings
  for select using (
    user_id = auth.uid()
    or provider_user_id = auth.uid()
    or (auth.uid() is not null
        and user_id is not null
        and public.has_care_relationship(auth.uid(), user_id))
  );

drop policy if exists bookings_update_patient on public.bookings;
create policy bookings_update_patient on public.bookings
  for update using (user_id = auth.uid() and status in ('new','contacted'))
  with check (user_id = auth.uid());

drop policy if exists bookings_update_provider on public.bookings;
create policy bookings_update_provider on public.bookings
  for update using (
    provider_user_id = auth.uid()
    and public.is_verified_provider(auth.uid())
  ) with check (provider_user_id = auth.uid());
```

**This mirrors `lib/provider-workspace.ts` exactly:** a provider reaches a patient only via a booking naming both parties, and terminating the booking ends the relationship. A patient of another provider is unreachable. Guests (`user_id is null`) are requests, not patients.

`public.is_verified_provider(uuid)` is a `security definer` helper reading `provider_applications.status = 'verified'` — tier 4 (unverified) is therefore structurally incapable of reading bookings.

### 5.3.3 Facility admins get a redacted projection

```sql
create view public.facility_bookings_redacted
with (security_invoker = on) as
  select b.id, b.facility_id, b.preferred_date, b.service,
         b.status, b.created_at
  from public.bookings b
  where b.facility_id is not null;
```

Note: **`name`, `phone` and `message` are excluded.** `name`/`phone` are PII and `message` is a free-text reason for visit — clinical content. A facility administrator runs the rota without seeing any of it.

### 5.3.4 Close the world-readable table

`0002_rapid_response.sql:137-138` — `participation_select_public ... using (true)` exposes responder `phone` and `coverage_area` to anonymous callers.

```sql
drop policy if exists participation_select_public on public.provider_emergency_participation;
create policy participation_select_authenticated on public.provider_emergency_participation
  for select using (auth.uid() is not null);
```

### 5.3.5 Scope remaining `is_staff()` policies

`provider_requests_*_staff` (`0001:195,199`), `reports_*_staff` (`0001:208,212`), `emergency_requests_*` (`0002:111,115`), `emergency_events_*` (`0002:121,125`) currently let any staff read/write everything. Each must be narrowed to the caller's scope, and emergency request/response mutation must move to the Worker.

### 5.3.6 Health documents — keep, and add a regression test

`documents_owner_all` (`0001:173-174`) is **already correct**: `for all using (auth.uid() = user_id) with check (auth.uid() = user_id)`. Preserve it unchanged and lock it with a negative test.

### 5.3.7 Replace `is_staff()` wholesale

`is_staff()` returning true for `role in ('provider','admin')` is the root cause of the over-broad access. Replace with explicit, separate helpers: `is_admin()`, `is_verified_provider()`, `is_facility_admin(facility_id)`. Keep `is_staff()` only if some policy genuinely needs a coarse check — prefer not to.

## 5.4 Unverified items in this section

- **UNVERIFIED:** whether Supabase allows clients to set arbitrary GUCs (`app.allow_role_change`). If unsure, omit Layer 2's escape hatch.
- **UNVERIFIED:** existing `bookings.provider_id` values. They are unconstrained text; the migration must report and reconcile them rather than assume.
- **UNVERIFIED:** whether any production data exists. No production Supabase project is configured (§1.5), so migrations can assume a fresh dataset — but this must be re-confirmed before production.

---

# 6. Task 6 — Provider verification workflow

**Constraint honoured:** no real identity documents are to be used in development or testing. Use synthetic fixtures only.

## 6.1 Current state is unsafe and must not ship

Finding 3 confirms the `File` is discarded. Until a real upload exists, the verification UI must be treated as **non-functional**: the reviewer surface must not present it as a completed submission. Short-term, either implement upload or clearly mark the flow incomplete.

## 6.2 Target workflow

```
1. Applicant selects file (client-side pre-check only, advisory)
2. Client POSTs to Worker: POST /provider/documents (multipart)
3. Worker:
     a. Validates the caller's Supabase JWT          → reject 401
     b. Confirms the caller owns a draft/needs-info application → 403
     c. Enforces MIME allow-list AND magic-byte sniffing → 415
     d. Enforces size cap (8 MB, matching MAX_DOC_BYTES) → 413
     e. Scans / normalises (strip EXIF, flatten to PDF/JPEG)
     f. Computes SHA-256
     g. Uploads to the PRIVATE bucket under a random object key
     h. Inserts the document row + a provider_verification_events row (service role)
4. Applicant sees "received for review" — NOT "verified"
5. Reviewer opens the review surface via Worker endpoint
6. Reviewer decision → provider_verification_events (append-only) + status transition
```

## 6.3 Storage

```sql
insert into storage.buckets (id, name, public)
values ('provider-documents', 'provider-documents', false)
on conflict (id) do nothing;
```

**Every policy is `public = false`.** No `storage.objects` policy may allow `anon` or unrestricted `authenticated` reads.

| Policy | Rule |
|---|---|
| `documents_upload_own` | `for insert to authenticated with check (bucket_id='provider-documents' and (storage.foldername(name))[1] = auth.uid()::text)` |
| `documents_read_own` | `for select to authenticated using (bucket_id='provider-documents' and owner_id = auth.uid())` |
| **reviewer read** | **none for clients** — review reads happen only via the Worker using the service role, and every read is logged to `provider_verification_events` |

The applicant may see **their own** document *metadata* and request deletion. Nobody may read file contents from the browser.

## 6.4 Document record

Extend `DocumentRef` (`lib/provider-application.ts:109-115`) with a **server** shape. The current client-only shape lacks a storage reference entirely.

```sql
create table public.provider_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.provider_applications(id) on delete cascade,
  doc_type text not null,
  storage_path text not null unique,      -- random key, never the original filename
  original_filename text not null,       -- applicant-visible label only; never a path
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 8388608),
  sha256 text not null,
  uploaded_by uuid not null references auth.users(id),
  uploaded_at timestamptz not null default now(),
  review_state text not null default 'pending'
    check (review_state in ('pending','accepted','rejected','superseded')),
  -- NIN is never stored here. It lives encrypted on the application row and is
  -- returned to no SELECT policy.
);
```

## 6.5 Validation rules

| Layer | Rule |
|---|---|
| Client (advisory only) | MIME allow-list (`ACCEPTED_MIME`, existing `provider/onboarding/page.tsx:41`) and 8 MB cap (`:40`) — already present |
| **Server (authoritative)** | MIME allow-list **and magic-byte sniff**; reject double extensions; reject archives; reject encrypted PDFs; cap decoded pixel count for images; strip EXIF (GPS) from photos |
| Transport | TLS only; `usesCleartextTraffic="false"` already set (`AndroidManifest.xml:12`) |
| Filename | Never used as a path. Object key = `<userId>/<uuid>.<ext>`. Original name stored as a label only. |

## 6.6 Reviewer authorisation and audit

- Reviewer actions require a **recent re-authentication** assertion (step-up MFA) and are performed via the Worker with the service-role key.
- `provider_verification_events` is **append-only**: `revoke update, delete` from all client roles.
- The event log records actor, action, from/to status, reason, timestamp.
- The reviewer UI must display the document **only** through the Worker endpoint, never by embedding a public or signed URL in the page.

## 6.7 Forged verification

| Attack | Control |
|---|---|
| Client sets `status='verified'` | `revoke update` on privileged columns; status changes only via Worker |
| Applicant edits own application row | `update` policy limited to `status in ('draft','needs-info')` |
| Applicant inserts a `provider_verification_events` row | `revoke all` from `authenticated` — Worker only |
| Shared storage path forged | Object key includes `auth.uid()`; RLS checks folder prefix |
| Bucket made public | No policy allows it; add a CI assertion that `public = false` |
| Reviewer account compromised | Step-up auth + immutable audit trail + (P3) dual approval for verification |

## 6.8 Retention

- Purpose-limited: retain only while a decision is pending plus a defined window (proposed **90 days** after final decision), then purge both the storage object and the row.
- Provide applicant-initiated deletion.
- Record the retention decision in the privacy policy, which currently (`app/(site)/privacy/page.tsx:37`) admits the DPO contact is unpublished.

## 6.9 Test-data rule

Development and test uploads must use **synthetic fixtures only** — generated dummy images and text PDFs containing no real identity data. The upload path must never be exercised against real documents outside a controlled, audited process.

---

# 7. Task 7 — Testing strategy

## 7.1 Coverage required

| # | Test | Type | Blocks |
|---|---|---|---|
| T1 | Incorrect password rejected; session stays `null` | unit + E2E | §3 |
| T2 | Empty password rejected | unit | §3 |
| T3 | Sign-up with an existing email does **not** claim the account | unit + E2E | §3.1 |
| T4 | Unauthenticated access to `/profile`, `/records`, `/reminders`, `/provider/*` shows the gate | E2E | §2 |
| T5 | **Session isolation:** user B's session never exposes user A's `healthlink:u:A:*` data | unit | §4 |
| T6 | **Sign-out on a shared device:** all Class A keys for that user removed; Class B retained | unit | §4.4 |
| T7 | **Guest isolation:** guest resolves only `healthlink:guest:*`; no `u:*` key is readable | unit | §4.5 |
| T8 | Patient reads own `health_documents` | DB integration | §5 |
| T9 | Patient **cannot** read another patient's `health_documents` (negative) | DB integration | §5.3.6 |
| T10 | Patient **cannot** change own `role` to `admin` (negative) | DB integration | §5.3.1 |
| T11 | Provider **cannot** read an unrelated booking (negative) | DB integration | §5.3.2 |
| T12 | Provider **can** read a booking where `has_care_relationship` is true | DB integration | §5.3.2 |
| T13 | Cancelling/closing the booking ends access (negative) | DB integration | §5.3.2 |
| T14 | Unverified provider **cannot** read any booking (negative) | DB integration | §5.3.2 |
| T15 | Facility admin **cannot** read clinical `message`/`phone` (negative) | DB integration | §5.3.3 |
| T16 | Anonymous **cannot** read `provider_emergency_participation` (negative) | DB integration | §5.3.4 |
| T17 | Document upload rejects wrong MIME, oversize, bad magic bytes | unit + integration | §6.5 |
| T18 | Document bucket denies anonymous read (negative) | DB integration | §6.3 |
| T19 | Applicant cannot self-approve (negative) | DB integration | §6.7 |
| T20 | Session expiry triggers `SessionEnd("expired")` and wipes Class A | unit | §4.6 |
| T21 | Recovery flow cannot be bypassed offline | unit | §3.3 |
| T22 | Service-worker runtime cache contains no private response | unit | §4.4 |

**T9–T19 are negative tests and are the ones that matter most.** Every "cannot" case must be implemented, because the current failures (Findings 1 and 4) are exactly what a positive-only suite cannot see.

## 7.2 Validating policies against a real, non-production Supabase project

**Create a disposable project. Never test against production.**

1. Create a throwaway Supabase project; record only its URL/anon key in a local `.env.local` that is never committed.
2. Apply migrations in order: `0001_init.sql`, `0002_rapid_response.sql`, `0003`, `0004`, `0005`, `0006`.
3. Seed **synthetic** fixtures only: `consumer-a@qa.test`, `consumer-b@qa.test`, `provider-1@qa.test`, `provider-2@qa.test`, `facility-admin@qa.test`, `admin@qa.test`, plus synthetic bookings linking `provider-1` to `consumer-a` and `provider-2` to `consumer-b`.
4. For each of T8–T19, run the query **as the relevant user** using the anon key plus that user's access token — never as `service_role`, which bypasses RLS by design.
5. Record the SQL and the actual returned row count for each. A policy is only "verified" once an unauthorised query has been **observed to fail**.
6. Destroy the project afterwards. Retain the SQL and results in the PR as evidence.

**Caution:** `service_role` bypasses RLS entirely. A test that runs as `service_role` proves nothing about policy enforcement.

## 7.3 Local E2E additions (no Supabase required)

- `history.back()` coverage — the existing `e2e/back-arrows.mjs` tests back *links* only and structurally cannot catch the Android back defect.
- T5/T6/T7 can run entirely against localStorage with a local build.

## 7.4 CI gates to add

```
npm run lint                       # must exit 0 (currently 3 errors)
npm test                           # unit, including new auth + storage tests
node scripts/check-i18n.mjs        # must exit 0 (currently 590 missing keys)
node scripts/audit-pages.mjs       # route integrity
npm run build                      # must exit 0
e2e suite                          # incl. history.back() and isolation tests
supabase policy suite              # T8-T19 against the disposable project
axe-core pass                      # must exit 0
storage-bucket assertion           # provider-documents must remain public=false
```

---

# 8. Prioritised remediation tasks

## P0 — must complete before any real patient data or cloud enablement

| ID | Task | Files |
|---|---|---|
| **P0-1** | Remove `signInOffline`; delete the existing-email takeover | `app/auth/sign-in/page.tsx:79-93,102`; `app/auth/sign-up/page.tsx:120-134` |
| **P0-2** | Make `cloudMode === false` a hard stop with an explicit message | `app/auth/sign-in/page.tsx:50,188,192`; `app/auth/sign-up/page.tsx:67` |
| **P0-3** | Implement `lib/session.ts` `SessionEnd` and call it from all five sign-out sites | new `lib/session.ts`; `lib/supabase/cloud.tsx:207-215`; `components/profile-settings.tsx:101-115`; `app/(app)/profile/page.tsx:252-266` |
| **P0-4** | Namespace all Class A keys by user; guest namespace; legacy-key migration | `lib/storage.ts:17-43,191-370`; all consumers via the central accessor |
| **P0-5** | Migration `0005`: column-level `revoke update` on `profiles`; replace `is_staff()` | `supabase/migrations/0005_rls_hardening.sql` (new) |
| **P0-6** | Migration `0005`: scope bookings per verb; add `has_care_relationship`; redacted facility view | same |
| **P0-7** | Close `participation_select_public` | same |
| **P0-8** | Migration `0003`: server-side `provider_applications`, audit events, facility staff | `supabase/migrations/0003_provider_verification.sql` (new) |
| **P0-9** | Migration `0004`: private bucket + storage policies | `supabase/migrations/0004_storage_buckets.sql` (new) |
| **P0-10** | Worker: authenticated document upload endpoint with server-side validation | `worker/index.ts` |
| **P0-11** | Negative DB tests T9–T19 against a disposable project | new test suite |
| **P0-12** | Remove the on-screen verification code from the account screen | `app/(app)/account/page.tsx:196,224` |
| **P0-13** | Remove the false "changes queued" badge | `app/(app)/worker/page.tsx:87-94` |

## P1 — essential before public launch

| ID | Task | Files |
|---|---|---|
| **P1-1** | Worker: reviewer decision endpoint with step-up auth | `worker/index.ts`; `supabase/migrations/0006_*.sql` |
| **P1-2** | Scope `provider_requests`, `reports`, emergency policies | `0005` |
| **P1-3** | Configure Supabase project: redirect allow-list, SMTP, confirmations on, leak protection, session policy | Supabase console + new env vars (§9) |
| **P1-4** | Document retention policy + purge job | new; `app/(site)/privacy/page.tsx` |
| **P1-5** | `allowBackup="false"`; provision and document the release keystore | `AndroidManifest.xml:8`; `build-apk.ps1:119-137` |
| **P1-6** | Remove the committed APK/ZIP from `public/` | `public/*.apk`, `public/*.zip` |
| **P1-7** | Add `history.back()` E2E coverage | new e2e spec |
| **P1-8** | Wire `check-i18n.mjs` into CI | `package.json` |
| **P1-9** | Encrypt Class A at rest with a non-extractable session key | `lib/storage.ts` |
| **P1-10** | Notification honesty: remove prefs that deliver nothing | `components/profile-settings.tsx:182-207`; `app/(app)/profile/page.tsx:627-657`; `components/nav.tsx:97-106` |

## P2 — important

Alert the facility-admin redaction surface · Android back interception (audit D-8) · migration 0006 `security definer` functions · guest-mode E2E · `axe-core` in CI · contrast fixes for medical disclaimers · `<html lang>` sync · quota-failure handling · manifest scope · quota trimming in `public/sw.js` · lint errors to zero · lockfile.

## P3 — enhancements

Dual approval for verification · field-level encryption for NIN · per-record sync merge · key rotation · formal external penetration test and an independent security review.

---

# 9. Required environment variables and configuration

**No secret values are recorded here.** Names and handling only.

## 9.1 Client-visible (safe by design — RLS is the boundary)

| Variable | Where | Status |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` / CI | **unset** — add at P1-3 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` / CI | **unset** — add at P1-3 |

The anon key is designed to be public. Its safety depends entirely on the policies hardened in P0-5/P0-6 — **it must not be added before those land.**

## 9.2 Worker secrets — never client-visible

| Secret | How to set | Exposure risk if leaked |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | `npx wrangler secret put` | **Total database compromise.** Bypasses all RLS. |
| `AI_API_KEY` (already exists) | `npx wrangler secret put` | Cost abuse |

**Hard rule:** never name a service-role key with a `NEXT_PUBLIC_` prefix. Anything prefixed `NEXT_PUBLIC_` is inlined into the client bundle.

## 9.3 Non-secret Worker configuration (`wrangler.jsonc:16-18`)

`AI_BASE_URL`, `AI_MODEL` — already present.

## 9.4 New non-secret configuration to add

| Name | Purpose |
|---|---|
| `APP_ORIGIN` | Canonical site origin, used for CORS allow-list and redirects |
| `ALLOWED_ORIGINS` | Replace the hard-coded list at `worker/index.ts:33-38`; must include the APK origin (`https://appassets.androidplatform.net`) — audit D-9 |
| `SUPABASE_PROJECT_REF` | For operational scripts only; not a secret |

## 9.5 Supabase project configuration checklist

- [ ] Email confirmations **enabled**
- [ ] Password minimum ≥ 12 (Supabase default is 6 — raise it)
- [ ] Leaked-password protection **enabled**
- [ ] CAPTCHA for sign-up **enabled**
- [ ] Rate limits reviewed (email + token endpoints)
- [ ] Redirect URLs allow-listed: site origin, `/auth/callback`, `/auth/verify`, recovery origin, OAuth provider origins
- [ ] JWT signing keys rotated once at setup
- [ ] `service_role` key created but **only** ever placed in Wrangler secrets

---

# 10. Rollback considerations

| Layer | Rollback | Risk |
|---|---|---|
| `0003` (new tables) | `drop table provider_verification_events, provider_documents, facility_staff, provider_applications cascade` | Loses draft applications. Acceptable pre-production. |
| `0004` (bucket) | `drop policy` on `storage.objects`, `delete` bucket | Orphaned objects remain in storage; purge manually. |
| `0005` (policy changes) | Policies are text; the exact prior definitions are preserved in `0001_init.sql`/`0002_rapid_response.sql` and must be copied into the rollback script before applying | **The highest-risk migration.** Apply only after §7.2 passes. |
| `0006` (functions) | `drop function` | Reviewer endpoints break; no data loss. |
| Worker endpoints | Remove the route; no data impact | Upload becomes unavailable — already non-functional today. |
| Client auth changes | Git revert | **Would re-enable Finding 1.** Never roll back to the password-less path in production. |
| Namespacing | **Not safely reversible.** Legacy keys are deleted after migration | Must not be rolled back once real user data exists. Ship behind a migration marker. |

**Rollback ordering:** revert the Worker/UI first, then `0006`, then `0005` only if the app can tolerate over-broad access again (it cannot in production — prefer rolling forward instead). `0003`/`0004` roll back independently.

**Critical:** `0005` rollback re-opens Finding 4. Treat forward-fix as the only acceptable production option.

---

# 11. Production-readiness gates

Cloud authentication stays disabled until **every** gate passes.

### Gate A — Authentication
- [ ] `signInOffline` and the email-takeover path removed
- [ ] T1, T2, T3 pass
- [ ] Supabase email confirmation, leak protection and CAPTCHA enabled
- [ ] Redirect allow-list configured; recovery flow end-to-end tested
- [ ] Session expiry/refresh tested; `SessionEnd` fires on expiry (T20)
- [ ] On-screen verification code removed

### Gate B — Authorisation (database)
- [ ] `0003`–`0006` applied to the **disposable** project
- [ ] **T9, T10, T11, T13, T14, T15, T16 observed to FAIL as the unauthorised user** — SQL and row counts attached to the PR
- [ ] T8, T12 observed to SUCCEED
- [ ] `revoke update` on `profiles` verified to block self-promotion
- [ ] `service_role` never used to run a policy test
- [ ] Client-side `lib/provider-workspace.ts` tests (16) still pass unchanged
- [ ] Discrepancy review: DB policies are **no more permissive** than the client model

### Gate C — Local data protection
- [ ] All Class A keys namespaced; T5, T6, T7 pass
- [ ] Class B preferences survive sign-out
- [ ] Guest cannot read any `u:*` namespace
- [ ] Multi-tab sign-out propagates
- [ ] `allowBackup="false"`

### Gate D — Documents
- [ ] Private bucket `public = false` asserted in CI
- [ ] T17, T18, T19 pass
- [ ] Server-side MIME + magic-byte + size validation
- [ ] Reviewer decisions audited and append-only
- [ ] Retention policy documented and enforced
- [ ] Synthetic fixtures only in all non-production environments

### Gate E — Privacy and disclosures
- [ ] Sign-out isolation verified by manual shared-device test
- [ ] Account deletion implemented (audit D-7)
- [ ] Privacy policy updated: storage model, retention, DPO contact
- [ ] False UI removed: "changes queued", notification prefs, on-screen codes
- [ ] Seeded demo identities replaced with clearly synthetic ones

### Gate F — Process
- [ ] Independent security review of the RLS policies and Worker endpoints
- [ ] Documented incident response for credential or key exposure
- [ ] `npm run lint` exits 0
- [ ] CI gates green

**Explicit non-claim:** completing these gates constitutes engineering readiness for a controlled pilot. It is **not** a security certification, penetration test, regulatory approval (including NDPA Nigeria), or clinical-safety clearance. No statement in this document should be represented as any of those.

---

# 12. Assumptions and unverified items

## Assumptions requiring validation

| ID | Assumption | Validate by |
|---|---|---|
| A1 | Supabase does not let clients set arbitrary GUCs, so `app.allow_role_change` is safe | Check Supabase docs; otherwise remove the Layer 2 escape hatch |
| A2 | No production Supabase project exists (§1.5 strongly implies this) | Confirm with the operator before the first production migration |
| A3 | `0001`/`0002` migrations were applied to some environment at some point | Ask the operator; affects migration ordering and data reconciliation |
| A4 | `bookings.provider_id` values are non-empty and meaningful | Run a reconciliation report in the disposable project |
| A5 | Supabase Auth supports password reset + email confirmation on the chosen plan | Verify on the actual plan |
| A6 | The Worker can validate a Supabase JWT (it can: verify against the auth JWKS) | Prototype during P0-10 |
| A7 | Facility-admin as a distinct role is wanted (not all facility staff are clinical) | Confirm with the product owner |

## Unverified

- **U1** Whether any real personal data has ever been entered on the deployed site. Given the password-less sign-in, **this should be treated as likely** and investigated before cloud enablement.
- **U2** Whether `provider_requests` / `emergency_requests` hold live data.
- **U3** Whether anyone relies on the offline sign-in path today (removing it is a behaviour change).
- **U4** Whether Supabase permits `security definer` functions to be revoked from `authenticated` in the way §5.2 assumes.
- **U5** Android back-button behaviour on physical devices (static analysis only).
- **U6** Dark-mode contrast (not rendered).

---

# 13. Required next steps

**Do not begin feature work or enable cloud until Gate A and Gate B pass.**

**Immediate (P0):**
1. Create the disposable Supabase project and apply `0001`–`0002`. Establish a baseline.
2. Write and run the negative tests T9–T14 against it — **confirm the escalation and cross-provider findings empirically before fixing**, so the fix can be proven.
3. Author `0003` (verification tables) and `0005` (policy hardening); validate on the disposable project.
4. Remove `signInOffline` and the email-takeover path (P0-1) and ship the honest "accounts unavailable" state. This alone removes the live P0.
5. Implement `lib/session.ts` and namespacing (P0-3, P0-4) with T5–T7.
6. Build the Worker upload endpoint and private bucket (P0-9, P0-10).

**Before public launch (P1):**
7. Configure the Supabase project and session policy (P1-3).
8. Retention policy, keystore provisioning, `allowBackup="false"`, remove committed binaries.
9. Independent security review of the RLS policies and Worker endpoints (Gate F).

**Investigation worth starting now:** because sign-in has never verified a password, treat **any data entered on the deployed site as potentially exposed** (U1) and establish whether real accounts were created before enabling cloud.

---

*Plan only. No application source files were modified; no migrations were run; production cloud authentication remains disabled. No credentials, secrets or patient data are reproduced in this document.*