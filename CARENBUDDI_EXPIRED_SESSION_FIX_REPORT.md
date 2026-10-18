# CareNBuddi — Expired Session Cleanup Fix

**Scope:** the `cloud.tsx` signed-out handling identified in `CARENBUDDI_BACKEND_SECURITY_READINESS.md` finding B-9.
**Status:** implemented and tested locally. **Not deployed. Supabase not configured. No migrations run.**
**Authentication remains disabled** — `.env.local` is absent and `isCloudEnabled` is `false`.

> Local cleanup is data minimisation, not authentication security. Removing records from a browser changes nothing about who could already read them.

---

## 1. What was wrong

`lib/supabase/cloud.tsx`, `onAuthStateChange` — when the SDK delivered a null session:

```ts
if (!next) {
  const session_ = readLocal(KEYS.session);
  writeLocal(KEYS.session, { userId: null, lang: session_?.lang ?? "en" });
  setSyncState("idle");
  setLastSyncedAt(null);
  return;
}
```

The session **pointer** was cleared. The session **data** — `healthlink:u:<userId>:*` — was not. An expired or remotely revoked session therefore left medical records, cycle history, journal entries, bookings and support transcripts on the device. Nothing displayed them, because the gate closed, but they persisted for whoever next opened the app.

Investigating this surfaced **two further defects in my own earlier work**, both of which would have made a partial fix ineffective:

| # | Defect | Effect |
|---|---|---|
| **B-9a** | `endSession()` resolved the principal from `healthlink:session`. By the time the auth event arrives, that pointer no longer names the user — so a naive fix would have resolved to the **guest** and purged the guest namespace instead of the user's data. | Cleanup silently does the wrong thing |
| **B-9b** | `endSession()` called `keysForPrincipal()` **after** `purgePrincipal()`. The list was always empty, so subscribers were never notified. | Stale records stayed in memory |
| **B-9c** | The module cache in `lib/storage.ts` is keyed by scoped key, and `refreshLocal()` resolves via the *current* principal. After sign-out that is the guest. | `useSyncExternalStore` kept serving the purged records from memory |

---

## 2. Files changed

| File | Change |
|---|---|
| `lib/storage-scope.ts` | Added `privateKeys()` and `principalForUser(userId)` — lets cleanup act on a known owner when the session has already been torn down. |
| `lib/storage.ts` | Added `dropCacheForPrincipal(principal)` — evicts in-memory copies by the principal it is given, not by whatever the session pointer says now. |
| `lib/session.ts` | Split into `endSessionFor(principal, reason)` + `endSession(reason)` + `endUserSession(userId, reason)`. Fixed the notify-after-purge ordering. Added a re-entrancy guard. The session pointer is now removed **only if it still names this principal**. `SessionEndResult` reports `userId` and `invalidated`. |
| `lib/supabase/cloud.tsx` | Tracks the cloud user id in a closure variable captured **before** the event. Purges only on `SIGNED_OUT`/`USER_SIGNED_OUT`. |
| `tests/expired-session.test.ts` *(new)* | 16 unit tests. |
| `e2e/expired-session.mjs` *(new)* | 21 browser checks. |

---

## 3. How the fix works

### 3.1 Cleanup targets the owner, not the current pointer

```ts
let cloudUserId: string | null = null;   // set when a session is adopted

onAuthStateChange((event, session) => {
  if (!session?.user) {
    if (REVOKING_EVENTS.has(event) && cloudUserId) {
      endUserSession(cloudUserId, "expired");   // acts on the remembered owner
    } else {
      /* keep the data; only drop the pointer */
    }
    cloudUserId = null;
    return;
  }
  cloudUserId = session.user.id;
  ...
});
```

`endUserSession` builds `principalForUser(userId)` and calls `endSessionFor`, which purges that namespace regardless of what `healthlink:session` currently says.

### 3.2 Only a confirmed revocation purges data

```ts
const REVOKING_EVENTS = new Set(["SIGNED_OUT", "USER_SIGNED_OUT"]);
```

A transient network failure does **not** raise `SIGNED_OUT`, so a flaky connection cannot delete a valid user's records.

`INITIAL_SESSION` with a null session is deliberately excluded. That event fires on every page load for anyone using a local profile rather than a cloud account — purging on it would delete their data on first refresh.

### 3.3 The session pointer is removed last, and only if it is still ours

```ts
const current = raw ? JSON.parse(raw).userId : null;
if (principal.kind === "user" && current === principal.userId) {
  localStorage.removeItem("healthlink:session");
}
```

A late duplicate event for an expired account cannot tear down a **different** account that has since signed in.

### 3.4 Repeat and concurrent events

A module-level `cleaning` flag makes `endSessionFor` re-entrant-safe: a second overlapping call returns an empty result rather than starting a purge against a principal that is no longer current. Calling it twice sequentially is also safe — the second finds nothing.

### 3.5 In-memory state is invalidated

`dropCacheForPrincipal()` evicts the cache entries keyed to that principal and notifies subscribers, so a component holding stale state stops rendering it immediately rather than at its next unrelated write.

---

## 4. Tests executed and results

### Unit — `npm test`

**141 passed, 0 failed** (was 125).

New: `tests/expired-session.test.ts`, 16 tests.

### End-to-end

