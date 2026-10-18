# CareNBuddi — Anonymous Access & Privacy Fix Report

**Subject:** the two unresolved findings from `CARENBUDDI_DATABASE_BOOTSTRAP_FIX_REPORT.md` §8
**Date:** 2026-10-16
**Verdict:** Both findings were real. Finding A was a broken contract for a documented
anonymous operation; Finding B was a genuine disclosure of provider phone numbers to a
public credential. Both are corrected in one new forward migration. No existing migration
was edited.

| | |
|---|---|
| New migration | `0004_anonymous_access_privacy.sql` (additive) |
| Migrations edited | **none** — `0001`, `0002`, `0003` untouched |
| Privacy + anonymous suite (PGlite) | **46 / 46 passed** |
| Bootstrap invariants after the full 4-migration sequence | **30 / 30 passed** |
| Admin-role regression, hardened (0001+0002+0003+**0004**) | **16 / 16 passed** |
| Admin-role regression, baseline (vulnerable) | **6 / 16 passed** |
| Defence-in-depth probes | **5 / 5 passed** |
| Replay idempotency (4 migrations applied twice) | **verified no-op** |
| Repo unit tests | **177 / 177 passed** (16 new) |
| `npm run build` | **compiled successfully** |
| `npm run lint` | 17 problems (2 errors, 15 warnings) — unchanged from before this task |
| Real Supabase integration | **not performed** — connection attempted, 401, see Appendix A |
| Committed / pushed / deployed | **no** |

> **Working directory.** The session's working directory is `Livanta`
> (`github.com/temmyadekunle/Livanta.git`), a different project. All work was done in the
> CareNBuddi clone at `C:\Users\USER\AppData\Local\Temp\opencode\carenbuddi-fix`
> (`github.com/temmyadekunle/CareNBuddi.git`). Nothing in the Livanta tree was read for
> content or modified.

---

## 1. Root cause

### Finding A — anonymous queries fail with a permission error

`0003` hardens `is_staff()` and, in the same breath, revokes it from `anon`:

```sql
revoke all on function public.is_staff() from public, anon;
grant execute on function public.is_staff() to authenticated;
```

Row level security evaluates a policy expression **as the querying role**. Eleven policies
invoke `public.is_staff()`:

| Policy | Table | Operation |
|---|---|---|
| `profiles_select_own` | `profiles` | SELECT |
| `bookings_select` | `bookings` | SELECT |
| `bookings_update_staff` | `bookings` | UPDATE |
| `provider_requests_select_staff` / `..._update_staff` | `provider_requests` | SELECT / UPDATE |
| `reports_select_staff` / `..._update_staff` | `reports` | SELECT / UPDATE |
| `emergency_requests_select` / `..._update_staff` | `emergency_requests` | SELECT / UPDATE |
| `emergency_events_insert_staff` / `..._select_staff` | `emergency_request_events` | INSERT / SELECT |
| `participation_write_staff` | `provider_emergency_participation` | ALL |

So an anonymous caller could not have any of those policies evaluated at all, and the query
raised `permission denied for function is_staff` rather than returning an empty result.

**This is a broken contract, not merely a cosmetic error.** `docs/rapid-response.md`
"RBAC / operations boundary" documents the anon key as a participant:

> Anonymous / requester | INSERT own (`user_id = auth.uid()` or null), **SELECT own** |
> **SELECT** own request's history

Those anonymous SELECTs were failing. The `INSERT` paths were unaffected, because
`emergency_requests_insert` and `bookings_insert_own` do not reference `is_staff()`.

### Finding B — provider phone numbers readable with the public anon key

`0002` published an entire table:

```sql
create policy participation_select_public on public.provider_emergency_participation
  for select using (true);
```

`provider_emergency_participation` carries `phone`, `coverage_area`, `last_seen_at`,
`display_name` and `accepts_emergency_requests`. `USING (true)` publishes the whole row,
and the anon key is a **public credential** that ships in the browser bundle. Confirmed by
execution before the fix:

