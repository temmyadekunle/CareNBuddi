# CareNBuddi — disposable local Supabase integration suite

**Prohibited targets.** This suite must never run at: production Supabase,
any linked project (`supabase link` project refs), any host that is not a
loopback endpoint, or any URL opened where `config.toml` was not committed in
this repository. The runner refuses to start if the endpoint is not positively
identified as a disposable local stack; there is no remote fallback. There is
no emergency "unblock" flag: loops are closed and keys never defaulted locally.

## Safeguard tests (run with `npm test` — no Docker/no network needed)

`guards.test.ts` verifies the fail-closed configuration layer:

| test | what it proves |
| --- | --- |
| missing opt-in is refused | the runner does nothing unless `CARENBUDDI_INTEGRATION_TESTS=1` |
| unconfirmed-disposable refused | cleanup and execution require `CARENBUDDI_LOCAL_STACK_CONFIRMED=1` |
| missing SUPABASE_URL refused | no inference/defaulting to any URL |
| non-loopback, remote, `*.supabase.co/net/in/com` refused | linked/remote environments cannot be reached |
| missing anon key refused | nothing runs half-configured |
| service key identical to anon key refused | no accidental privilege escalation |
| embedded user:pass credentials in the URL refused | keys travel only via key variables |
| non-quad `127.*` hostnames refused | a host string like `127.0.0.1.evil.com` (DNS-controlled) is not trusted |
| secret redaction | values of the configured keys/bearer/`sb_secret_*` are masked before any log output |
| short secrets fully redacted | secrets below 8 characters cannot be stubbed safely, so they are replaced outright |
| logger wrapper redacts | the console path is proven safe |

These are **safeguard results, not real-supabase test results.** They never
demonstrate migration, RLS, storage or Storage API behaviour.

## Which files are what

- `guards.ts` — pure configuration guard + masking logger (no network).
- `guards.test.ts` — the safeguard suite above.
- `run-local.ts` — the real-service scenarios. **Not** matched by
  `npm test` and never executed by CI or the unit test command: it performs
  signup/DB/storage calls against the declared local stack explicitly.

## Run prerequisites and local tooling

- Docker (or Podman with suitable binding) available and running.
- Node.js 20+ (matches the repo).
- Repo-local `@supabase/supabase-js` (already declared in `package.json`).

The Supabase CLI is used via `npx` (no global install), version pinned by the
repo in the docs to ≥ 2.121.0.

## Procedure

```powershell
# 1. start the disposable local stack for THIS repository only:
npx supabase init            # local-only wiring, no project link
npx supabase start           # ephemeral keys printed to the console

# 2. apply migrations on the local database (disposable only):
npx supabase db reset        # runs 0001..0008 on the local stack

# 3. gather the local connection details (never from a remote source):
npx supabase status          # SUPABASE_URL
                             # SUPABASE_ANON_KEY        (safe in scripts, NOT in logs)
                             # SUPABASE_SERVICE_ROLE_KEY (setup/teardown ONLY)

# 4. run the integration suite locally, with explicit opt-in + explicit
#    target confirmation. Environment variable names matter: the runner
#    fails closed without them.
$env:SUPABASE_URL      = "http://127.0.0.1:54321"   # from `supabase status`
$env:SUPABASE_ANON_KEY = "<from supabase status>"
$env:SUPABASE_SERVICE_ROLE_KEY = "<from supabase status>"   # optional: unlocks the
                               # administrator-led flow and cleanup; without it those checks SKIP
$env:CARENBUDDI_INTEGRATION_TESTS      = "1"
$env:CARENBUDDI_LOCAL_STACK_CONFIRMED  = "1"
node --import ./tests/register.mjs tests/integration/run-local.ts

# 5. stop the stack when done:
npx supabase stop            # local; destroys containers, keeps volumes
npx supabase stop --no-backup   # removes local volume state quietly
```

Both confirmation flags are transient shell state — nothing persistently
authorizes a future run, and no secret is ever written to disk by this suite.

