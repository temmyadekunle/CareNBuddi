# CareNBuddi — Administrator Role Escalation Fix

**Scope:** the public administrator-escalation vulnerability reported in `CARENBUDDI_TECHNICAL_AUDIT.md` and `CARENBUDDI_BACKEND_SECURITY_READINESS.md` (finding B-1).
**Status:** implemented and tested locally. **Not deployed. Supabase not configured — `.env.local` is absent. No migration executed against any database.**

> **No database behaviour has been verified.** The unit tests read source text. They cannot prove that a trigger fires, that a grant holds, or that a policy denies. Section 7 lists what must be run against a disposable Supabase project before this is applied anywhere real.

---

## 1. Root cause and affected code

### 1.1 The reported defect — CONFIRMED present

`supabase/migrations/0001_init.sql`, `public.handle_new_user()` (line 37; the role branch at lines 50–54):

```sql
case
  when new.raw_user_meta_data ->> 'role' in ('consumer', 'provider', 'admin')
    then new.raw_user_meta_data ->> 'role'
  else 'consumer'
end
```

`raw_user_meta_data` is whatever the caller of `auth.signUp` supplies.

Chain, all confirmed against current source:

| Step | Location |
|---|---|
| Role sent as user metadata | `lib/supabase/cloud.tsx:225` (was ~190 before earlier edits) |
| Reached from two signup forms | `app/auth/sign-up/page.tsx:167`, `components/cloud-account.tsx:36` |
| Trigger honours it | `0001_init.sql:50-54` |
| `is_staff()` returns true for `role in ('provider','admin')` | `0001_init.sql:22-32` |
| **13 policies gated on `is_staff()`** | `0001:161,183,187,196,200,209,213`; `0002:112,116,122,127,142` |

The unlocked data includes `profiles_select_own` (**every account's name, email, phone**) and `bookings_select` (**every patient's name, phone and reason for visit**), plus write access to bookings, facility applications, reports and emergency tables.

### 1.2 A second route that needs no attacker skill at all

`is_staff()` treated **`provider`** as staff. Provider registration legitimately sends `role: "provider"` (`app/(app)/provider/register/page.tsx:208`), so **a newly registered provider could read every patient's booking the moment the account existed** — through the intended UI, no crafted request required.

This shares the entire blast radius with the reported defect and was in scope under "review related RLS policies and database functions for other paths to privilege escalation".

### 1.3 Two further paths found during the review

| Path | Location | Effect |
|---|---|---|
| `profiles_update_own` was row-scoped, not column-scoped | `0001:167-169` | `update profiles set role='admin' where id=auth.uid()` passed both clauses |
| Local user mirror fell back to `user_metadata.role` | `lib/supabase/cloud.tsx:62` (now fixed) | A denied `admin` claim would still be mirrored locally, showing staff-only screens whose every query RLS refuses |

### 1.4 Legitimate administrative provisioning

**There was none.** No `set_user_role`, no `grant_role`, no admin grant anywhere in the app or migrations. The seeded `u-admin` local account (`lib/storage.ts:380`) is a device-local profile with no cloud counterpart.

So closing the vulnerability removes no working capability — it only adds a safe way to do what previously could not be done at all.

---

## 2. Files changed

| File | Change |
|---|---|
| `supabase/migrations/0003_admin_role_hardening.sql` *(new)* | Four hardening steps: signup assigns least privilege; `is_staff()` becomes administrator-only; `profiles.role` is no longer self-assignable; one restricted `grant_role()`. |
| `lib/supabase/cloud.tsx` | `signUp` cannot request `admin` (defence in depth). `localUserFor` no longer takes `role` from client metadata. |
| `tests/admin-role-escalation.test.ts` *(new)* | 20 source-level regression tests. |
| `supabase/tests/admin_role_escalation.sql` *(new)* | 15 real-Postgres tests, **not executed**. |

`0001_init.sql` is **deliberately untouched**. Rewriting an applied migration would desynchronise every database that already ran it; `0003` supersedes the function with `create or replace`.

---

## 3. What the fix does

### 3.1 Signup assigns the least-privileged permitted role

```sql
case
  when new.raw_user_meta_data ->> 'role' = 'provider' then 'provider'
  else 'consumer'
end
```

`'admin'` is absent from the expression entirely — an admin claim is ignored, not merely validated. `'provider'` is retained because provider registration is a legitimate signup flow, and after §3.2 the provider role carries **no data access whatsoever**. Registering as a provider still grants no verification: there is no `provider_applications` table, so verification is unrepresentable rather than merely unchecked.

### 3.2 `is_staff()` means administrator

```sql
create or replace function public.is_staff() ... as $$ select public.is_admin(); $$;
create or replace function public.is_admin() ...
  where id = auth.uid() and role = 'admin';
```

The thirteen policies keep the name they already reference, so this is the smallest change that closes both routes. It is a **tightening, not a feature removal**: nothing in the product depends on a provider reading those tables unscoped, and provider-scoped access is intended to arrive later with real care-relationship policies (audit finding B-3, still open).

