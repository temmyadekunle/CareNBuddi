# CareNBuddi — Storage Isolation Report

**Scope:** local data isolation and sign-out behaviour only.
**Status:** implemented and tested locally. **Not deployed. No Supabase configured. No migrations run.**
**Built on:** `CARENBUDDI_TECHNICAL_AUDIT.md`, `CARENBUDDI_SECURITY_REMEDIATION_PLAN.md`, and the authentication-hardening change set.

> **This is not a security guarantee.** Namespacing stops the app from *handing* one person's records to another on a shared device. It does not encrypt anything, and anyone with devtools or filesystem access can still read every key. Real protection requires server-side authorisation, which is P0 work in the remediation plan and has not been done.

---

## 1. Files changed

### New

| File | Purpose |
|---|---|
| `lib/storage-scope.ts` | Principal resolution, key namespacing, legacy quarantine, explicit recovery. |
| `lib/session.ts` | The single `endSession()` operation used by every sign-out path. |
| `tests/storage-isolation.test.ts` | 21 unit tests over the storage helpers. |
| `e2e/storage-isolation.mjs` | 27 browser checks against the running app. |

### Modified

| File | Change |
|---|---|
| `lib/storage.ts` | Every read/write of a private collection routed through `resolve()`. **Module cache re-keyed to the scoped key** — keyed by the logical key it would have served one account's data to the next. `notify` exported so sign-out can invalidate in-memory state. |
| `app/(app)/profile/page.tsx` | Sign-out calls `endSession()`. Removed a leftover `bisect=1` debug short-circuit. Confirmation copy and button label corrected (the old text said records "stay on this device", which was false). |
| `components/profile-settings.tsx` | Sign-out calls `endSession()`. |
| `app/(app)/account/page.tsx` | Sign-out calls `endSession()`. |
| `lib/supabase/cloud.tsx` | Cloud sign-out calls `endSession()` after `auth.signOut()`. |
| `lib/provider-practice.ts` | Raw `localStorage` calls now resolve through the scope layer. |
| `app/(app)/support/page.tsx` | `sessionStorage` active-thread key now scoped per principal. |
| `e2e/provider-journey.mjs` | Four assertions read the legacy unscoped key; replaced with a `readPrivate()` helper that resolves the same namespace the app uses. |

**Not changed:** provider-workspace access rules, booking policies, provider verification, any route or component design.

---

## 2. Storage keys inventoried

**IndexedDB: not used anywhere.** No cookies written by application code. The only persistent stores are `localStorage` and one `sessionStorage` key.

### Class A — sensitive health or identity information (namespaced)

| Key | Contents | Why sensitive |
|---|---|---|
| `healthlink:records` | Medical records: title, provider, summary | Clinical |
| `healthlink:journal` | Mood, symptoms, vitals, free text | Clinical + mental health |
| `healthlink:menstrual-cycles` | Cycle history | Reproductive health |
| `healthlink:mood-entries` | Mood log | Mental health |
| `healthlink:symptom-entries` | Symptoms, severity, trends | Clinical |
| `healthlink:health-preferences` | Tracking preferences | Health |
| `healthlink:reminders` | Medication names, doses, times | Medication regimen |
| `healthlink:passport` | Health passport | Clinical |
| `healthlink:care-circle` | Contacts: names, relationships, phones | Third-party PII |
| `healthlink:profile-photos` | Base64 JPEG face images | Biometric |
| `healthlink:fitness-profile` | Fitness profile | Health |
| `healthlink:workouts` | Workout history | Health |
| `healthlink:weigh-ins` | Weight measurements | Health |
| `healthlink:exercise-reminder` | Exercise config | Health |
| `healthlink:bookings` | Patient name, phone, reason for visit | PHI + PII |
| `healthlink:provider-applications` | Registration number, licence, **NIN**, documents | Identity + credentials |
| `healthlink:auth-pending` | Email awaiting confirmation | PII |
| `healthlink:support-conversations` | Threads: name, email, subject | PII + health topic |
| `healthlink:support-messages` | Message bodies | Free-text health content |
| `healthlink:support-tickets` | Tickets with contact details | PII |
| `healthlink:worker-log` | Screening type, counts, referrals | Aggregate health data |
| `healthlink:practice-settings` | Availability windows, fees, locations | Provider's own |
| `healthlink:support-active` *(sessionStorage)* | Open thread id | User-specific |

### Class B — user-specific, not health information

| Key | Decision |
|---|---|
| `healthlink:provider-requests` | **Left device-scoped.** Facility applications the staff review screens read. Namespacing would leave those screens empty, since staff review has no server. Holds contact details — a recorded residual risk. |
| `healthlink:reports` | **Left device-scoped.** Same reasoning: read by staff moderation. |
| `healthlink:users` | **Left device-scoped.** The device's account registry. `AppGuard` resolves the session against it and registration detects duplicate emails, so it must be visible device-wide. Holds names, emails, phones. |