## Scenario matrix implemented in `run-local.ts`

Every scenario uses synthetic accounts (fresh signup ids, non-sensitive
synthetic document bytes) and real **supabase-js** clients (never bypassing
RLS except for explicitly service-role-keyed steps).

- **Authentication**
  - real signup creates accounts and `profiles` rows through the `0001` auth trigger;
  - signup meta `provider` yields a provider profile (level-1 role hint honored for
    non-admin roles);
  - signup meta `admin` is rejected as admin (`0003`, signals default
    "consumer" instead);
  - invalid key fails closed.
- **Provider applications (RPCs `0007`)**
  - draft creation, refusal to submit without evidence, submission with
    identity evidence, JWT-identity ownership, cross-applicant reads/writes,
    self-approval, non-admin review attempts, all with admin matrix honoured,
    reason requirements for needs-info/rejected/suspended, verification
    side-effects, application lock after verification, direct UPDATE
    permission refusal (0007 revoke), audit consistency (row count, reviewer
    uid, statuses mentioned in the audit trail). The administrator role is
    granted solely through the `0003 grant_role()` function executed by a
    service-keyed client — signup is never trusted to self-assign it — and
    every administrator-led check is skipped (never passed) when the service
    key is absent.
- **Storage (bucket `provider-applications`)**
  - anonymous list/upload refusal;
  - owner-segment upload only under `provider-applications/{uid}/{appId}/{docType}/{file}`;
  - cross-applicant upload/list denial;
  - allowed and disallowed MIME types (JPG/PNG/WEBP/PDF vs text/plain/zip);
  - size limits: `at-limit.png` exactly 8 MiB accepted, `over-limit.png`
    8 MiB + 1 byte refused by the **real Storage API**;
  - signed-URL issue for owner/admin + denial of cross-applicant issuance.
- **Content-type / byte mismatch** — **recorded, not asserted.** The bucket
  allowlist governs the declared `Content-Type` header of the request, not the
  file contents. The runner observes and explains the effect; it does not
  claim content inspection. See `0008` for an honest statement of this
  limitation.

## Cleanup — what is deleted and what is not

`tearDown()` deletes, in scope:

1. exactly the storage paths the run recorded as successfully uploaded
   (tracked per attempt, including any object an unexpected policy defeat
   produced) — never wildcards, never paths that were refused;
2. the synthetic auth user accounts (`auth.admin.deleteUser`), which cascade:
   profiles (0001 FK cascade) → applications (`0005` FK cascade) → audit rows
   (`0006` FK cascade) via `provider_applications(user_id)` and
   `provider_application_audit(application_id)`.

Every per-item cleanup result is checked; the run reports cleanup failures
instead of asserting an unconditional success. Nothing is truncated, no other
tables are touched, and no other bucket or existing user is selected.
Service-role use is confined to setup promotion (`grant_role`, the only
supported path per `0003`) and teardown cleanup. A run may be cleanly aborted
mid-flow; the `RUNNER WARNING` path still runs `tearDown()` on that
synthetic set (only those ids and only this run's uploaded paths).

If `SUPABASE_SERVICE_ROLE_KEY` is absent, cleanup explicitly SKIPs (rather
than forging privileged deletes via some other path) and the synthetic
records remain in the disposable local database — acceptable: the stack is
disposable outright.

## Secrets discipline

- Keys reach the process only through environment variables, copied from
  `npx supabase status` output.
- The runner never prints them: all logging passes through
  `makeMaskingLogger([anonKey, serviceKey])`, and anything that looks like a
  bearer token or `sb_secret_*` is masked before emission.
- Nothing in this suite writes env files; `.env*` is already gitignored, and
  the CI/test path (`npm test`) has no network participation.

## Running with the local stack via `run-local.ts`

See **Procedure** above. Ultimate truth: if any safeguard fails, the runner
exits immediately with a "REFUSED" message and performs no network I/O at
all.
