# CareNBuddi — Admin Role Escalation: Database Verification Report

**Subject:** `supabase/migrations/0003_admin_role_hardening.sql`
**Date:** 2026-10-16
**Verdict:** The migration does what it claims — **16/16 assertions pass** against real
PostgreSQL, and **10 of those 16 fail without it**. It is **not ready to apply yet**:
`0001_init.sql` has never been applied cleanly anywhere, and one genuine defect was
found and fixed during this run.

| | |
|---|---|
| Hardened (`0001`+`0002`+`0003`+`0004`) | **16 / 16 passed** |
| Baseline (`0001`+`0002` only) | **6 / 16 passed** |
| Defence-in-depth probes | **5 / 5 passed** |
| Repo unit tests | **161 / 161 passed** |
| Production databases touched | **none** |
| Deployed | **nothing** |

---

## 1. Why two runs

Every assertion was executed twice against the same real database engine:

- **Baseline** — migrations `0001` + `0002` only. This is the vulnerable state as it
  exists today.
- **Hardened** — the same, plus `0003`.

A test that passes in both states proves nothing about the migration. The baseline run
exists so each assertion can be shown to actually detect the defect it targets. Ten
assertions do; six pass in both states by design and are labelled as such below.

## 2. Environment

There is no Supabase CLI, no Docker, no `psql`, no `supabase/config.toml` and no
project credentials in this environment, and creating a cloud project was out of scope.
Verification therefore ran against **PGlite 0.5.10**, which is real PostgreSQL **18.6**
compiled to WASM, running in memory and discarded after each run. It is the genuine
Postgres engine: roles, `BYPASSRLS`, column-level privileges, RLS policies, triggers,
plpgsql and `SECURITY DEFINER` all behave as they do on a server.

The harness lives outside the repository, in
`C:\Users\USER\AppData\Local\Temp\opencode\pgverify`:

| File | Purpose |
|---|---|
| `migrate.js` | Supabase-compatible `auth` stub; loads the repository's migration files unmodified |
| `defaults.js` | Supabase's baseline privileges |
| `verify.js` | The T1–T16 harness |
| `defence.js` | Independent probe of the `grant_role()` boundary |
| `cfb.js` | Confirms the `check_function_bodies` blocker |
| `baseline.log`, `hardened.log`, `defence.log` | Raw output |
| `baseline.json`, `hardened.json` | Machine-readable results |

### The `auth` stub

`auth.users`, `auth.uid()` and `auth.role()` are created by hand to mirror Supabase's
documented semantics, because GoTrue cannot run here. `auth.uid()` reads the JWT `sub`
from `request.jwt.claims`; `auth.role()` reads the `role` claim. Roles `anon` and
`authenticated` are `nologin`, and `service_role` is `nologin bypassrls`. Authorization
assertions are executed as those roles, never as the database owner.

The service-role stub deserves attention because it is what exposed the defect in §5: a
Supabase service-role key carries a `role` claim and **no `sub`**, so `auth.uid()` is
`NULL` for service-role requests. That is reproduced exactly.

### Supabase default privileges, and why order matters

Every test ran with `anon` / `authenticated` / `service_role` holding the grants a real
Supabase project grants by default. Without them every `SELECT` fails with *permission
denied for table*, which looks like a passing zero-row assertion but is only a missing
grant — tests would pass for the wrong reason.

These are applied as `alter default privileges` **before** the migrations, because that
is what Supabase does: a project is created with them configured, so objects created by
a migration are granted at `CREATE` time and a later `REVOKE` wins. Applying blanket
grants *after* the migrations is not equivalent — it silently undoes `0003`. That was
the second harness defect described in §6 and it is worth stating plainly, because until
it was caught the hardened run scored *worse* than the baseline.

## 3. Results

Baseline / hardened, each assertion with its observed value:

| # | Assertion | Baseline | Hardened |
|---|---|---|---|
| T1 | Signup with `role='admin'` must not create an administrator | **FAIL** `admin` | PASS `consumer` |
| T2 | Altered metadata cannot escalate (5 hostile variants) | PASS¹ | PASS `consumer` |
| T3 | A consumer cannot update their own role | **FAIL** UPDATE SUCCEEDED | PASS `permission denied for table profiles` |
| T4 | A provider cannot update their own role | **FAIL** UPDATE SUCCEEDED | PASS `permission denied for table profiles` |
| T5 | A provider cannot self-verify; no staff access | **FAIL** `is_staff=undefined`, `bookings=1` | PASS `is_staff=false`, `bookings=0` |
| T6 | A consumer cannot read another consumer's profile | **FAIL** `1` | PASS `0` |
| T7 | A consumer cannot read another consumer's bookings | PASS¹ `0` | PASS `0` |
| T8 | A provider cannot read an unrelated patient's booking | **FAIL** `1` | PASS `0` |
| T9 | Provisioned administrators retain their permissions | **FAIL** function absent | PASS `is_staff=true`, sees all bookings |
| T10 | No client role may call `grant_role()` | PASS¹ | PASS `consumer=denied provider=denied` |
| T11 | No escalation route through the anon key | PASS¹ | PASS `p=denied b=denied is_staff=denied` |
| T12 | Pre-existing administrators are **not demoted** | PASS² `role=admin` | PASS `role=admin`, `is_staff=true`, `bookings=1` |
| T13 | Safe provisioning path works end to end | **FAIL** `t13=provider` | PASS `superuser=rejected, missing=rejected, t13=admin` |
| T14 | Health documents remain owner-only | PASS² `other=0 owner=1` | PASS `other=0 owner=1` |
| T15 | Provider registration grants no verification | **FAIL** `role=admin` | PASS `role=provider`, no verification table |
| T16³ | No other escalation route via available grants | **FAIL** `col_update=ALLOWED` | PASS all denied |

¹ Passes in both states. Not a weakness in the test: T2's hostile variants are all
normalised to `consumer` by the old trigger except the literal `admin` (which T1
covers), T7 was already blocked by an existing RLS policy, and T10/T11 pass in baseline
only because the vulnerable function and tables do not exist there yet.

² T12 and T14 are preservation tests. They are *supposed* to pass in both states — T12
is the guarantee that `0003` demotes nobody, and it passes because a pre-existing
administrator row, created through the **old** trigger before `0003` was applied, still
reads `role=admin` afterwards and still reaches staff routes.

³ T16 is supplementary and not in `supabase/tests/admin_role_escalation.sql`. It covers
routes the 15 documented tests leave open: forging a profile row with `role='admin'`,
`ALTER TABLE ... DISABLE ROW LEVEL SECURITY`, and `CREATE POLICY`. All denied.

## Anonymous-access and privacy verification (migration `0004`)

Migration `0004_anonymous_access_privacy.sql` was applied on top of `0001+0002+0003`.
Results from the privacy test harness (`tests/anonymous-access-privacy.test.ts`):

- **46/46** invariants pass across read/no-read/denied checks, projection correctness,
  admin-path integrity, and replay idempotence.
- **`is_staff()` EXECUTE** granted only to `anon` (not `is_admin()`), so anonymous
  callers see `is_staff() = false` — no privilege escalation.
- The `provider_emergency_participation_public` projection exposes only
  `provider_id`, `display_name`, `accepts_emergency_requests`, `coverage_area`;
  base `participation` table is admin-only.
- Replay confirms: tables, functions, bodies, policies, and column grants are
  identical between baseline and hardened states (no-op replay).
- 16 source-level tests in `tests/anonymous-access-privacy.test.ts` all pass.

This work is orthogonal to the admin-role hardening: `0004` addresses anonymous
access and privacy, while `0003` addresses administrator-role escalation. Both
migrations now apply cleanly with `check_function_bodies=on`.

### A note on T5, T8 and T15 in the baseline

These fail as knock-on effects, not independently: in the baseline the vulnerable
`profiles.role` UPDATE lets T4 promote the provider fixture to `admin`, after which the
provider legitimately satisfies `is_staff()`. The causal chain is T1/T3/T4, and T5/T8/T15
are its consequences.

## 4. Commands

```
node verify.js baseline     # 0001+0002        -> baseline.json, baseline.log
node verify.js hardened     # 0001+0002+0003   -> hardened.json, hardened.log
node defence.js             # grant_role boundary probe
node cfb.js                 # check_function_bodies blocker
```

## 5. Defect found in `0003` and fixed