| Suite | Result |
|---|---|
| `e2e/expired-session.mjs` *(new)* | **21 passed, 0 failed** |
| `e2e/storage-isolation.mjs` | **27 passed, 0 failed** |
| `e2e/auth-hardening.mjs` | **24 passed, 0 failed** |
| `e2e/provider-journey.mjs` | **49 passed, 0 failed** |
| `e2e/provider-workspace.mjs` | **19 passed, 0 failed** |
| `e2e/back-arrows.mjs` | **18 passed, 0 failed** |

### Build, types, lint

- `npm run build` — Compiled successfully. 0 TypeScript errors.
- `npm run lint` on every file touched — **0 errors, 0 warnings**.

### Coverage against the requested tests

| Requirement | Test | Result |
|---|---|---|
| Expired cleanup removes the previous principal's private state | "expired cleanup purges the previous principal, not the guest" | pass |
| Session pointer removed in the correct order | "the session pointer is removed, and preferences are not" | pass |
| Theme and language survive | same test + "the account registry survives expiry" | pass |
| Another user's namespace not purged | "expiring one user does not touch another user's data"; "expiry does not remove a session belonging to a different account" | pass |
| Repeated signed-out events safe | "repeated signed-out events are safe"; "a repeat event after sign-in cannot delete the new session's data" | pass |
| Temporary network failure does not erase records | "a temporary network failure does not erase a valid user's records"; "an INITIAL_SESSION with nobody signed in is not a revocation" | pass |
| Existing suites still pass | storage-isolation, auth-hardening, provider-journey, provider-workspace, back-arrows | pass |

### Failures encountered, reported honestly

| Failure | Cause | Resolution |
|---|---|---|
| Syntax error in the new test file | Two typos I introduced: an unclosed `assert.equal(` and a nonsense ternary assertion | Fixed the typos |
| "endSession with no session is a harmless no-op" | **My test was wrong.** With no user session the principal resolves to *guest*, and signing out purges the guest namespace — documented behaviour | Rewrote the test to assert what actually happens |
| "no user namespace survives" (E2E §2) | **My test was wrong.** I removed Alice's session pointer without any revocation event, so correctly nothing purged her. Purging on a guess is exactly the failure mode this work avoids | Changed the assertion to verify Bob's sign-out purges only Bob |
| `JSON.parse(after.session!)` | Non-null assertion is illegal inside a call expression in JS | Removed |

**No failures remain.** Three were mistakes in my own tests; none indicated a product defect.

---

## 5. Remaining risks

1. **This is not authentication.** With no Supabase configured the listener never fires. The fix is currently **only exercised through the shared cleanup operation**, not through a real expiry event. It must be re-tested against a configured test project.
2. **Records already leaked are not recovered.** Devices that experienced an expiry before this fix still hold the data. Nothing here cleans historical residue.
3. **A session that expires while the app is closed** is only noticed on next load. Records sit on disk until then.
4. **Cloud sign-in still does not purge the previous account's keys** when switching accounts. That is deliberate — purging would destroy a user's data when they log back in — but it is wrong on a shared device and needs a product decision.
5. **`refreshLocal()` still resolves via the current principal.** Correct for its existing callers; it is simply not the right tool for post-sign-out cleanup, which is why `dropCacheForPrincipal` exists.
6. **Cross-tab propagation is untested for expiry.** Existing `storage` events should cover it; not verified.
7. **No idle timeout for staff roles** — still outstanding from the remediation plan.
8. **Client cleanup does not reach a backup or a synced copy.** `healthlink:synced-at:*` markers and anything already pushed to Supabase are untouched by design.
9. **B-1 (signup role escalation), B-2, B-3, B-5, B-7 remain open** and are the real blockers to enabling cloud.

---

## 6. Required manual checks

Playwright is not a phone or a real auth service. Do these on a real device via `chrome://inspect`, and — for items 1–2 — against a **disposable Supabase project**, never production.

**A. Expiry actually purges (requires a configured test project)**
1. Configure the test project, enable cloud, register a test account.
2. Add a medical record and a cycle entry. Note them in `chrome://inspect`.
3. Revoke the session from Supabase (Admin → Authentication → sign out all), or wait for token expiry.
4. Reload the app. Confirm the gate appears.
5. Console: `Object.keys(localStorage).filter(k => k.startsWith("healthlink:u:"))`
   **Expect `[]`.**
6. Console: `localStorage.getItem("healthlink:theme")` — **must still be your theme.**
7. **Critical:** put the device offline, reload, confirm records are **still present** and the app does not purge on a network error.

**B. Repeat and cross-account**
8. Revoke, reload, then reload again. Nothing should throw; preferences must be unchanged.
9. With account A revoked, sign in as B. Confirm B's data appears and A's keys are gone — and that a *late* duplicate event for A does not remove B's session.

**C. Guest isolation unchanged**
10. Sign out, browse as a guest: home, Find Care, emergency all work.
11. Confirm `/records` still shows the sign-in gate, never a record.

**D. Real device**
12. Repeat the manual steps in `CARENBUDDI_STORAGE_ISOLATION_REPORT.md` §7 on Android, then add: switch accounts on the same device and confirm no bleed.

**E. Before deploying**
13. Confirm `.env.local` is **still absent** and no `NEXT_PUBLIC_SUPABASE_*` is set. This change must not enable cloud.

---

## 7. What was not done

- No Supabase configuration or enablement; `.env.local` still absent.
- No database migrations.
- No deployment, commit or push.
- No `localStorage.clear()`.
- No changes to the provider-workspace access model, booking policies or provider verification.
- No health records, credentials or identifiers logged.

---

*Implemented and verified locally. Not deployed. Cloud authentication remains disabled.*