### Class C — non-sensitive preferences (device-scoped, preserved)

`healthlink:theme` · `healthlink:prefs-units` · `healthlink:prefs-notifications` · `healthlink:onboarded` · `healthlink:guide-events` (never transmitted) · `healthlink:geocode-cache` · `healthlink:worker-online` · `healthlink:health-days` · `healthlink:providers` · `healthlink:topics` · `healthlink:session` · `healthlink:synced-at:*`

---

## 3. Migration decisions

### Legacy data was quarantined, not migrated

The old keys have **no recorded owner**. Nobody can say whose journal or cycle history `healthlink:records` held.

Copying them into whichever account signs in next would hand one person's health records to another — the exact failure this work exists to prevent — and it would do so invisibly, to whoever happened to open the app first. So legacy data is **moved to `healthlink:quarantine:<collection>`, which no application screen reads.**

| Requirement | How it is met |
|---|---|
| Not attributed to the first new user | Never copied into any user namespace |
| Not deleted before assessing | Preserved byte-for-byte under quarantine |
| Not exposed to guests | Quarantine is outside the guest and user namespaces; reads are scoped, so no screen resolves it |
| Quarantine when ownership is unknowable | That is the implemented path |
| Avoid logging health data | The migration moves raw strings between keys. Nothing is logged, and no identifiers are printed. |
| Safe to retry | Idempotent: a flag stops repeat runs, and a key already in quarantine is never overwritten |

### Legacy data that cannot be safely migrated

**Everything that existed before this change.** For any device with prior use, records written under the flat keys are now in quarantine and invisible in-app. This is a deliberate, user-visible regression: those records appear to have vanished from the app.

### Recovery

Recovery is **never automatic**. `recoverQuarantinedFor()` exists but is called from nowhere; attributing old records to an account is the owner's decision, not the software's.

Documented console procedure — on the device, signed in as the rightful owner:

```js
// Chrome DevTools / Safari Web Inspector / chrome://inspect on Android
const s = JSON.parse(localStorage.getItem("healthlink:session"));
const ns = `healthlink:u:${encodeURIComponent(s.userId)}:`;
for (const name of ["records","journal","menstrual-cycles","mood-entries",
                    "symptom-entries","reminders","passport","care-circle",
                    "bookings","profile-photos","support-messages"]) {
  const from = `healthlink:quarantine:${name}`;
  const raw = localStorage.getItem(from);
  if (raw === null) continue;
  if (localStorage.getItem(ns + name) !== null) continue;   // never clobber
  localStorage.setItem(ns + name, raw);
  console.log("recovered", name);
}
location.reload();
```

**Whether to ship an in-app "these are my records, claim them" flow is a product decision and was not taken here.** It needs a confirmation step and clear wording, because the app genuinely cannot prove who wrote them.

---

## 4. Sign-out behaviour

`endSession(reason)` in `lib/session.ts` is now the only sign-out path. It:

1. Resolves the principal **before** clearing the session.
2. Deletes every `healthlink:u:<userId>:*` / `healthlink:guest:<id>:*` key.
3. Removes `healthlink:session` **last**, because while it exists `resolve()` would keep reading the namespace being emptied.
4. Clears the guest namespace and rotates the guest id, so the next visitor starts empty.
5. Notifies subscribers so components holding state stop rendering removed records.
6. **Preserves** Class C preferences and the account registry.

It never calls `localStorage.clear()` — a unit test asserts this by replacing `clear` with an instrumented stub.

**Client-side cleanup vs authentication.** `endSession()` removes data from the browser. It is *not* sign-out as an authentication control: with no authentication service there is no token to revoke and no server state to invalidate. Anyone who previously read the data with devtools still hold their own copy.

**Browser back navigation** shows a screen with no data, because the underlying keys are gone. It cannot restore records. A `pageshow`/`popstate` handler was considered and rejected — with no private data left to leak, it would add complexity for no security gain.

---

## 5. Tests executed and results

### Unit — `npm test`

**125 passed, 0 failed** (was 104).

New: `tests/storage-isolation.test.ts`, 21 tests covering classification, guest/user separation, account switching, sign-out, preference survival, quarantine, malformed ownership, migration idempotency, explicit recovery, cache isolation between principals.

### End-to-end (all against a local `wrangler dev` build)

| Suite | Result |
|---|---|
| `e2e/storage-isolation.mjs` | **27 passed, 0 failed** |
| `e2e/provider-journey.mjs` | **49 passed, 0 failed** |
| `e2e/provider-workspace.mjs` | **19 passed, 0 failed** |
| `e2e/auth-hardening.mjs` | **24 passed, 0 failed** |
| `e2e/back-arrows.mjs` | **18 passed, 0 failed** |

### Build and lint