### 3.3 `profiles.role` is not self-assignable

```sql
revoke update on public.profiles from authenticated;
grant update (full_name, email, phone, lang, updated_at) on public.profiles to authenticated;
```

A column grant is deterministic and needs **no trigger and no session flag**. An earlier draft used a `current_setting('app.allow_role_change', ...)` escape hatch; that was dropped because it depends on clients being unable to set GUCs — an unverified assumption. Column grants have no such dependency.

### 3.4 One restricted provisioning path

`public.grant_role(p_user uuid, p_role text)` is `SECURITY DEFINER` and `revoke`d from `public, anon, authenticated`. Only the service-role credential — the Cloudflare Worker — can call it. It validates the role, requires the caller to be an administrator (defence in depth), and errors cleanly on a missing profile. **Not a backdoor:** it trusts no client-supplied flag and performs exactly the one write it claims to.

> **Corrected 2026-10-16 — read this paragraph, not the one above.** Executing the SQL against
> real PostgreSQL showed the guard described here (`if not public.is_admin()`) made the
> function **uncallable by anyone**. A service-role JWT carries a `role` claim but no `sub`,
> so `auth.uid()` is `NULL`, `is_admin()` is false, and it refused — while an administrator's
> own session is `authenticated`, whose `EXECUTE` is revoked. The only role permitted to
> execute was the one role that failed the guard.
>
> The guard is now `coalesce(auth.role(), '') <> 'service_role' and not public.is_admin()`.
> The client boundary is unchanged and was verified by re-granting `EXECUTE` to `anon` and
> `authenticated` deliberately: no ordinary session could still escalate.
>
> Details, evidence and the full T1–T16 results: **`CARENBUDDI_ADMIN_ROLE_DB_VERIFICATION_REPORT.md`**.

---

## 4. Security behaviour before and after

| Attempt | Before | After |
|---|---|---|
| Sign up with `role: 'admin'` | `profiles.role = 'admin'` | `profiles.role = 'consumer'` |
| Sign up with `role: 'ADMIN'` / padded / wrong key | `admin` (enum check is case-sensitive, but variants are the attack surface) | `consumer` |
| **Register as provider through the normal UI** | **full read of all profiles and all bookings** | provider role, **zero** extra access |
| `update own profiles.role` | succeeded | permission denied |
| `select * from profiles` as provider | all rows | own row only |
| `select * from bookings` as provider | all rows | own rows only |
| `select grant_role(...)` as admin | function did not exist | permission denied |
| Local mirror shows admin UI | possible | impossible — role comes from the profile row |

**Nothing is demoted.** `0003` re-creates functions and changes grants. It issues **no `UPDATE` on `profiles`**, so every existing role value is untouched and existing administrators keep working (verification test T12).

---

## 5. Tests run and exact results

### Unit — `npm test`

**161 passed, 0 failed** (was 141). New file: `tests/admin-role-escalation.test.ts`, **20 tests**.

### End-to-end — all against a local `wrangler dev` build

| Suite | Result |
|---|---|
| `e2e/auth-hardening.mjs` | 24 passed, 0 failed |
| `e2e/storage-isolation.mjs` | 27 passed, 0 failed |
| `e2e/provider-journey.mjs` | 49 passed, 0 failed |
| `e2e/provider-workspace.mjs` | 19 passed, 0 failed |
| `e2e/back-arrows.mjs` | 18 passed, 0 failed |
| `e2e/expired-session.mjs` | 21 passed, 0 failed |

### Build, types, lint

- `npm run build` — Compiled successfully. 0 TypeScript errors.
- `npm run lint` — 2 errors, both pre-existing (`app/(app)/support/page.tsx:30`, `app/auth/verify/page.tsx:58`, setState-in-effect). **0 errors in any file touched here.**

### Which tests touched a real PostgreSQL/Supabase instance

**None.** No Supabase project was created, no migration was executed, and no service-role key was used.

| Layer | What ran | What it proves |
|---|---|---|
| `tests/admin-role-escalation.test.ts` | Node, source text only | The vulnerable *code* is gone and has not returned |
| `supabase/tests/admin_role_escalation.sql` | **Not executed** | Nothing yet |

### Failures encountered, reported honestly

| Failure | Cause | Resolution |
|---|---|---|
| `0003 no longer lets signup metadata choose an administrator` | **My test was wrong.** I sliced from a comment that legitimately *names* admin. | Added a `sql()` comment-stripper |
| `no migration grants an administrator from user metadata` | **My test was wrong.** `0001` still contains the old code — that is correct and intentional; it is history superseded by `0003`. | Rewrote to assert `0003` supersedes it, and that no *other* migration rewrites the trigger |

Both were mistakes in my tests, not defects in the fix. No product code was changed to make a test pass.

---

## 6. Unresolved risks