```
ANON READ SUCCEEDED -> [{"provider_id":"prv-1","display_name":"Community Clinic",
                         "phone":"+2348000000000"}]
```

The exposure was latent, not live: nothing populates the table (`0002`'s own header: "there
is no ambulance partner… nothing here runs automatically"). But it would publish facility
phone numbers to anyone who loaded the app, the moment a row existed.

---

## 2. Intended access model, and why

Established from the repository, not assumed:

1. **`docs/rapid-response.md` §"RBAC / operations boundary"** is the authoritative table,
   and it names the anon key as a legitimate actor for the emergency tables. That makes
   Finding A a real functional break, and it also rules out the alternative correction of
   removing anonymous access from those tables.
2. **Nothing in the application reads `provider_emergency_participation`.** A repository-wide
   search for `provider_emergency_participation`, `emergency_requests` and
   `emergency_request_events` across all `.ts`/`.tsx`/`.mjs`/`.js` source returns **zero**
   matches. The `/emergency` facility list is built by `emergencyFacilities()` in
   `lib/rapid-response.ts:304`, which filters the **in-app provider directory** on
   `emergency === true` — local data, not this table.
3. **The future consumer of the participation table is staff-gated.** The same document says
   the partner/ops dashboard is "Built when the first partner activates" and that
   "`/worker`, `/provider`, `/admin` remain behind `AppGuard`'s `STAFF_PATHS` role gate".
4. **The "public" capability was about a badge, not the roster.** `0002`'s comment: "the
   client may badge facilities that accept coordination". A badge needs
   *which facilities take emergency work, and where* — not their phone numbers.

So the intended model is: **a public, minimal projection for the badge; the roster itself is
staff-only.** The defect was expressing "the part a badge needs" as "the whole table".

---

## 3. Files and migrations changed

| File | Change |
|---|---|
| `supabase/migrations/0004_anonymous_access_privacy.sql` | **New.** Both corrections. |
| `tests/anonymous-access-privacy.test.ts` | **New.** 16 source-level regression tests. |
| `docs/rapid-response.md` | RBAC table updated to the corrected model; known gap recorded. |

**Not changed:** `0001_init.sql`, `0002_rapid_response.sql`,
`0003_admin_role_hardening.sql`, `supabase/tests/admin_role_escalation.sql`, any
application source, any authentication, booking or provider-verification code, any UI.

### What `0004` does

```sql
-- Finding A
grant execute on function public.is_staff() to anon;

-- Finding B
drop policy if exists participation_select_public
  on public.provider_emergency_participation;

create or replace view public.provider_emergency_participation_public as
  select provider_id, display_name, accepts_emergency_requests, coverage_area
  from public.provider_emergency_participation;

grant select on public.provider_emergency_participation_public
  to anon, authenticated, service_role;

revoke insert, update, delete on public.provider_emergency_participation_public
  from public, anon, authenticated;
```

### Why the `is_staff()` grant is safe, and narrow

- For the anon key `auth.uid()` is `NULL` (the anon JWT carries no `sub`), so
  `where id = auth.uid() and role = 'admin'` is never true and `is_staff()` **provably
  returns false**. It cannot return data, promote anyone, or serve as an oracle — it
  reports only the caller's own staff status.
- `is_admin()` is **not** granted to `anon`. No policy references it; its only caller is
  `is_staff()`, which runs as its owner.
- The administrator-only meaning of `is_staff()` is unchanged, and no role check is relaxed.
- What changes is precisely: a raised error becomes an empty result.

This is the narrowest correction available. The alternative the brief prefers — "prevent the
unnecessary query" — does not apply, because the anonymous query *is* a documented,
legitimate operation. A new `anon`-safe wrapper function would add an object without
removing the need for `is_staff()` in policies.

### Why a view, and the one thing to know about it

The public capability is preserved as a **projection**, not a table read, and the base
table's `USING (true)` policy is dropped rather than replaced with a cosmetic predicate.

The view is deliberately **not** created with `security_invoker = true`, so its reads run
with the view owner's privileges and bypass the base table's RLS. That is what allows a
public projection to exist while the roster stays locked, and it means **the column list is
the entire security boundary** — adding a column to it is a disclosure decision, which is
why the migration carries a prominent warning and a `comment on view`. If the view were ever
made `security_invoker`, it would return zero rows to anonymous callers: fail-closed, not a
leak.

No privileged server-side function was added. The authorized path for full roster data —
including `phone` — already exists and is unchanged: `participation_write_staff` is
`for all using (public.is_staff())`, and since `0003` `is_staff()` means administrator.
Adding a broker function would have been a speculative authorization model with no caller.

---

## 4. Tests executed, and exact results

Three distinct kinds of test. **None of them is real Supabase integration.**

### 4a. Source-level assertions — `npm test`, 177 / 177 passed

16 new tests in `tests/anonymous-access-privacy.test.ts`, run in the normal suite with no
database. They assert the migration's text and the surrounding contract, e.g. that the
projection lists exactly four named columns and never `select *`, that `is_admin()` is never
granted to a client role, that no new policy is created on the base table, and that no
source file reads the roster.

A green result here proves nothing about runtime behaviour. That is the next layer's job.

> These 4 failures were mine, not the product's, and are worth recording: my negative
> assertions initially matched the migration's own explanatory comments, and one matched the
> column `accepts_emergency_requests` when it meant the table `emergency_requests`. Fixed by
> asserting against comment-stripped SQL with an identifier boundary.

### 4b. PGlite execution — real PostgreSQL 18.6, full 4-migration sequence

`check_function_bodies=on`, fresh `initdb`, Supabase default privileges applied before the
migrations, every query run as `anon` / `authenticated` / `service_role` with a JWT `sub`
and never as the database owner.

| Suite | Result |
|---|---|
| **Privacy + anonymous** (`privacy.js`) | **46 / 46 passed** |
| **Bootstrap invariants** (`bootstrap.js`) | **30 / 30 passed** |
| **Admin-role regression, hardened** (0001+0002+0003+**0004**) | **16 / 16 passed** |
| **Admin-role regression, baseline** (0001+0002, the vulnerable state) | **6 / 16 passed** |
| **Defence in depth** (`defence.js`) | **5 / 5 passed** |
| **Replay idempotency** (`replay.js`) | **no-op confirmed** — 4 migrations applied twice, tables / functions / function-body MD5s / 20 policies / 991 column grants all identical |

### 4c. Real Supabase integration — **not performed**

No Supabase project exists, no CLI is configured, no credentials were requested or used.
This remains the open item; see §8.

### Repository checks

- `npm test` — **177 / 177 passed, 0 failed**
- `npm run build` — **✓ Compiled successfully in 51s**
- `npm run lint` — **17 problems (2 errors, 15 warnings)**, identical to the pre-existing
  baseline. Both errors are `Calling setState synchronously within an effect` in
  `app/(app)/support/page.tsx:30` and `app/auth/verify/page.tsx:58`, unrelated to this work.
  My new test file is lint-clean (an unused-variable warning it introduced was fixed rather
  than left behind).

---

## 5. Proof that public phone-number access is denied

Each row is an executed assertion as the `anon` role, after the full sequence. Fixtures use
obviously-fake numbers; no real personal data was added.

| Probe | Result |
|---|---|
| `anon SELECT count(*) FROM provider_emergency_participation` | **0 rows** |
| `anon SELECT * FROM provider_emergency_participation` | **0 rows** |
| `anon SELECT phone FROM provider_emergency_participation` | **0 rows, `[]`** |
| `anon SELECT provider_id, phone … WHERE phone IS NOT NULL` | **0 rows** — a filter cannot be used as a side channel |
| Projection columns | `provider_id, display_name, accepts_emergency_requests, coverage_area` — no `phone`, no `last_seen_at` |
| `anon` reads the projection | **2 rows** (the intended public capability still works) |
| Any `+234000000000*` value anywhere in the projection | **none** |
| `anon` INSERT / UPDATE on the projection | **denied** |

Before the fix, the same `anon` role returned the phone number. That contrast is the proof.

Provider isolation, also executed:

| Probe | Result |
|---|---|
| Provider reads the roster | **0 rows** |
| Provider flips another provider's `accepts_emergency_requests` | **denied**; `prv-beta` still `false` |
| Provider reads patient bookings via emergency access | **0 bookings** |

---

## 6. Evidence that legitimate emergency operations remain possible

The full authorized path was executed end to end, not asserted:

| Step | Result |
|---|---|
| `service_role` provisions an administrator via `grant_role()` | **OK** |
| Provisioned administrator: `is_staff()` | **true** |
| Administrator reads the full roster **including both phone numbers** | **2 rows, `+2340000000001, +2340000000002`** |
| Anonymous requester creates an emergency request | **OK**, 1 row in `created` |
| Administrator moves the request through the status machine | **1 row updated** → `dispatched` |
| Administrator appends the audit event | **appended** |
| Administrator reads the projection | **unchanged** |

And the finding-A contract is restored — anonymous reads resolve without error and return
nothing, across all six `is_staff()`-gated tables:

| `anon SELECT` | Error? | Rows |
|---|---|---|
| `profiles` | none | 0 |
| `bookings` | none | 0 |
| `provider_requests` | none | 0 |
| `reports` | none | 0 |
| `emergency_requests` | none | 0 |
| `emergency_request_events` | none | 0 |

`anon UPDATE emergency_requests` also no longer raises a function-permission error.

Emergency-request integrity is intact, verified by execution:

| Probe | Result |
|---|---|
| Non-staff user moves a request's status | **denied**; `dispatched` count 0 → 0 |
| Non-staff user appends an audit event | **denied**; events 0 → 0 |
| Administrator rewrites an audit event | **denied**; `rewritten=0` |
| Owner reads own health documents | **1** |
| Non-owner authenticated caller reads them | **0** |
| `anon` reads `health_documents` / `bookings` | **0 / 0** |

---

## 7. Administrator hardening is intact

Re-run after adding `0004`; the hardened state is now 0001+0002+0003+**0004**.

| Check | Result |
|---|---|
| `signup with role='admin'` | yields `consumer` |
| Consumer / provider self-promote to admin | both **permission denied** |
| Provider reads unrelated bookings | **0** |
| Provider reads health documents | **0** |
| `anon` executes `grant_role()` | **no** |
| `authenticated` executes `grant_role()` | **no** |
| `service_role` executes `grant_role()` | **yes** |
| `authenticated` updates `profiles.role` | **no** |
| `anon` executes `is_admin()` | **no** |
| `is_staff()` still delegates to `is_admin()` | **yes** |
| Pre-existing administrators not demoted (T12) | **pass** |
| Defence in depth: `EXECUTE` re-granted to `anon` + `authenticated` | anon / consumer / provider **all blocked**; admin and `service_role` allowed — **5/5** |

10 of the 16 admin assertions still fail against the un-hardened baseline, so they continue
to discriminate.

---

## 8. Remaining differences between PGlite and Supabase

| Area | Difference |
|---|---|
| GoTrue | **Stubbed.** `auth.users`, `auth.uid()`, `auth.role()`, `request.jwt.claims`. No real sign-up, email confirmation, token refresh, or JWT minting. |
| Auth role grants | The stub grants `usage` on schema `auth` and `EXECUTE` on the auth helpers, which is what real Supabase does. **This was a bug in my harness, found and fixed during this task** — without it, an anonymous caller could not be modelled at all and the documented anonymous `INSERT` appeared to be broken. It was not a product defect. |
| Supabase default privileges | Replicated by hand as `alter default privileges` in `defaults.js`, applied **before** the migrations. Faithful to documented behaviour, but hand-written. |
| RLS policy evaluation | Executed by real PostgreSQL, which is the mechanism at issue. The one behaviour most worth re-testing on Supabase is §9's `RETURNING` interaction, since it involves how PostgREST adds `Prefer: return=representation`. |
| `security_invoker` view default | If a Supabase project's PostgreSQL version or defaults differ, the view's owner-privileged behaviour should be re-confirmed. |
| Storage, Cron, Edge Functions, Realtime | Not touched. |

**A PGlite pass is not proof of Supabase integration.** These results are evidence about SQL
correctness and privilege logic on a real Postgres engine. They do not substitute for §10.

---

## 9. Unresolved clinical, privacy and product decisions

Four items. None was fixed here; each needs a human decision, and two would require
inventing an authorization model that the code does not specify.

**1. Anonymous `insert ... returning` is refused — pre-existing, and a genuine design gap.**

`0002` allows an anonymous requester to insert an emergency request
(`with check (auth.uid() = user_id or auth.uid() is null)`), but PostgreSQL applies the
table's **SELECT** policies to a `RETURNING` clause, and an anonymous caller can never
satisfy `auth.uid() = user_id` when `user_id IS NULL`. Executed proof:

```
insert ... status) values (...)                     -> SUCCEEDED
insert ... status) values (...) returning id        -> FAILED
     new row violates row-level security policy for table "emergency_requests"
```

This is **not** caused by `0004`; it reproduces identically on 0001+0002 alone. It matters
because the Supabase JS client adds `RETURNING` whenever a caller asks for the created row
(`.insert(...).select()`), which is the normal way to use it.

The underlying question cannot be answered from the code: **an anonymous caller has no
identity with which to distinguish "its own" `user_id IS NULL` row from anyone else's.** Any
policy that lets an anonymous requester read back its own anonymous request also lets every
other anonymous caller read all of them — which for a table holding `requester_phone` and
`location_text` would be a new privacy exposure. The choices are (a) anonymous requests stay
write-only, and status is not readable by the requester; (b) issue a short-lived claim or
receipt token so the requester can read back exactly its own row; or (c) require sign-in for
emergency requests. **That is a product and clinical-safety decision, and I did not pick one.**

**2. Is `coverage_area` public?** It is included in the projection because a "nearby
emergency care" badge needs to know where a facility operates. It is not personal data, but
it is operational. If the team considers it sensitive, remove it from the four-column list
in `0004` — a one-line change, and the only column whose inclusion is a judgement call.

**3. The public projection has no reader yet.** Nothing consumes
`provider_emergency_participation_public` today, because the facility list comes from the
in-app directory. If the intent is for `/emergency` to eventually read the projection, that
is a product decision plus an app change, deliberately out of scope here.

**4. `0002` is still the "established" migration, not `0001`.** The bootstrap report
established that `0001` had never been applied. `0002` and `0003` are newer and, on the
evidence available, also unapplied — but that is an inference, not a proof, and the same
discipline applies: a human should confirm no database anywhere holds this schema before
`0004` is applied. `0004` is additive and was verified as a replay no-op, so applying it to
an existing database is safe regardless.

---

## 10. Next steps

1. **Reconcile the repository** — confirm the canonical CareNBuddi checkout, re-apply
   `0004`, `tests/anonymous-access-privacy.test.ts` and the `docs/rapid-response.md` edit
   there, and review the diff. Do not commit from the temp clone.
2. **Move the test harness into the repository.** It lives in a temp directory and is not
   part of the deliverable, so none of §4b is reproducible by the team. This needs
   `@electric-sql/pglite` as a devDependency, which was not added unprompted.
3. **Decide §9 item 1** before any requester-facing emergency flow ships. It is a
   clinical-safety question — a person who cannot see their request's status may call again
   or give up.
4. **Confirm §9 item 2** (`coverage_area` public or not).
5. **Disposable Supabase verification** — create a throwaway project, no production data:
   - `npx supabase init`, `npx supabase link --project-ref <ref>`, `npx supabase db push`.
     All four migrations should apply in one pass with default `check_function_bodies`.
   - Verify the view and its grants:
     ```sql
     select table_name, is_insertable_into from information_schema.views
      where table_schema='public' and table_name='provider_emergency_participation_public';
     select proname, proacl from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and proname in ('is_staff','is_admin','grant_role');
     ```
   - Exercise, **as the anon role**, that the roster and `phone` are denied and the
     projection answers, and that `anon SELECT` on each `is_staff()`-gated table returns
     zero rows rather than an error.
   - Re-test the `RETURNING` behaviour through PostgREST, which is where it actually bites.
6. **Only then** consider staging, and production last. Provider verification, the
   booking-policy redesign, and the open RLS findings (B-3, B-5, B-7) remain separate
   milestones.

Nothing was committed, pushed or deployed. No `.env.local` was created, cloud
authentication remains disabled, and no production system was contacted **by the
verification suites**.

---

## Appendix A — Attempted connection to the live CareNBuddi project (2026-10-16)

Recorded because it contacted a live system, even though nothing was changed.

The CareNBuddi Supabase project URL (`brtaonqxlqvoknezqkjp.supabase.co`) and its
**anon** key were supplied after this report was written, with the note "it's
CareNBuddi supabase link". The anon key is the public, browser-facing credential.

**What was attempted — read-only, non-mutating, GET requests only:**

| Request | Result |
|---|---|
| `GET /rest/v1/` (apikey + bearer) | **401** `{"message":"Invalid API key"}` |
| `GET /auth/v1/health` (no credentials) | **401** `{"message":"No API key found in request"}` |
| `GET /rest/v1/` (apikey only) | **401** `{"message":"Invalid API key"}` |

Retried through Node's `fetch` as well as PowerShell, to rule out a client-side header
artifact. Same result, and the responses then included their bodies.

Probing stopped there. Further variation of credentials against a live healthcare project
is not appropriate.

**The diagnosis, corrected.** An earlier revision of this appendix guessed that the project
might be paused or that the gateway was blocking. That was wrong, and the response bodies
show why: the health endpoint returned a well-formed Supabase JSON error rather than a
timeout or a `502`, which means **the project is reachable and serving**. The rejection is
specific and explicit —

> `{"message":"Invalid API key","hint":"Double check your Supabase anon or service_role API key."}`

Supabase parsed the credential and does not recognise it. The likely causes, in order: the
key has been **revoked or rotated**; or the project has been migrated to Supabase's newer
API-key scheme (`sb_publishable_…`), which supersedes the legacy `anon` JWT.

The credential's structure was then checked locally, with no network access, and is
**perfect**: three segments, a valid `{"alg":"HS256","typ":"JWT"}` header, decodable claims,
and a signature of exactly 43 base64url characters / 32 bytes, which is the correct HS256
length. It is therefore not truncated or obviously corrupted in transit — Supabase is
rejecting a well-formed key it no longer accepts.

**What this establishes and what it does not.** It does **not** establish anything about
the database: no schema was listed, no table was read, no row was retrieved, and no
assertion in this report changed. `permission denied for function is_staff` — the Finding A
symptom — was reproduced in PGlite only, never against this project.

One incidental observation: the key's `iat` is **2026-10-05**, which predates the commits
that introduced these migrations (**2026-10-13**). That does not prove anything about
whether a migration was applied — keys can be reissued and the project may have been
provisioned earlier and migrated later — but it is consistent with the §2 finding of the
bootstrap report that no migration has been applied to a real database.

**Handling.** The key was never written to disk: no `.env.local` was created, and neither
the key nor the project ref appears in any repository file. It was used only in transient
process memory, and only as the public credential it is designed to be.

**Still required to close this out** — a genuinely disposable project, plus one of:

- the Supabase CLI access token (`sbp_…`) or the database password, to run `db push` and
  apply the migrations, or
- the current valid API key, if the goal is only read-only RLS probing.

Neither was requested here, and neither should be pasted into this session. The migration
and bootstrap verification therefore remains **unverified against real Supabase**.
