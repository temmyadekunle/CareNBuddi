# CareNBuddi — Backend Security Readiness Review

**Type:** READ-ONLY analysis. No source file modified, no migration created or executed, no cloud authentication enabled, nothing deployed.
**Inputs reviewed:** `CARENBUDDI_TECHNICAL_AUDIT.md`, `CARENBUDDI_SECURITY_REMEDIATION_PLAN.md`, `CARENBUDDI_STORAGE_ISOLATION_REPORT.md`, plus current source and `supabase/migrations/0001_init.sql` + `0002_rapid_response.sql`.

> **No database policy in this report has been dynamically verified.** Every policy finding is derived from reading migration SQL. They must be confirmed against a configured Supabase test project (Section 6) before being relied on.

> **No secrets, tokens or patient data appear in this document.** Variable *names* only.

---

## 1. Executive summary

The offline authentication bypass is closed: `signInOffline` is gone, registration no longer claims an existing account, the demo-role switcher is removed, and the route guard now resolves a session id against a real account. Local data is namespaced per account with quarantined legacy records. **Neither change makes the application secure against a determined person with device access, and neither replaces server-side authorisation.**

Reviewing the backend readiness, I found **one issue more severe than anything in the original audit**: the `on_auth_user_created` trigger copies `role` from client-supplied metadata into `profiles.role`. Anyone can register as an administrator. It is currently latent — Supabase is not configured — but it is the *intended* sign-up path, so it will activate the moment cloud is enabled.

| # | Finding | Severity | State |
|---|---|---|---|
| B-1 | Signup trigger trusts client-supplied `role`, including `admin` | **P0** | CONFIRMED (SQL) |
| B-2 | `profiles_update_own` is row-scoped, not column-scoped → self-promotion | **P0** | CONFIRMED (SQL) |
| B-3 | `bookings_select` grants every staff member every booking | **P0** | CONFIRMED (SQL) |
| B-4 | `provider_emergency_participation` world-readable, includes phone | **P1** | CONFIRMED (SQL) |
| B-5 | `bookings.provider_id` is unconstrained `text`, no FK | **P0** | CONFIRMED (SQL) |
| B-6 | Client/DB booking status vocabularies diverge; no mapping | **P1** | CONFIRMED (source) |
| B-7 | No `provider_applications` table — verification cannot be enforced | **P0** | CONFIRMED (SQL) |
| B-8 | No storage bucket exists | **P1** | CONFIRMED (SQL) |
| B-9 | Supabase signed-out event clears the session pointer but never purges data | **P1** | CONFIRMED (source) |
| B-10 | No explicit DELETE policy on any table | **P2** | CONFIRMED (SQL) |
| B-11 | Account registry and staff-review collections hold PII device-wide | **P2** | CONFIRMED (source) |

**Recommendation:** do not set `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` until B-1, B-2, B-3, B-5 and B-7 are fixed and verified. The anon key is only as safe as the policies behind it.

---

## 2. Current authentication architecture

### 2.1 Is Supabase Auth configured?

**Client code exists; no project is configured.** `lib/supabase/client.ts:3-12` reads two environment variables and gates on them. `.env.local` does not exist; only `.env.local.example`. The deployed bundle contains zero Supabase project hosts, so `isCloudEnabled === false`.

The client is created correctly where it exists (`lib/supabase/client.ts:19-24`):

```ts
createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
});
```

`detectSessionInUrl: false` is appropriate for a static export with no callback route — recovery links would need a landing page that forwards the hash.

### 2.2 Required environment configuration