1. **Nothing is dynamically verified.** Every claim in §4 is a prediction until T1–T15 run against a real database.
2. **`is_staff()` returning admin-only is blunt.** Providers legitimately need to read their own bookings. That is audit finding **B-3 and B-5**, still open — until care-relationship policies exist, providers have no server-side booking access at all. That is the safe direction, but it is not the finished state.
3. **`grant_role()` has never been executed.** Its behaviour under `SECURITY DEFINER` with revoked execute needs T9/T13.
4. **The Worker endpoint that would call `grant_role()` does not exist.** Administration is unreachable today. That is deliberate, but it means there is no way to create the first real administrator once cloud is enabled.
5. **No step-up authentication.** Any holder of the service-role key can promote anybody.
6. **B-1 was one of five enablement blockers.** B-2 (partly addressed here), B-3, B-5 and B-7 remain. **Do not set `NEXT_PUBLIC_SUPABASE_*` until all are closed.**
7. **The local `u-admin` seed is unrelated.** It is a device-local profile, unaffected by any migration.
8. **`profiles.email` was added to the update grant.** It was previously updatable in practice via the blanket table-level UPDATE, so this preserves existing behaviour rather than widening it. Worth a second look if email should be immutable after confirmation.

---

## 7. Safe verification on a disposable Supabase project

**Never against production. Never with the service-role key for a policy test** — it bypasses RLS entirely and proves nothing.

**Setup**
1. Create a throwaway Supabase project.
2. Apply `0001_init.sql`, `0002_rapid_response.sql`, `0003_admin_role_hardening.sql`.
3. Create six users at `@qa.test`: `admin`, `consumer-a`, `consumer-b`, `provider`, `provider-b`, `visitor`. Record each access token by signing in.
4. Seed one booking owned by `consumer-b`, one by `consumer-a`.
5. Provision `admin` with the service role: `select public.grant_role('<uuid>','admin');`
6. Run `supabase/tests/admin_role_escalation.sql` block by block, each with that user's token (or `set local role authenticated;` plus `request.jwt.claims`).
7. Destroy the project afterwards.

**The tests that must be observed to FAIL** — these are the ones that matter:

| ID | Expectation |
|---|---|
| T1 | Sign up with `role: 'admin'` → `profiles.role = 'consumer'` |
| T2 | Five hostile metadata shapes → all `consumer` |
| T3 | Consumer updates own role → **permission denied** |
| T4 | Provider updates own role → **permission denied** |
| T5 | Provider selects bookings → **0 rows**; `is_staff()` = false |
| T6 | Consumer-a reads consumer-b's profile → **0 rows** |
| T7 | Consumer-a reads consumer-b's bookings → **0 rows** |
| T8 | Provider reads consumer-a's booking → **0 rows** |
| T10 | Admin, consumer and provider all calling `grant_role()` → **permission denied** |
| T11 | Anon key, no session → 0 rows, `is_staff()` false |
| T12 | Existing roles unchanged after the migration |

**Must be observed to SUCCEED:** T9 (a genuinely provisioned administrator retains full access), T13 (the provisioning path works and rejects bad roles), T14 (health documents still owner-only), T15 (provider registration grants no verification).

**Acceptance:** every "must fail" row above must be *observed* to fail, with SQL and row counts attached. Until then this fix is unverified.

---

## 8. Migration and rollback

### Applying

`0003` is idempotent — `create or replace`, `revoke`/`grant`, and a redefined `is_staff()`. It can be replayed safely. Order `0001 → 0002 → 0003`.

### Rollback

| Action | Effect | Risk |
|---|---|---|
| `create or replace function handle_new_user()` with `0001`'s body | Re-opens the admin escalation | **Severe.** Roll-forward only. |
| Re-grant `update on public.profiles to authenticated` | Re-opens self-promotion | **Severe.** Roll-forward only. |
| Restore `is_staff()` to `role in ('provider','admin')` | Re-opens the provider route | **Severe.** |
| Remove `grant_role()` | Administration unreachable again | Acceptable — it already is |

**Rollback of `0003` reintroduces every route it closed.** If it must be reverted, set the environment variables back to unset first so the weakened schema is not reachable, then roll forward with a corrected migration.

### Ordering against deployment

1. Run T1–T15 against the disposable project. Attach evidence.
2. Apply `0003` to the real project **before** any code is deployed against it.
3. Deploy with `NEXT_PUBLIC_SUPABASE_*` still unset.
4. Set the env vars only after B-3, B-5 and B-7 are closed.

Reversing steps 2 and 3 publishes the escalation paths.

---

## 9. Constraints honoured

- No production Supabase environment variables set — `.env.local` is still absent.
- No migration executed against any database.
- No service-role key used anywhere.
- Nothing committed, pushed or deployed.
- No existing account, administrator or medical record removed or modified.
- Changes confined to the role-assignment path; bookings, applications and health tables untouched (asserted by a test).
- No UI, branding, route or unrelated feature changed.

---

*Implemented and verified at source level. Database behaviour NOT verified — T1–T15 remain to be run. Not deployed.*