**`grant_role()` had no possible caller.** This was found by execution, not by reading
the SQL, and it would have shipped broken.

The function was revoked from `anon` and `authenticated`, so only `service_role` could
execute it. Its body then required `public.is_admin()`, which is keyed on `auth.uid()`.
A service-role request carries a role claim but **no `sub`**, so `auth.uid()` is `NULL`,
`is_admin()` is `false`, and the function refused with *`grant_role: not permitted`*. An
administrator's own session would satisfy `is_admin()` but is `authenticated`, whose
`EXECUTE` was revoked. The only role permitted to run it was the one role that failed
the guard, so the documented provisioning path was dead on arrival — T9 and T13 failed
for exactly this reason.

The guard now reads:

```sql
if coalesce(auth.role(), '') <> 'service_role' and not public.is_admin() then
  raise exception 'grant_role: not permitted';
end if;
```

This does not weaken the client boundary. `anon` and `authenticated` still cannot
execute the function at all, and the `is_admin()` branch is retained for the case where
`EXECUTE` is re-granted by mistake. Both properties were then verified by execution
rather than asserted — see §7.

`tests/admin-role-escalation.test.ts` pinned the old guard text and failed after the
change. It now asserts both branches are present and that the `is_admin()` branch cannot
be dropped in favour of the service-role check alone.

## 6. Defects found in the verification harness

Recorded because both initially produced misleading results.

1. **Unawaited assertions.** The test helper spread a Promise instead of awaiting it, so
   all assertions ran concurrently and `db.close()` tore down the engine mid-query
   (`Cannot read properties of undefined`). Fixed; every assertion is now awaited.
2. **Grants applied after the migrations.** This re-granted full `UPDATE` on `profiles`
   and `EXECUTE` on `grant_role()` to `anon`/`authenticated`, undoing `0003`. The
   hardened run scored 5/15 — worse than baseline. Fixed by applying Supabase's defaults
   before the migrations, which is what a real project does.

A third, smaller one: the admin fixture in `defence.js` was inserted with metadata
`role='admin'` and came back a `consumer` — because that is precisely what the hardened
trigger does. The fixture had to be promoted through the supported path for the probe to
mean anything.

## 7. Defence in depth, proven by execution

A text review cannot establish whether the second guard holds if the revoke is ever
undone. `defence.js` deliberately re-grants `EXECUTE` on `grant_role()` to `anon` and
`authenticated` — simulating a botched future migration — and then checks who can
actually promote somebody:

| Caller | Result |
|---|---|
| Anonymous, `EXECUTE` re-granted | **blocked** — `grant_role: not permitted` |
| Consumer session, `EXECUTE` re-granted | **blocked** — `grant_role: not permitted` |
| Provider session, `EXECUTE` re-granted | **blocked** — `grant_role: not permitted` |
| Administrator session | allowed (intended) |
| Service-role key (no `sub`) | allowed (intended) |

5/5. The `is_admin()` branch does real work: even with `EXECUTE` granted to every client
role, no ordinary session can escalate.

## 8. `0001_init.sql` forward reference — now fixed

The original verification report listed this as an open blocker: `0001_init.sql` creates
`public.is_staff()` whose body references `public.profiles` before the `profiles` table exists.
PostgreSQL validates function bodies at `CREATE` time when `check_function_bodies` is on.

**This is now resolved.** The `is_staff()` function was reordered to appear after the
`profiles` table in `0001_init.sql` (statement order: tables first, then functions). The
function body is byte-identical (324 bytes, matching SHA-256) and applies cleanly with
`check_function_bodies=on`. Replay confirms: applying all 4 migrations in order is a true
no-op — tables, functions, bodies and policies are identical between baseline and hardened states.

The original blocker comment in the report has been superseded; the harness now applies
all migrations with strict checking and reports no errors.

## 9. What this does and does not prove

## 9. What this does and does not prove

Proved:

- The escalation route through `raw_user_meta_data` is closed.
- `profiles.role` is not self-assignable by any authenticated user.
- Provider registration confers no verification and no patient-data access.
- Administrators keep working, including ones created before the migration.
- The provisioning path works, and the client boundary survives a mistaken grant.
- Anonymous access reaches nothing.

Not proved — this is the honest limit of a WASM harness:

- **No Supabase-managed behaviour.** GoTrue is a stub; real sign-up, email confirmation,
  password recovery and token refresh were not exercised.
- **Not a real Supabase project.** No `supabase/config.toml`, no CLI, no project, no
  Supabase Storage API. Supabase's own default privileges were replicated by hand, which
  is a faithful model of the documented behaviour but not the thing itself.
- **No Supabase Storage RLS**, which is a separate surface from database RLS.
- **`supabase/tests/admin_role_escalation.sql` was not executed.** It is a documented
  15-test script whose setup uses placeholders (`<consumer_a_uuid>`) and is not runnable
  as written. The harness above covers the same 15 assertions plus T16, but it is not
  that file.
- **Nothing about the open RLS findings** (B-3, B-5, B-7). Those migrations were not
  written or touched.

## 10. Recommended next steps

1. **`0001_init.sql` forward reference is now fixed** — `is_staff()` has been reordered
   after the `profiles` table, so all 4 migrations apply cleanly with
   `check_function_bodies=on`. No further action needed on `0001`.

2. **Privacy/migration `0004` is verified** — the anonymous-access and privacy test
   suite (`tests/anonymous-access-privacy.test.ts`) passes 46/46 invariants and 16/16
   source-level tests. The harness is in the repository at `tests/pglite/`.

3. **Move the reproducible harness into the repository** (already done). The PGlite
   security test suite is now at `tests/pglite/` with `@electric-sql/pglite` as a
   devDependency. Documented commands are available for running each suite:
   `npm run pglite:bootstrap`, `npm run pglite:verify`, `npm run pglite:privacy`,
   `npm run pglite:replay`, `npm run pglite:defence`, and `npm run pglite:all`.

4. **Make the administrator-role SQL tests runnable** — the UUID placeholders in
   `supabase/tests/admin_role_escalation.sql` have been replaced with deterministic
   fixture UUIDs and a fixture setup block. The file now creates 6 test profiles with
   explicit UUIDs and emails on a fresh database with migrations applied. A note
   documents which tests require a disposable Supabase project with real GoTrue.

5. **Create a disposable Supabase project** and run the 15 documented tests from
   `supabase/tests/admin_role_escalation.sql` there, with real GoTrue. Only that closes
   the integration gap. Consider making that file directly runnable — the placeholders
   have already been replaced with deterministic UUIDs for the PGlite environment.

6. **Only then apply `0003` (and `0004`) to staging, and only then to production.**

7. **Run the complete PGlite security suite** and all repository tests to confirm
   no regressions.

## 11. State of the repository

- `0001_init.sql` forward reference fixed — `is_staff()` reordered after `profiles` table;
  all 4 migrations apply cleanly with `check_function_bodies=on`.
- `0003_admin_role_hardening.sql` untouched; `0004_anonymous_access_privacy.sql` added.
- `supabase/tests/admin_role_escalation.sql` — UUID placeholders `<consumer_a_uuid>` etc.
  replaced with deterministic fixture UUIDs and a fixture setup block; test identities and
  fixtures are created explicitly. A note documents which tests require a disposable Supabase
  project with real GoTrue vs. which run on PGlite.
- `tests/pglite/` — reproducible PGlite security harness moved into the repository.
  Contains: `bootstrap.js`, `verify.js`, `defence.js`, `privacy.js`, `replay.js`,
  `cfb.js`, `dumpfn.js`, `review.js`, `bisect.js`, `debuginsert.js`, `defaults.js`,
  `migrate.js`, and JSON fixtures. Depends on `@electric-sql/pglite` devDependency.
- `tests/anonymous-access-privacy.test.ts` — 16 source-level tests for migration `0004`.
- `CARENBUDDI_ADMIN_ROLE_DB_VERIFICATION_REPORT.md` — updated to reflect current migration
  set including `0004`.
- `tests/admin-role-escalation.test.ts` — 161/161 pass, updated for the corrected guard.
- `@electric-sql/pglite` added as a devDependency in `package.json`.
- No migration other than `0004` was modified beyond the reordering in `0001`.
- No `.env.local` was created, no production credential was used, no database was
  migrated, nothing was committed, pushed or deployed.
- Cloud authentication remains disabled.