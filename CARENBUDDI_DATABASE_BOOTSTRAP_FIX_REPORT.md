# CareNBuddi — Database Bootstrap Fix Report

**Subject:** making the migration sequence applicable to a clean database
**Date:** 2026-10-16
**Verdict:** `0001_init.sql` could never be applied to a fresh database, which made every
migration after it unreachable. Repaired by reordering one function — nothing else changed.

| | |
|---|---|
| Migrations applying end to end, `check_function_bodies=on` | **3 / 3** |
| Bootstrap invariants after the full sequence | **30 / 30 passed** |
| Admin-role regression, hardened | **16 / 16 passed** |
| Admin-role regression, baseline (vulnerable state) | **6 / 16 passed** |
| Defence-in-depth probes | **5 / 5 passed** |
| Replay idempotency | **verified no-op** |
| Repo unit tests | **161 / 161 passed** |
| `npm run build` | **compiled successfully** |
| `npm run lint` | 17 problems (2 errors, 15 warnings) — unchanged, all outside this task |
| Production databases touched | **none** |
| Committed / pushed / deployed | **no** |

> **Repository location.** This work was done in the CareNBuddi clone at
> `C:\Users\USER\AppData\Local\Temp\opencode\carenbuddi-fix` (remote
> `github.com/temmyadekunle/CareNBuddi.git`). The session's working directory is a
> **different project** (`Livanta`, `github.com/temmyadekunle/Livanta.git`) whose
> `supabase/migrations` contains unrelated files (`0001_cloud_sync.sql`,
> `0002_profile_avatar.sql`). Every file named in this task exists only in the CareNBuddi
> clone. Nothing in the Livanta working tree was read for content or modified. **Before
> this work is reviewed or committed, the CareNBuddi clone needs to be reconciled with the
> canonical remote** — see §10.

---

## 1. Root cause

`0001_init.sql` declared `public.is_staff()` in its "helpers" block, above the table
definitions. That function queries `public.profiles`:

```sql
create or replace function public.is_staff()
returns boolean
language sql            -- <-- the body is validated at CREATE time
...
  select exists (
    select 1 from public.profiles     -- created 50 lines later, at the `create table`
    where id = auth.uid() and role in ('provider', 'admin')
  );
```

PostgreSQL parses and validates a `language sql` function body when the function is
created. `public.profiles` did not exist yet, so the statement failed:

```
ERROR:  relation "public.profiles" does not exist
```

`check_function_bodies` defaults to `on` everywhere, Supabase included. The consequences
cascaded:

- Pasted into the Supabase SQL Editor — the whole file is one implicit transaction, so it
  aborts and **nothing** is created. This is the project's own documented setup path
  (`docs/backend.md` §2).
- `supabase db push` — one transaction per migration, so `0001` fails and the CLI stops.
  `0002` and `0003` never run.

So the schema could not be created at all, and the administrator hardening in `0003` was
unreachable. That is why the previous verification had to switch `check_function_bodies`
off: it could exercise the SQL but could not exercise the *sequence*.

### Why only this one function

`check_function_bodies` resolves `language sql` bodies at creation. plpgsql bodies are
syntax-checked only, not resolved, so they may reference tables that do not exist yet.

| Function | Language | Depends on `profiles`? | Affected |
|---|---|---|---|
| `set_updated_at()` | plpgsql | no | no |
| `handle_new_user()` | plpgsql | yes (inserts into it) | **no** — body not resolved |
| `is_staff()` | **sql** | yes | **yes** |
| `is_admin()` (0003) | sql | yes | no — created long after `profiles` |
| `is_staff()` (0003) | sql | via `is_admin()` | no — same |
| `grant_role()` (0003) | plpgsql | yes | no |

`handle_new_user()` is the near miss: it also inserts into `public.profiles` and also sits
above the table, but because it is plpgsql it created without complaint.

### Other forward dependencies

Checked across all three migrations; there are **no others**:

- **0001** — tables are created in dependency-safe order. `bookings`, `provider_requests`
  and `reports` reference `auth.users` (present on Supabase); none reference each other.
  Triggers use `set_updated_at()` (defined above them) and attach to `auth.users`.
- **0002** — `emergency_request_events` correctly follows `emergency_requests`, which it
  foreign-keys. It introduces **no** new `language sql` function, and reuses
  `is_staff()` and `set_updated_at()` from 0001. Policies reference only tables created
  earlier in the same file.
- **0003** — all four functions are created after `profiles` exists, and it is
  self-contained. It applies cleanly under strict checking (verified, §6).