| Variable | Where | Present | Note |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` / CI | **No** | Public by design |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `.env.local` / CI | **No** | Public by design; safety depends entirely on RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **Wrangler secret only** | **No** | Must never carry a `NEXT_PUBLIC_` prefix; bypasses all RLS |
| `APP_ORIGIN` | Worker var | No | For CORS allow-list and redirects |
| `AI_API_KEY` | Wrangler secret | No | Already correctly separated |

### 2.3 Session restoration, expiry and sign-out

| Capability | Status |
|---|---|
| Session restoration | IMPLEMENTED — `getSession()` on mount (`cloud.tsx:124`) |
| Token auto-refresh | IMPLEMENTED — `autoRefreshToken: true` |
| Auth state subscription | IMPLEMENTED — `onAuthStateChange` (`cloud.tsx:142`) |
| Explicit sign-out | IMPLEMENTED — `cloud.tsx:208-216`, calls `endSession()` after `auth.signOut()` |
| **Signed-out event purges local data** | **NOT IMPLEMENTED — B-9** |
| Session expiry handling | **NOT IMPLEMENTED** — `endSession("expired")` is never called anywhere |
| Local sign-out purges data | IMPLEMENTED — all four call sites now use `endSession("signout")` |

**B-9 (CONFIRMED):** `cloud.tsx:146-151`, when `onAuthStateChange` delivers a null session, writes `userId: null` and returns. The namespaced keys `healthlink:u:<id>:*` remain on disk. A token that expires or is revoked from another device therefore clears the session *pointer* but not the data. The app gates correctly, so nothing is displayed — but the records persist for whoever next opens the app on that device.

`SessionEndReason` declares `"expired" | "switch-account" | "provider-review"` (`lib/session.ts`); only `"signout"` is ever used.

### 2.4 Does route protection rely on client-controlled values?

**Yes.** `components/app-guard.tsx` resolves the session from `healthlink:session` via `resolveSessionUser()`, which requires a matching row in the device account registry `healthlink:users`. That closes the trivial fabricated-id case (tested), but:

- The registry is editable.
- `healthlink:users` is itself written client-side.
- The entire check runs in the browser.

This is a **user-experience gate, not authorisation.** It is documented as such in `lib/auth-guard.ts`. It must not be relied on once a backend exists; RLS replaces it.

### 2.5 Components that create or modify session records

| Location | Action |
|---|---|
| `lib/supabase/cloud.tsx:71-72` (`adoptCloudUser`) | Writes session `userId = supabase user.id`. **Correct direction** — server identity becomes the local principal. |
| `lib/supabase/cloud.tsx:147-148` | Nulls `userId` on signed-out. **Does not purge — B-9.** |
| `lib/session.ts:83` (`endSession`) | Removes session + purges namespace. |
| `app/auth/sign-up/page.tsx` | Sets a session for a newly created local profile only. |
| `app/(app)/provider/register/page.tsx:167` | Upgrades the **already signed-in** account; authenticates nobody new. |
| `components/ui.tsx:12` | Writes `lang` only. |

### 2.6 Does registration claim a real account when it only saves a local profile?

**No — this was corrected and is now accurate.** `app/auth/sign-up/page.tsx`:
- Cloud branch (`:178`): "Account created" — only reached after `cloud.signUp()` returns without error, i.e. a trusted service confirmed it.
- Offline branch (`:195-196`): "Profile saved on this device", tone `info`, not `success`.

The offline path refuses a duplicate email rather than claiming the account, and the collected password is discarded, so a local profile **cannot be signed back into**. That fails closed, which is the right interim posture.

**Residual:** the offline path still sets a session, so `AppGuard` treats a local profile as signed-in. It grants no authority beyond the device.

### 2.7 How guest access is distinguished

`lib/storage-scope.ts` derives the principal:

- `healthlink:session.userId` is a non-empty string → `healthlink:u:<userId>:`
- otherwise → `healthlink:guest:<guestId>:`

A guest id is a random handle, rotated on sign-out. Malformed session values (bad JSON, wrong types, empty) resolve to **guest**, not to a shared default — fail closed, and covered by tests.

Guests may browse `/app`, `/find-care`, `/emergency`, `/explore`, `/health` and are gated from every Class A route. Verified in `e2e/storage-isolation.mjs`.

**Important:** a guest is **not authenticated**. No session, no token, no server identity.

### 2.8 Behaviour when the authentication service is unavailable

| Surface | Behaviour |
|---|---|
| `/auth/sign-in` | No credential form. `AuthUnavailableNote` with `role="status"`, plus a guest link. Submitting creates no session. |
| `/auth/sign-up` | Local profile creation still works, labelled honestly. Duplicate emails refused. |
| `/account` | Simulated auth and the demo-role switcher removed. Sign-out still works. |
| Protected routes | Gate on the resolved account; guests see "Sign in to continue". |
| Cloud sync | Inert (`cloud.tsx` returns early when `getSupabase()` is null). |

Degradation is **fail-closed for sign-in and open for guest browsing**. That is the correct shape.

### 2.9 Recommended authentication architecture

Keep Supabase Auth. Do not build anything custom.

1. **Identity source:** the Supabase JWT. `adoptCloudUser()` already binds the local principal to `user.id`; make that the only path that sets a session userId. Remove the offline profile-creation path once cloud is live, or keep it strictly as a labelled guest feature.
2. **Authorisation:** RLS only. `AppGuard` becomes a UX convenience and must never gate something RLS would deny.
3. **Privileged mutations** (verification decisions, role changes, document upload) go through the Cloudflare Worker holding the service-role key. There is no Next.js server in a static export, so the Worker is the only trusted component available.
4. **Session lifecycle:** wire `onAuthStateChange` `SIGNED_OUT` / `TOKEN_REFRESHED` failures to `endSession("expired")` (B-9). Add an idle timeout for staff roles.
5. **Enablement order:** policies first, then env vars, then deploy. Reversing that order publishes the B-1..B-5 escalation paths.

---

## 3. Database security findings

Two migrations exist. Eight tables, RLS enabled on all eight, no storage bucket, no explicit DELETE policy anywhere.

### B-1 — Signup trigger trusts client-supplied role — **P0**

- **Location:** `0001_init.sql:37-59`, `public.handle_new_user()`
- **Current behaviour:** copies `new.raw_user_meta_data ->> 'role'` into `profiles.role`, validating only that the string is one of `consumer|provider|admin`.
- **Triggered by:** `cloud.tsx:190` sends `options: { data: { ..., role: meta.role } }` at sign-up, where `meta.role` comes from the sign-up form.
- **Risk:** a caller sets `role: "admin"` in client metadata → the trigger writes it → `is_staff()` returns true → **every staff policy unlocks**: all bookings (name, phone, reason for visit), all facility applications, all reports, all emergency requests. This is the *intended* sign-up path, so it needs no policy bug.
- **Correction:** the trigger must never read `role` from metadata. Hard-code `'consumer'`. Professional registration is a separate, reviewed flow (Section 4). Optionally reject/strip a `role` key in metadata at the edge.
- **Negative test:** sign up with `data.role = 'admin'`, then as that user run `select role from public.profiles where id = auth.uid();` — **must return `consumer`**. Then `select * from public.bookings;` must return only their own rows.

### B-2 — Role escalation through ordinary profile update — **P0**

- **Location:** `0001_init.sql:167-169`, `profiles_update_own`
- **Current:** `for update using (auth.uid() = id) with check (auth.uid() = id)` — row-scoped, **not column-scoped**.
- **Risk:** `update public.profiles set role='admin' where id = auth.uid();` satisfies both clauses (still your own row) and the check constraint.
- **Correction, three layers:** (a) `revoke update on public.profiles from authenticated;` then `grant update (full_name, phone, lang, updated_at) on public.profiles to authenticated;` (b) a `before update` trigger rejecting `new.role is distinct from old.role` unless raised from a privileged context; (c) role changes only via a `security definer` function revoked from `authenticated`.
- **Negative test:** as a consumer, attempt the UPDATE — **must be rejected with a permission error**.

### B-3 — Every staff member can read every booking — **P0**

- **Location:** `0001_init.sql:181-183` (`bookings_select`) and `is_staff()` at `0001_init.sql:~40-52`
- **Current:** `using (auth.uid() = user_id or public.is_staff())`, where `is_staff()` is `role in ('provider','admin')` with **no scoping to the provider**.
- **Risk:** any provider reads every patient's name, phone and reason for visit — across all providers. Contradicts the client-side care-relationship model in `lib/provider-workspace.ts` (16 unit tests) which restricts a provider to patients connected by an appointment. **The database is currently more permissive than the application.**
- **Correction:** scope to `provider_user_id = auth.uid() OR has_care_relationship(auth.uid(), user_id)`, and require `is_verified_provider(auth.uid())`. Replace `is_staff()` with `is_admin()`, `is_verified_provider()`, `is_facility_admin(facility_id)`.
- **Negative tests:** provider A selecting provider B's booking → **empty**. Unverified provider selecting any booking → **empty**. Consumer selecting another's booking → **empty**.

### B-4 — Responder phone numbers world-readable — **P1**

- **Location:** `0002_rapid_response.sql:136-138`, `participation_select_public`
- **Current:** `for select using (true)` — **anonymous, no JWT required**.
- **Table contains:** `display_name`, `phone`, `coverage_area`, `last_seen_at`.
- **Risk:** anyone holding the public anon key enumerates every responder's phone number and coverage area. Privacy exposure and a safety concern.
- **Correction:** `using (auth.uid() is not null)`.
- **Negative test:** with the anon key and **no** session, select → **zero rows**.

### B-5 — `provider_id` is unconstrained text — **P0 (enablement blocker)**

- **Location:** `0001_init.sql:92`, `provider_id text` — no foreign key, no index, no format constraint.
- **Risk:** cannot be matched to an authenticated principal, so **cannot be used as an authorisation key**. Any B-3 fix that relies on it would be wrong.
- **Correction:** add `provider_user_id uuid references auth.users(id) on delete set null`. Reconcile existing values before enforcing.
- **Negative test:** insert a booking with a `provider_user_id` that is not a real principal → **foreign key violation**.

### B-6 — Client and database status vocabularies diverge — **P1**

- **Client** (`lib/types.ts:129`): `new | contacted | confirmed | completed | cancelled`
- **Database** (`0001_init.sql:96`): `new | contacted | confirmed | closed`
- **No mapping exists** — `lib/supabase/sync.ts` does not translate statuses.

Consequence: the client treats `cancelled` as terminating care access (`lib/provider-workspace.ts`, `canAccessCare`), but the database has no `cancelled` value. **A care-relationship predicate written against today's schema would be wrong.** See Section 5.

### B-7 — No `provider_applications` table — **P0 (enablement blocker)**

Full table inventory confirmed: `profiles`, `health_documents`, `bookings`, `provider_requests`, `reports`, `emergency_requests`, `emergency_request_events`, `provider_emergency_participation`. Provider registration, onboarding and verification exist **only** in client-side `localStorage`.

**RLS therefore cannot express "verified providers only" today — the database does not know who a provider is.** See Section 4.

### B-8 — No storage bucket — **P1**

No `storage.buckets`, no `storage.objects` policies. Document upload has nowhere to go; the client discards the `File` (`app/(app)/provider/onboarding/page.tsx:404`). See Section 4.

### B-9 — Auth event clears the pointer but not the data — **P1**

Covered in 2.3. Correction: call `endSession("expired")` from the null-session branch of `onAuthStateChange`.

### B-10 — No explicit DELETE policy — **P2**

RLS enabled without a `for delete` policy means deletes are denied by default — the safe default. Worth stating explicitly rather than relying on absence, so a future `grant` cannot silently widen it.

### B-11 — Facility administrator role does not exist — **P2**

`Role = "consumer" | "provider" | "admin"` (`lib/types.ts:101`). There is no facility administrator, and `bookings.message` / `phone` are PHI that a non-clinical scheduler must not see. Section 4 introduces `facility_admin` with a redacted projection.

### Assessment of what is correct

Worth recording, because it shapes the fix:

- `health_documents` → `documents_owner_all` (`0001:173-174`) is **strictly correct** and is the model for everything else.
- `emergency_requests_insert` allows `auth.uid() is null`, but only `emergency_requests_update_staff` can move status — **a requester can never fabricate a dispatch.** Good design; preserve it.
- `emergency_events` is append-only for clients (`insert ... with check (is_staff())`, no update/delete policy).

---

## 4. Proposed provider verification model

**Design only — not implemented.**

### 4.1 Principles

1. Verification state lives **only** in the database. The client copy is a cache.
2. A provider is an `auth.users` principal. There is no unconstrained `provider_id`.
3. Role and verification are **separate axes**. `role='provider'` means "applied as a professional"; `verification_status='verified'` means "reviewed and approved". Only the latter grants patient access.
4. Documents are private, unguessable, never public URLs.
5. Every decision is auditable and append-only.

### 4.2 Schema

```sql
create table public.provider_applications (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null unique references auth.users on delete cascade,
  email                 text not null,
  full_name             text not null,
  category              text not null,
  speciality            text not null default '',
  qualifications        text not null default '',
  institution           text not null default '',
  registration_number   text not null default '',
  licensing_body        text not null default '',
  licence_expiry        date,
  -- Never returned by any client SELECT policy. Encrypted at the application
  -- layer; the database stores ciphertext only.
  nin_ciphertext        bytea,
  trainee               boolean not null default false,
  status                text not null default 'draft'
      check (status in ('draft','submitted','under-review','needs-info',
                        'verified','rejected','suspended')),
  identity_status       text not null default 'not-started',
  credentials_status    text not null default 'not-started',
  submitted_at          timestamptz,
  decided_at            timestamptz,
  decided_by            uuid references auth.users(id),
  decision_reason       text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table public.provider_documents (
  id                  uuid primary key default gen_random_uuid(),
  application_id      uuid not null references public.provider_applications(id) on delete cascade,
  doc_type            text not null,
  storage_path        text not null unique,      -- random key, never the original filename
  original_filename   text not null,             -- applicant-visible label only
  mime_type           text not null,
  size_bytes          bigint not null check (size_bytes > 0 and size_bytes <= 8388608),
  sha256              text not null,             -- tamper evidence
  uploaded_by         uuid not null references auth.users(id),
  uploaded_at         timestamptz not null default now(),
  review_state        text not null default 'pending'
      check (review_state in ('pending','accepted','rejected','superseded')),
  reviewed_by         uuid references auth.users(id),
  reviewed_at         timestamptz
);

create table public.provider_verification_events (   -- append-only
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.provider_applications(id) on delete cascade,
  actor_id       uuid not null references auth.users(id),
  action         text not null check (action in
    ('created','submitted','review-started','approved','rejected',
     'suspended','reinstated','needs-info','document-uploaded','document-removed')),
  from_status    text,
  to_status      text,
  reason         text,
  created_at     timestamptz not null default now()
);

create table public.facility_staff (
  facility_id uuid not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('facility_admin','receptionist')),
  created_at  timestamptz not null default now(),
  primary key (facility_id, user_id)
);
```

### 4.3 Private document storage

```sql
insert into storage.buckets (id, name, public)
values ('provider-documents','provider-documents', false)
on conflict (id) do nothing;