- `npm run build` — **Compiled successfully.** Type check clean, 0 TypeScript errors.
- `npm run lint` — **2 errors, both pre-existing** (`app/(app)/support/page.tsx:30`, `app/auth/verify/page.tsx:58`, setState-in-effect). `verify` is untouched by this task; `support` changed only by the two-line storage-scope edit. **0 errors in any file I created or changed.**

### Failures encountered and resolved — reported honestly

| Failure | Cause | Resolution |
|---|---|---|
| `a fabricated session cannot open /provider` | **Real bug I introduced.** `/provider/` with a trailing slash missed `STAFF_EXACT`, letting a guest through. | Added trailing-slash normalisation to `lib/auth-guard.ts`. |
| `path matching is a segment match, not a raw prefix` | **My test was wrong.** `matchesPath` is containment; `/provider` exactness comes from `STAFF_EXACT`. | Rewrote the test to assert the actual contract. |
| `a malformed userId is not used to build a namespace` | **My test was wrong.** The id *was* correctly percent-encoded; the encoded form still contains literal dots. | Tightened the assertion to check separators are encoded. |
| 2 provider-workspace failures | **My classification was wrong.** I had namespaced `provider-requests`, which staff review depends on. | Removed both from the private set; documented as residual risk. |
| 4 provider-journey failures | Tests read the legacy unscoped key. App behaviour was correct. | Added a `readPrivate()` helper so tests resolve the same namespace as the app. |

**No failures remain.** Two were genuine bugs in my own work and are fixed; three were incorrect tests and were corrected rather than worked around.

---

## 6. Remaining limitations

1. **No encryption.** Everything is plaintext JSON. Namespacing is separation, not secrecy.
2. **Devtools and file access defeat it.** A person with the device can read every key. Stated plainly because it would be easy to overstate what this achieves.
3. **The session userId is still attacker-controlled.** Editing `healthlink:session` to name another user yields that user's namespace — data they could read in the inspector anyway. The app no longer hands it over; it does not prevent it.
4. **The account registry holds PII device-wide.** `healthlink:users` is unavoidable until accounts live on a server.
5. **`provider-requests` and `reports` hold contact PII device-wide.** Needed for staff review, which has no backend.
6. **Guest data is not encrypted and not attributed.** A guest id is a random handle, not an identity.
7. **The quarantine is unrecoverable in-app** and only documented in this report.
8. **Cloud sync still writes to flat `healthlink:*` keys.** `lib/supabase/sync.ts` reads via `readLocal`, which now resolves to the scoped key, so its behaviour follows — but it has not been exercised against a live Supabase project.
9. **Multi-tab** is handled by existing `storage` events; sign-out propagates, but not explicitly tested.

---

## 7. Manual verification on a real Android device

Playwright is not a phone. These steps assume a debug build via `chrome://inspect` or `build-apk.ps1`.

**A. Sign-out clears records**
1. Install the build. Register a local profile. Add: one medical record, one mood entry, one cycle entry.
2. Set theme to dark and language to Yoruba.
3. Profile → **Log Out** → confirm.
4. Confirm you are returned to sign-in and the "secure sign-in is unavailable" notice is shown.
5. `chrome://inspect` → inspect → Console. Run:
   `Object.keys(localStorage).filter(k => k.startsWith("healthlink:u:"))`
   **Expect `[]`.**
6. Run `localStorage.getItem("healthlink:theme")`. **Expect `"dark"` — the preference must survive.**
7. Reopen the app. Confirm the home screen loads and no previous record appears.

**B. A second person sees nothing**
1. On the same device, without registering, browse as a guest: home, Find Care, emergency.
2. Open `/records`. **Expect the sign-in gate, never a record.**
3. Console: `localStorage.getItem("healthlink:quarantine:records")`.
   If non-null, confirm it is **not** displayed anywhere in the app.

**C. Two accounts do not mix**
1. Register Alice. Add a distinctive record, e.g. title `ZZZ-MARKER`.
2. Log out. Register Bob.
3. Open `/records`. **Expect no `ZZZ-MARKER`.**
4. Alice's data should still exist under `healthlink:u:<alice-id>:records` for recovery, but be unreachable while Bob is signed in.

**D. Guest after sign-out**
1. Sign out. Browse as a guest. Confirm the home screen works and nothing private is reachable.
2. Sign out again if possible, and confirm the guest id rotated.

**E. Provider workspace unchanged**
1. Sign in as a provider and open the workspace.
2. Confirm all seven sections render and availability still reads "Hours not set".

**F. Data safety**
1. Before uninstalling, check whether you have records you care about — anything pre-existing is now in quarantine and will be lost on uninstall.
2. Do not clear app data while testing; it is irreversible for quarantined records.

---

## 8. What this task did not do

- No Supabase configuration or enablement.
- No database migrations.
- No deployment, commit or push.
- No change to the provider-workspace permission model, booking policies, or provider verification.
- No encryption, and no claim that local storage is secure against device access.

---

*Implemented and verified locally. Not deployed. No secrets or patient data appear in this document.*