---

## 2. Evidence about migration history, and its limits

`0001` was not "never applied because it fails" — that inference was avoided. It rests on
seven independent lines of evidence:

1. **`.env.local` has never been tracked in git** in any commit, on any branch. Only
   `.env.local.example` exists, and it contains the literal placeholder
   `https://your-project-ref.supabase.co`.
2. **No Supabase project reference is committed anywhere.** The only `supabase.co` strings
   in the repository are the two placeholders (`docs/backend.md:41`,
   `.env.local.example:6`).
3. **No `supabase/config.toml`**, so `supabase init` was never run and the CLI was never
   set up for this project.
4. **No schema dump, no `seed.sql`, no migration-history snapshot, no tags** anywhere in
   the repository.
5. **Both migrations were added in the first commit** (`838bff9`, 2026-10-13) and have
   **never been modified since** — no apply-then-repair history.
6. **`docs/backend.md` documents provisioning as pending manual work** ("Create the
   project", "Create the tables", "Connect the app"), and the app is designed to run with
   no backend at all (`isCloudEnabled = Boolean(url && anonKey)`).
7. **Both documented apply paths abort at the same statement**, so there was no path by
   which the file could have been partially or fully applied as written.

The whole history is 10 commits over 3 days (2026-10-13 → 2026-10-15), one branch, no tags.

### Limitations of that evidence — read this honestly

- **A negative cannot be proven from inside a repository.** If someone created a private
  Supabase project by pasting *portions* of `0001` into the SQL Editor by hand, nothing in
  git would show it. `docs/backend.md` §5 tells the operator to "edit
  `profiles` directly in Supabase → Table editor", which implies the author expected a
  live project at some point.
- **The previous report's claim that "0001 has never applied cleanly anywhere" was an
  over-reach.** It was inferred from the fresh-database failure. The evidence above is
  stronger, but it is still repository evidence about a repository that is not the only
  possible host of a database.
- **The CareNBuddi clone is not the canonical remote** (see the note at the top). A
  migration could have been applied from a different checkout, a branch, or a colleague's
  machine.

Because of that, the correction chosen below was deliberately designed to be **safe even if
`0001` had been applied** — so the decision does not rest on the negative.

---

## 3. Chosen correction, and why it is safe

**A forward migration is impossible.** A corrective `0004` can never run, because the
failure happens in `0001` and the sequence stops there. Disabling
`check_function_bodies` was rejected outright: it conceals the defect, and it was exactly
what made the previous verification unable to prove the sequence worked.

**Chosen: reorder `is_staff()` within `0001` to after the table definitions.** The function
body, the `SECURITY DEFINER` wrapper, `set search_path`, the role check and the comment are
unchanged — only the position moved.

Rejected alternatives:

| Option | Why not |
|---|---|
| Rewrite `is_staff()` as plpgsql | Changes the language, and therefore inlining, volatility handling and plan shape, to fix a pure ordering problem. A far larger and less transparent change than moving a block. |
| `set check_function_bodies = off` | Explicitly forbidden, and it hides real errors. |
| Baseline / squashed migration | Discards the audit trail. Justified only if history were already unusable, and it is not needed — see below. |

### Why editing an existing migration is safe here

1. **The repaired file remains idempotent, and that is verified rather than assumed.** The
   whole safety argument for touching migration history rests on this, so it was measured:
   the full sequence was applied twice and a schema fingerprint taken each time. Tables,
   functions, function bodies (by MD5), policies and all **991 column-grant entries** were
   byte-identical after replay — §6.
2. **The function is unchanged.** The moved block is 324 bytes in both revisions with a
   matching SHA-256 (`574549673F52D770…`). `create or replace` on an identical definition
   is a no-op, so re-applying to a database that already has it changes nothing.
3. **The result is the schema the author intended.** The intended database had `profiles`
   and an `is_staff()` reading it. The repaired file produces exactly that; the broken file
   produced nothing.
4. **`0001` has no recorded consumer.** No test fixture, seed, type definition or
   application query depends on the *order* of statements inside it — only on the final
   schema, which is unchanged.

The residual risk is a database that received a hand-assembled, partial subset of `0001`.
Re-applying the repaired file to such a database is still safe: every statement is
`create table if not exists`, `create or replace function`, `drop policy if exists`, or
`create trigger`, which is what "re-running the file is safe" in `docs/backend.md` §2
already promises.

---

## 4. Files changed

Exactly one repository file was modified in this task:

| File | Change |
|---|---|
| `supabase/migrations/0001_init.sql` | `is_staff()` moved from the helpers block to a new "helper that depends on a table" section, after the tables and indexes. **+37 / −14 lines**; of the 37, 23 are a comment explaining the ordering. The function itself is byte-identical. |

Not modified: `0002_rapid_response.sql`, `0003_admin_role_hardening.sql`,
`supabase/tests/admin_role_escalation.sql`, `lib/supabase/cloud.tsx`, any application code,
any policy, any grant, any role check.

The test harness lives outside the repository, in
`C:\Users\USER\AppData\Local\Temp\opencode\pgverify` — see §10 for why that is a problem
worth fixing.

---

## 5. Exact migration execution order

The project applies migrations in lexicographic filename order:

```
1. supabase/migrations/0001_init.sql                    (schema + RLS, 5 tables)
2. supabase/migrations/0002_rapid_response.sql          (emergency schema, 3 tables)
3. supabase/migrations/0003_admin_role_hardening.sql    (role hardening, functions only)
```

Test setup order, which matters and is easy to get wrong:

```
a. auth schema stub (auth.users, auth.uid(), auth.role(); roles anon,
   authenticated, service_role)          -- Supabase provides this
b. Supabase default privileges            -- BEFORE migrations, see below
c. 0001, 0002, 0003, each with check_function_bodies = on
```

Step **b** must precede the migrations. On a real project these are `alter default
privileges` configured at creation, so each migration's objects are granted at `CREATE`
time and a later `REVOKE` wins. Applying blanket grants *after* the migrations silently
re-grants what `0003` revoked — an earlier version of this harness did exactly that, scored
the hardened state *worse* than the vulnerable one, and had to be corrected.

---

## 6. Clean-database run with strict function-body checking

Genuinely clean: `PGlite.create()` with no `dataDir` runs `initdb` from scratch. No dump, no
data directory, no reuse.

```
initial check_function_bodies = on
Supabase default privileges applied before migrations

  APPLIED  0001_init.sql                    (9825 bytes)
  APPLIED  0002_rapid_response.sql          (6414 bytes)
  APPLIED  0003_admin_role_hardening.sql    (8917 bytes)

  OK  check_function_bodies was on for every migration
```

Resulting schema:

- **8 tables** — bookings, emergency_request_events, emergency_requests, health_documents,
  profiles, provider_emergency_participation, provider_requests, reports
- **5 functions** — `set_updated_at` (plpgsql), `handle_new_user` (plpgsql, security
  definer), `is_admin` (sql, security definer), `is_staff` (sql, security definer),
  `grant_role` (plpgsql, security definer)
- **20 policies**, all 8 tables with RLS enabled

All three of `is_admin`, `is_staff` and `grant_role` carry
`SET search_path TO 'public'`, confirmed from `pg_get_functiondef`.

### Replay idempotency

```
PASS 1: 0001, 0002, 0003 applied
PASS 2: 0001, 0002, 0003 re-applied

  IDENTICAL  tables (8 entries)
  IDENTICAL  functions (5 entries)
  IDENTICAL  function bodies, MD5 (5 entries)
  IDENTICAL  policies (20 entries)
  IDENTICAL  column privileges (991 entries)

REPLAY IS A NO-OP: YES
```

### Bootstrap invariants — 30 / 30 passed

| # | Invariant | Result |
|---|---|---|
| | `check_function_bodies` on for every migration | OK |
| | RLS enabled on every public table | OK (8 tables) |
| | Policies present | OK (20) |
| | `is_staff()` delegates to `is_admin()` | OK |
| | `is_admin()` is `SECURITY DEFINER` with pinned `search_path` | OK |
| | `is_admin()` requires `role = 'admin'` | OK |
| | `handle_new_user()` cannot mint an admin from metadata | OK |
| | `grant_role()` is `SECURITY DEFINER` | OK |
| | `grant_role()` keeps both caller restrictions | OK |
| | `authenticated` cannot UPDATE `profiles` as a table | OK |
| | `authenticated` cannot UPDATE `profiles.role` | OK |
| | `authenticated` can still UPDATE `full_name` / `email` / `phone` / `lang` | OK ×4 |
| | `anon` cannot EXECUTE `grant_role()` | OK |
| | `authenticated` cannot EXECUTE `grant_role()` | OK |
| | `service_role` CAN execute `grant_role()` (the Worker path) | OK |
| I1 | Signup with `role='admin'` yields a consumer | OK |
| I2 | Consumer cannot self-promote to admin | OK (permission denied) |
| I2 | Provider cannot self-promote to admin | OK (permission denied) |
| I3 | Provider reads 0 unrelated bookings | OK (0) |
| I4 | Provider reads 0 health documents | OK (0) |
| I5 | `service_role` can provision an administrator | OK |
| I6 | Provisioned administrator retains staff access | OK (`is_admin=true`, 1 booking) |
| I7 | Provider verification cannot be self-assigned | OK (no such table) |
| I8 | Anon key cannot read profiles or bookings | OK (fails closed — see §8) |
| I9 | Anon key cannot change any role despite holding UPDATE | OK (role set unchanged) |
| I10 | Ownership intact: owner sees own records only | OK |
| I11 | Emergency-request protections intact | OK (0) |

---

## 7. Admin-role regression and defence-in-depth

The full T1–T16 suite, re-run under the now-strict harness (it no longer disables
`check_function_bodies`):

```
SUMMARY BASELINE (0001+0002 only):        6/16 passed
SUMMARY HARDENED (0001+0002+0003):        16/16 passed
```

Every assertion was executed against both states, so each one is shown to actually detect
the defect it targets. Ten of the sixteen fail without the hardening migration. The six that
pass in both states are the non-discriminating ones by design — T2, T7, T10, T11, and the
two preservation tests T12 (pre-existing administrators are not demoted) and T14 (health
documents stay owner-only). Full per-test results are in
`CARENBUDDI_ADMIN_ROLE_DB_VERIFICATION_REPORT.md`.

### `grant_role()` caller restrictions — 5 / 5

To establish that the second guard holds if the `REVOKE` is ever undone, `EXECUTE` was
deliberately re-granted to `anon` and `authenticated`, simulating a botched future
migration:

| Caller | Result |
|---|---|
| Anonymous | **blocked** — `grant_role: not permitted` |
| Consumer session | **blocked** — `grant_role: not permitted` |
| Provider session | **blocked** — `grant_role: not permitted` |
| Administrator session | allowed (intended) |
| `service_role` key (no `sub`) | allowed (intended) |

5 / 5. No ordinary session can escalate even with `EXECUTE` granted to every client role.

### Repository checks

- `npm test` — **161 / 161 passed, 0 failed**
- `npm run build` — **✓ Compiled successfully in 31.6s**
- `npm run lint` — 17 problems (2 errors, 15 warnings), **unchanged from before this task**.
  Both errors are `Calling setState synchronously within an effect` in
  `app/(app)/support/page.tsx:30` and `app/auth/verify/page.tsx:58`. Neither file is
  touched by this task and neither has anything to do with migrations.

---

## 8. Items requiring further review

None of these were changed — they are outside the bootstrap scope, and two are
security-boundary decisions the team should make deliberately.

1. **Anonymous reads now raise a permission error instead of returning zero rows.**
   `0003` revokes `EXECUTE` on `is_staff()`/`is_admin()` from `anon`, and RLS evaluates a
   policy expression *as the querying role*. `profiles_select_own` is
   `using (auth.uid() = id or public.is_staff())`, so for an anonymous query Postgres
   cannot evaluate the policy at all:

   ```
   permission denied for function is_staff
   ```

   This **fails closed** — no rows, no data, no error detail leaked — so it is not a
   vulnerability. But it converts anonymous reads from "empty result" into "500", which
   would break any unauthenticated read path. It is invisible in the current app because
   the anon flow only inserts (`bookings_insert_own` allows `auth.uid() is null`).
   **Decision needed:** accept the error, or re-grant `EXECUTE` on `is_staff()` to `anon`.
   The latter is not a weakening — for `anon`, `auth.uid()` is `NULL`, so `is_staff()`
   returns `false` and reveals nothing.

2. **`anon` holds SELECT, INSERT, UPDATE and DELETE on every public table.** That is
   Supabase's documented default, not a defect, and RLS is the barrier. It was confirmed
   that the role set is unchanged by an anonymous `UPDATE` (invariant I9). Worth a future
   migration that revokes grants `anon` demonstrably does not need.

3. **`provider_emergency_participation` is world-readable, and it has a `phone` column.**
   `0002` creates `participation_select_public ... for select using (true)`, and the anon
   key can indeed read it:

   ```
   ANON READ SUCCEEDED -> [{"provider_id":"prv-1","display_name":"Community Clinic",
                            "phone":"+2348000000000"}]
   ```

   Impact today is nil — `0002`'s own header says the schema is "not surfaced in the app
   yet" and nothing populates the table. But this becomes a public exposure of facility
   phone numbers the moment a row is inserted. The policy was presumably intended to serve
   a badge; it does not need the `phone` column.

4. **`profiles_update_own` is now partly redundant.** Row-scoping alone never prevented a
   role change; the column grant in `0003` is what enforces it. The policy is harmless
   (defence in depth) but its comment in the audit trail should reflect that the grant,
   not the policy, is the control.

---

## 9. Remaining differences between this test environment and Supabase

What was verified is real PostgreSQL — 18.6, via PGlite's WASM build. Roles, `BYPASSRLS`,
column-level privileges, RLS, triggers, plpgsql and `SECURITY DEFINER` behave as on a
server. What is **not** Supabase:

| Area | Difference |
|---|---|
| `auth` schema | A hand-written stub: `auth.users`, `auth.uid()`, `auth.role()`, and `request.jwt.claims`. **GoTrue was not exercised** — no real sign-up, email confirmation, password recovery, token refresh, or JWT minting. |
| Roles | `anon` and `authenticated` are `nologin`; `service_role` is `nologin bypassrls`. Created locally, not by Supabase. |
| Default privileges | Supabase's grants were **replicated by hand** as `alter default privileges` in `defaults.js`. A faithful model of documented behaviour, but hand-written, not the platform's own. |
| Transaction semantics | Real Postgres, but not the CLI's per-migration transaction wrapper, so a mid-sequence failure was not exercised as a rollback. |
| Storage | Supabase Storage and its RLS were not touched at all — a separate surface from database RLS. |
| Extensions | Only what PGlite ships; `gen_random_uuid()` and `pgcrypto` availability on the target project was not verified. |
| Network | None. No real request ever crossed a socket. |

**A PGlite pass is not proof of Supabase integration.** The 30 invariants and 16 regression
tests are strong evidence about SQL correctness and privilege logic. They are not a
substitute for the verification in §10.

---

## 10. Next steps

### Before anything else — reconcile the repository

1. **Establish where CareNBuddi actually lives.** The clone used here is in a temp
   directory; the session working directory is a different project. Confirm the canonical
   checkout, then re-apply this one-file change there and review the diff:
   `git diff -- supabase/migrations/0001_init.sql` should show one relocated function.
2. **Confirm no database anywhere already has this schema applied** (§2 lists the
   repository evidence; this needs a human answer about private Supabase projects). If one
   does exist, capture its current function definitions first, then re-apply the repaired
   `0001` and confirm the fingerprint is unchanged — §6 shows that is a no-op.

### Disposable Supabase verification

3. Create a throwaway Supabase project. Use a region near West Africa for realistic
   latency, and **no production data of any kind**.
4. `npx supabase init` and `npx supabase link --project-ref <ref>`, then
   `npx supabase db push`. **This is the real test of the fix** — the sequence should now
   apply in one pass with default `check_function_bodies`. Record the output; if it fails,
   report the first failure and its dependency rather than working around it.
5. Confirm on the real project, in SQL Editor:
   ```sql
   select proname, prosecdef, proconfig from pg_proc
    join pg_namespace n on n.oid = pronamespace
    where n.nspname = 'public' order by 1;
   select count(*) from pg_policies where schemaname = 'public';
   select relname, relrowsecurity from pg_class
    join pg_namespace n on n.oid = relnamespace
    where n.nspname = 'public' and relkind = 'r';
   ```
6. Run the 15 documented tests in `supabase/tests/admin_role_escalation.sql` against real
   GoTrue. That file is still **not directly runnable** — its setup uses placeholders such
   as `<consumer_a_uuid>`. Replace those with `auth.users` email lookups so the team's own
   script is the executable one.
7. Re-test the §8 item 1 behaviour on the real project, since RLS policy evaluation is
   exactly the kind of thing a stub can misrepresent. Decide on the `anon` `EXECUTE`
   question there, not from PGlite.
8. Check `provider_emergency_participation` (§8 item 3) before any row is ever inserted.

### Make the verification reproducible

9. **Move the harness into the repository.** It currently lives in a temp directory and
   will be lost; it is not in the deliverable set. This needs `@electric-sql/pglite` as a
   devDependency, which was deliberately not added unprompted.
10. Delete the `check_function_bodies = off` workaround permanently. It is already gone
    from `migrate.js`, which now asserts the setting is `on` before applying anything —
    so the suite can never again report green while the sequence is unappliable.

### Explicitly out of scope here

Provider verification, the booking-policy redesign, the open RLS findings (B-3, B-5, B-7),
and all production configuration. Nothing was committed, pushed or deployed; no `.env.local`
was created; cloud authentication remains disabled.