create policy documents_upload_own on storage.objects
  for insert to authenticated with check (
    bucket_id = 'provider-documents'
    and (storage.foldername(name))[1] = auth.uid()::text);

create policy documents_read_own on storage.objects
  for select to authenticated using (
    bucket_id = 'provider-documents' and owner_id = auth.uid());
```

**No client read policy for reviewers.** Reviewers read document bytes only through the Worker using the service-role key, and every such read writes a `provider_verification_events` row. Object keys are `<userId>/<uuid>.<ext>`; the original filename is a label, never a path.

### 4.4 Application policies

| Verb | Rule |
|---|---|
| SELECT | Own row only (`auth.uid() = user_id`). Reviewers read via the Worker, not a broad policy. |
| INSERT | Own row only. |
| UPDATE | Own row **and only while `status in ('draft','needs-info')`**. On `submitted`, privileged columns are revoked. |
| DELETE | Own row, `status = 'draft'` only. |
| `provider_verification_events` | `revoke all` from `authenticated` — Worker only. |
| `provider_documents` | Own rows only; reviewers via Worker. |

### 4.5 The helper that makes verification enforceable

```sql
create or replace function public.is_verified_provider(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.provider_applications
    where user_id = p_user and status = 'verified'
  );
$$;

revoke all on function public.is_verified_provider(uuid) from public, anon;
grant execute on function public.is_verified_provider(uuid) to authenticated;
```

Every patient-data policy then requires it:

```sql
create policy bookings_select_provider on public.bookings
  for select using (
    user_id = auth.uid()
    or (provider_user_id = auth.uid() and public.is_verified_provider(auth.uid()))
    or public.has_care_relationship(auth.uid(), user_id)
  );
```

**This is the property that was impossible before B-7's table existed:** an unverified provider now reads nothing, regardless of any client-side check.

### 4.6 State machine

```
draft ──submit──▶ submitted ──reviewer opens──▶ under-review
  ▲                    │                            │
  │                    ▼                            ▼
  └────edit──── needs-info ◀───────────────────────  │
                       │                            ▼
                       └──── resubmit ────▶    rejected | verified
                                                    │       │
                                                    ▼       ▼
                                               suspended  suspended
                                                     │
                                                     ▼
                                                  reinstated ──▶ verified
```

Transitions enforced by a `security definer` function revoked from clients. The applicant can move `draft → submitted` and `needs-info → submitted`; nothing else.

### 4.7 Forged verification

| Attack | Control |
|---|---|
| Sign up with `role: admin` | B-1 fix — trigger hard-codes `consumer` |
| `update applications set status='verified'` | UPDATE revoked on `status` once submitted |
| Insert a verification event | `revoke all` from clients |
| Upload to someone else's path | RLS folder prefix `= auth.uid()::text` |
| Make the bucket public | No policy allows it; CI asserts `public = false` |
| Compromised reviewer | Step-up MFA + append-only audit + (P3) dual approval |

### 4.8 Retention

Purpose-limited: purge documents and the NIN ciphertext **90 days after a final decision**, with applicant-initiated deletion supported. Update `app/(site)/privacy/page.tsx`, which currently promises a deletion route that does not exist.

---

## 5. Proposed booking schema and status lifecycle

### 5.1 The identity problem

`provider_id text` (B-5) cannot carry authorisation. Replace with:

```sql
alter table public.bookings
  add column provider_user_id uuid references auth.users(id) on delete set null;

create index on public.bookings (provider_user_id);
create index on public.bookings (user_id);
create index on public.bookings (provider_user_id, user_id)
  where status <> 'cancelled';
```

Existing `provider_id` text values must be **reconciled before enforcement** — map to a principal where a match exists, null where it does not. Nulling is safe: it denies access, which is the correct failure direction.

### 5.2 Canonical lifecycle

The two vocabularies are **not** equivalent and must not be merged naively:

| Client status | Meaning in the product | DB equivalent today |
|---|---|---|
| `new` | Request received, nobody has acted | `new` |
| `contacted` | Provider has made contact, not yet booked | `contacted` |
| `confirmed` | Appointment agreed | `confirmed` |
| `completed` | Care happened, record exists | **no equivalent** |
| `cancelled` | Did not happen | **no equivalent** — `closed` covers both |

`closed` conflates "delivered" with "abandoned". Those have opposite access consequences, so the conflation must be split:

```sql
alter table public.bookings
  drop constraint if exists bookings_status_check;
alter table public.bookings
  add constraint bookings_status_check
  check (status in ('new','contacted','confirmed','completed','cancelled','no-show'));
```

Migration: `closed → completed` where `preferred_date < current_date`, else `closed → cancelled`. Requires a review pass over existing rows, not a blind update.

### 5.3 Access policy per status — the important question

The task asks whether cancelled and completed appointments preserve care access. **They should not, by default — and this is a deliberate change to current client behaviour.**

Current client: `lib/provider-workspace.ts` `canAccessCare()` allows access while `status !== 'cancelled'`, so a **completed** appointment preserves indefinite access to that patient's records.

Recommended:

| Status | Care access | Rationale |
|---|---|---|
| `new`, `contacted`, `confirmed` | Yes | Active care relationship |
| `completed` | **Time-boxed (default 90 days), revocable** | Records needed for continuity of care, not indefinite browsing |
| `cancelled`, `no-show` | **No** | Nothing clinical happened |
| `suspended` (facility) | No | Relationship ended administratively |

Rationale for time-limiting `completed`: the audit's concern is "an unrestricted directory of patients whose records can be browsed by any verified provider". Without a time box, one consultation grants permanent access — which is the failure mode, just harder to trigger. A provider who needs longer access must record a clinical justification.

```sql
create or replace function public.has_care_relationship(
  p_provider uuid, p_patient uuid
) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.bookings b
    where b.provider_user_id = p_provider
      and b.user_id = p_patient
      and (
        b.status in ('new','contacted','confirmed')
        or (b.status = 'completed'
            and b.preferred_date >= current_date - 90)
      )
  );
$$;
```

### 5.4 Per-verb policies

| Verb | Patient | Verified provider (tier 5) | Facility admin (tier 6) | Admin (tier 7) |
|---|---|---|---|---|
| SELECT | own | own bookings + `has_care_relationship` | **redacted view only** | Worker only |
| INSERT | own, or `user_id is null` (guest request) | no | no | Worker |
| UPDATE | cancel own while `new`/`contacted` | status of own bookings, scheduling columns only | no | Worker |
| DELETE | own while `new` | **never** | no | Worker |

```sql
create view public.facility_bookings_redacted
with (security_invoker = on) as
  select id, facility_id, preferred_date, service, status, created_at
  from public.bookings where facility_id is not null;
```

`name`, `phone` and `message` are excluded — `message` is a free-text reason for visit and is clinical.

### 5.5 Forged transitions

A client must not be able to set `confirmed` or `completed` arbitrarily. Constrain by column:

```sql
create policy bookings_update_patient on public.bookings
  for update using (user_id = auth.uid() and status in ('new','contacted'))
  with check (user_id = auth.uid());
```

Combined with a trigger that rejects a status change to anything other than `cancelled` when the actor is the patient. **No dynamic testing performed — verify with T-14/T-15 in Section 6.**

---

## 6. Test environment and test plan

### 6.1 Minimum non-production Supabase configuration

1. Create a **throwaway** project. Never test against production.
2. Record URL and anon key in a local, gitignored `.env.local`.
3. Apply migrations in order: `0001`, `0002`, then the new hardening set.
4. Auth settings: email confirmations **on**; password minimum **≥12** (Supabase defaults to 6); leaked-password protection **on**; CAPTCHA **on** for sign-up; redirect allow-list = site origin, `/auth/callback`, `/auth/verify`.
5. Service-role key → **Wrangler secret only**, never `.env.local`.
6. Seed synthetic fixtures: `consumer-a`, `consumer-b`, `provider-unverified`, `provider-verified`, `provider-other`, `facility-admin`, `admin` — all `@qa.test`.
7. **Destroy the project after testing.**

### 6.2 Local tests — runnable now, no Supabase

| ID | Test | Suite |
|---|---|---|
| L-1 | Fabricated session id cannot open a private route | `tests/auth-guard.test.ts` |
| L-2 | Guest is gated from every private route | ✅ passing |
| L-3 | Guest cannot read a signed-in user's namespace | `tests/storage-isolation.test.ts` ✅ |
| L-4 | Account A cannot read account B's namespace | ✅ |
| L-5 | Sign-out removes private keys, preserves preferences | ✅ |
| L-6 | Legacy records are not attributed to a new account | ✅ |
| L-7 | Malformed session fails closed to guest | ✅ |
| L-8 | Migration is idempotent | ✅ |
| L-9 | Guest browsing still works | `e2e/storage-isolation.mjs` ✅ |
| L-10 | Offline sign-in creates no session | `e2e/auth-hardening.mjs` ✅ |
| L-11 | Provider-workspace care-relationship rules unchanged | `tests/provider-workspace.test.ts` ✅ |

**Current status: 125 unit + 137 E2E passing.**

### 6.3 Database tests — require the test project

Each must run **as the relevant user with the anon key + that user's JWT**. Never as `service_role`, which bypasses RLS entirely.

| ID | Test | Proves | Acceptance |
|---|---|---|---|
| T-1 | Invalid password | Credential checking | Rejected; no session |
| T-2 | Unauthenticated request | Anonymous denial | Zero rows |
| T-3 | Patient reads own documents | Owner policy intact | Only own rows |
| T-4 | Patient reads another's documents | B-3 class | **Zero rows** |
| T-5 | Sign up with `data.role='admin'`, read `profiles.role` | **B-1** | **`consumer`** |
| T-6 | Consumer updates own `role` to `admin` | **B-2** | **Permission denied** |
| T-7 | Provider A reads provider B's booking | **B-3** | **Zero rows** |
| T-8 | Unverified provider reads any booking | §4.5 | **Zero rows** |
| T-9 | Verified provider reads own booking | Legitimate access | Exact row |
| T-10 | Cancelled booking then read | §5.3 | **Zero rows** |
| T-11 | Completed booking older than 90 days | §5.3 | **Zero rows** |
| T-12 | Patient sets `status='confirmed'` | §5.5 | **Rejected** |
| T-13 | Booking insert with bogus `provider_user_id` | B-5 | **FK violation** |
| T-14 | Anonymous reads `provider_emergency_participation` | **B-4** | **Zero rows** |
| T-15 | Facility admin reads `facility_bookings_redacted` | B-11 | Rows, **no `name`/`phone`/`message` columns** |
| T-16 | Facility admin reads base `bookings` | B-11 | **Zero rows** |
| T-17 | Anonymous reads `provider-documents` bucket | §4.3 | **Zero rows** |
| T-18 | Applicant writes own application after `submitted` | §4.4 | **Rejected** |
| T-19 | Applicant inserts a verification event | §4.4 | **Permission denied** |
| T-20 | Non-reviewer reads another applicant's application | §4.4 | **Zero rows** |
| T-21 | Session expiry then read own documents | §2.3 | Rejected after expiry |

### 6.4 Acceptance criteria

| Gate | Criterion |
|---|---|
| Schema | All migrations apply cleanly to a fresh project |
| RLS | **Every T-4…T-20 "negative" test observed to FAIL** with SQL and row counts attached |
| RLS | Every "legitimate access" test observed to SUCCEED |
| No bypass | Zero policy tests run as `service_role` |
| Client parity | `lib/provider-workspace.ts` tests still pass unchanged |
| Parity direction | **Database is no more permissive than the client model** |
| Storage | Bucket `public = false` asserted |
| Leakage | No provider can read a patient without a live care relationship |

---

## 7. Local data transition

### 7.1 How local profiles become authenticated accounts

**A local profile and an authenticated account are not the same thing.** A local profile has an id from `crypto.randomUUID()` and no credential; Supabase issues its own `auth.users.id`.

| Situation | Safe transition |
|---|---|
| Person has a local profile **and** wants a real account | New Supabase account; local data moved **explicitly by them**, never automatically |
| Person already has a Supabase account and a local profile | Cannot be linked automatically — the local id proves nothing |
| Person has a local profile only | Guest features only, or create an account and start clean |

**ASSUMPTION:** whether anyone actually has local profiles is unknown. Given the removed password-less sign-in, the audit's U1 ("treat real accounts as possibly exposed") should be resolved **before** inviting anyone to migrate data.

### 7.2 Quarantined records

23 private keys were moved to `healthlink:quarantine:<collection>`, which no screen reads. Migration is idempotent and never auto-attributes. Recovery is a documented console procedure in `CARENBUDDI_STORAGE_ISOLATION_REPORT.md` §3.

**Recommendation: do not restore automatically.** Ownership is unknowable. If an in-app flow is later built, it must require explicit confirmation and clearly say the app cannot prove who wrote the data.

### 7.3 Residual exposure

| Key | Contains | Why not namespaced |
|---|---|---|
| `healthlink:users` | Names, emails, phones | Device account registry; `AppGuard` and duplicate detection depend on it |
| `healthlink:provider-requests` | Applicant name, email, address, phone | Staff review screens have no backend |
| `healthlink:reports` | User-submitted reports | Staff moderation |

All three become unnecessary once accounts live on a server. Until then this is recorded, not solved.

### 7.4 Records that cannot be safely attributed

All pre-scoping data: journal, records, menstrual cycles, mood, symptoms, reminders, passport, care circle, bookings, photos, support transcripts, worker log. **No record can be attributed to an owner from the data itself.** Preserve in quarantine; recover deliberately.

### 7.5 Cloud sign-in does not purge — by design, with a caveat

`adoptCloudUser()` rewrites the session to the new `user.id`. Namespaces switch cleanly, so **no records leak between accounts**. But account A's keys remain on disk when B signs in on the same device. That is correct for a personal device (A's data survives A's next login) and **wrong for a shared one**. It needs a policy decision — "remember my data on this device" toggle, or purge on account switch — not a technical fix.

---

## 8. Migration and rollback strategy

### 8.1 Sequence

| Migration | Contents | Reversible |
|---|---|---|
| `0003_provider_verification` | `provider_applications`, `provider_documents`, `provider_verification_events`, `facility_staff` | `drop table` — new tables only |
| `0004_storage_buckets` | Private bucket + policies | `drop policy` + delete bucket |
| `0005_rls_hardening` | B-1 trigger, B-2 column grants, B-3 booking scoping, B-4 world-read closure, B-10 explicit delete | **Highest risk.** Prior policy text preserved in `0001`/`0002` |
| `0006_booking_identity` | `provider_user_id` FK, status check, reconciliation report | `drop column` |
| `0007_privileged_functions` | `security definer` functions, `revoke` statements | `drop function` |

`0005` and `0006` **must** be validated against the test project first (Section 6.3).

### 8.2 Rollback

| Layer | Rollback | Risk |
|---|---|---|
| `0003`, `0004` | Drop | Loses draft applications; acceptable pre-production |
| `0005` | Restore policies from `0001`/`0002` | **Re-opens B-1, B-2, B-3, B-4. Never roll back in production — roll forward.** |
| `0006` | Drop `provider_user_id` | Re-opens B-3/B-5; bookings become orphaned |
| `0007` | Drop functions | Reviewer endpoints break; no data loss |
| Worker endpoints | Remove route | Upload unavailable — already non-functional |
| Client auth | Git revert | **Re-enables the sign-in bypass. Never roll back to that path.** |

**Order:** revert Worker/UI → `0007` → `0006` → `0005` only if over-broad access is tolerable (it never is). Roll forward is the only acceptable production option for `0005`.

### 8.3 Deployment order for cloud enablement

1. Apply `0003`–`0007` to the test project. Run T-1…T-21. Attach evidence.
2. Fix B-9 (client) — `endSession("expired")` on the auth event.
3. Deploy **without** `NEXT_PUBLIC_SUPABASE_*`. Verify no regression (125 unit + 137 E2E).
4. Set the env vars. Deploy.
5. Monitor auth error rate and sync failures for 24 hours.

**Reversing steps 1 and 2 publishes the escalation paths.**

---

## 9. Ordered implementation plan

| Phase | Work | Blocks |
|---|---|---|
| **0** | Fix B-9: `endSession("expired")` on the signed-out auth event | cheap, do first |
| **1** | Test Supabase project + migration harness + T-1…T-21 harness | everything else |
| **2** | `0003` verification model + `0004` private bucket | B-7, B-8 |
| **3** | `0005` RLS hardening: B-1, B-2, B-3, B-4, B-10 | **enablement gate** |
| **4** | `0006` booking identity: B-5 FK, B-6 statuses | B-5, B-6 |
| **5** | `0007` privileged functions + Worker endpoints | verification flows |
| **6** | Document upload: Worker validation, magic bytes, SHA-256, retention | §3 |
| **7** | Supabase project configuration + redirect allow-list + email | §2.2 |
| **8** | Client: adopt server identity as the sole principal; remove offline profile creation | §2.9 |
| **9** | Independent security review of policies + Worker | gate |
| **P2** | Facility-admin role + redacted projection; account-registry migration | B-11 |

---

## 10. Production-readiness gates

Cloud authentication stays disabled until **every** gate passes.

### Gate A — Schema
- [ ] `0003`–`0007` apply cleanly to a fresh project
- [ ] `provider_applications` exists and is the single source of verification state
- [ ] `bookings.provider_user_id` references `auth.users`; `storage.buckets.provider-documents.public = false`

### Gate B — Authorisation (each requires an observed failure)
- [ ] T-5 `data.role='admin'` → `consumer`
- [ ] T-6 self-promotion → permission denied
- [ ] T-7 cross-provider booking → zero rows
- [ ] T-8 unverified provider → zero rows
- [ ] T-10/T-11 cancelled and expired-completed → zero rows
- [ ] T-12 patient forging `confirmed` → rejected
- [ ] T-14 anonymous participation read → zero rows
- [ ] T-16 facility admin on base `bookings` → zero rows
- [ ] T-17 anonymous bucket read → zero rows
- [ ] T-18/T-19 applicant forging verification → rejected
- [ ] **Zero policy tests run as `service_role`**
- [ ] `lib/provider-workspace.ts` tests unchanged and passing
- [ ] **Database no more permissive than the client model**

### Gate C — Authentication
- [ ] Email confirmation, leaked-password protection, CAPTCHA enabled
- [ ] Password minimum ≥12
- [ ] Redirect allow-list configured; recovery tested end-to-end
- [ ] `onAuthStateChange` signed-out purges local data (B-9)
- [ ] Idle timeout for staff roles

### Gate D — Documents
- [ ] Server-side MIME **and magic-byte** validation
- [ ] 8 MB cap; SHA-256 recorded; filenames never used as paths
- [ ] Reviewer reads via Worker only, each read audited
- [ ] 90-day retention enforced
- [ ] NIN stored as ciphertext, returned by no SELECT policy
- [ ] Synthetic fixtures only outside production

### Gate E — Local data
- [ ] Quarantine intact and unrecoverable automatically
- [ ] No silent attribution of legacy records
- [ ] Shared-device sign-out verified on a real Android device

### Gate F — Process
- [ ] Independent security review of policies and Worker endpoints
- [ ] Key-rotation and credential-exposure runbook
- [ ] `npm run lint` exits 0 (currently 2 pre-existing errors)
- [ ] CI gates green

**Explicit non-claim:** completing these gates is engineering readiness for a controlled pilot. It is **not** a security certification, penetration test, regulatory approval (including NDPA Nigeria), or clinical-safety clearance. No statement here should be represented as any of those.

---

## 11. Assumptions and unverified items

### Assumptions
| # | Assumption | Validate |
|---|---|---|
| A-1 | No production Supabase project exists | Confirm with the operator before the first migration |
| A-2 | `0001`/`0002` were never applied anywhere | Ask the operator |
| A-3 | `bookings.provider_id` values are non-empty and meaningful | Reconciliation report on the test project |
| A-4 | Supabase permits `revoke` from `authenticated` as written | Verify on the actual plan |
| A-5 | `service_role` cannot be set as a client GUC | Verify; if it can, drop the B-2 trigger's escape hatch |
| A-6 | The Worker can verify a Supabase JWT via the auth JWKS | Prototype in Phase 5 |
| A-7 | 90-day post-completion access retention is clinically acceptable | **Clinical governance decision, not an engineering one** |

### Unverified
- **U-1** Whether real personal data was ever entered on the deployed site, given the removed password-less sign-in. **Treat as likely**; resolve before cloud enablement.
- **U-2** Every RLS finding — read from SQL, not executed.
- **U-3** Whether `storage.foldername` behaves as assumed in the target Supabase version.
- **U-4** Real-device behaviour of the new sign-out and namespace switching.
- **U-5** Dark-mode contrast (never rendered).
- **U-6** Whether anyone relies on the offline registration path today.

---

*Read-only analysis. No source modified, no migration created or executed, no cloud authentication configured, nothing deployed. No secrets or patient data appear in this document.*