# CareNBuddi — Technical Audit Report

**Audit type:** READ-ONLY. No files were modified. No migrations were run. No production data was altered.
**Scope:** `carenbuddi` web application, Cloudflare Worker, Supabase integration logic, Android packaging, offline layer, accessibility, test suite.
**Version audited:** `package.json` declares `0.1.0`; `android/app/build.gradle` declares `versionName "1.0.0"`. **These disagree** (Finding A-1). This report audits what is in the repository at commit `ca55822`.

---

## Classification key

| Code | Meaning |
|---|---|
| **P0** | Critical security or data-integrity risk. Ship-stopping. |
| **P1** | Essential functionality or high-priority security issue. |
| **P2** | Important usability or operational issue. |
| **P3** | Enhancement or future feature. |

**Confidence** is marked on every finding:
- **CONFIRMED** — read directly from source, or observed on the deployed build.
- **REQUIRES TESTING** — plausible from source, but not reproduced at runtime.
- **ASSUMPTION** — depends on a fact not verifiable from this repository.

---

## ⚠️ The single most important fact in this report

**The deployed application has no server-side authentication and no cloud backend.**

This was verified against the live production bundle, not assumed:

- `lib/supabase/client.ts:12` — `export const isCloudEnabled = Boolean(url && anonKey);`
- Both values come from `NEXT_PUBLIC_SUPABASE_*` (`lib/supabase/client.ts:3-4`).
- The live chunk `/_next/static/chunks/2za3y1vrn4bre.js` contains **0** matches for `[A-Za-z0-9-]{6,}\.supabase\.co`. No project URL is baked into the build.
- Therefore `isCloudEnabled === false`, `getSupabase()` returns `null`, and every code path gated on `cloud.enabled` is inert.

**Consequence:** every "authenticated" action in production is a client-side `localStorage` write, enforced by `components/app-guard.tsx` — which runs in the browser and can be bypassed by anyone with devtools or a modified client. **All findings in Sections B, C, E and G are graded on the assumption that this remains true.** If Supabase is enabled later without fixing the RLS policies first, Section D's findings become live.

---

# 1. Application architecture

## 1.1 Framework and stack — CONFIRMED

| Layer | Technology | Evidence |
|---|---|---|
| Framework | Next.js `^16.3.8`, App Router | `package.json:19` |
| UI runtime | React `19.2.8` / `react-dom 19.2.8` | `package.json:20-21` |
| Output mode | **Static export** (`output: "export"`) | `next.config.ts:4` |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`) + CSS custom properties | `package.json:25,32` |
| TypeScript | `^5` | `package.json:33` |
| Hosting | Cloudflare Worker (static assets + one API route) | `wrangler.jsonc` |
| Data layer | `localStorage` (Supabase optional, disabled) | `lib/storage.ts` |
| Charts | `recharts` declared — **imported nowhere** | `package.json:22` |
| Maps | `leaflet` + `@types/leaflet` | `package.json:18,26` |
| QR | `qrcode.react` | `package.json:19` |
| Supabase client | `@supabase/supabase-js ^2.117.2` | `package.json:17` |
| Android | **Hand-rolled `android.webkit` WebView — no Capacitor/Cordova/TWA** | `android/app/build.gradle`, `MainActivity.java` |

**Dependency risk:** `next: ^16.3.8`, `eslint-config-next: ^16.3.8`, `@tailwindcss/postcss: ^4`, `tailwindcss: ^4` are caret ranges. There is **no lockfile committed** — I found no `package-lock.json`, `pnpm-lock.yaml` or `yarn.lock`. Builds are therefore **not reproducible** and can silently pick up a breaking minor on any fresh install. — **P2, CONFIRMED**

## 1.2 Routing — CONFIRMED

Three route groups plus one bare segment:

| Group | Path prefix | Layout | Guard |
|---|---|---|---|
| `app/(app)/` | many | `app/(app)/layout.tsx` — `Nav` + `BottomNav` | `AppGuard` (`components/app-guard.tsx`) |
| `app/(auth)/`… actually bare `app/auth/` | `/auth/*` | `app/auth/layout.tsx` — own header, no nav | none |
| `app/(onboarding)/` | `/onboarding` | `app/(onboarding)/onboarding/layout.tsx` | none |
| `app/(site)/` | `/`, `/privacy`, `/terms`, `/careers` | marketing chrome | none |

~40 routes. Note `app/auth/` is a **plain segment, not a group**, so it also catches any future `/auth/*` route.

**Legacy branding (P3, CONFIRMED):** storage keys, cache name and API surface still use the `healthlink` prefix (`lib/storage.ts:17-43`, `public/sw.js:1`). The OAuth redirect origin is not healthlink-branded. This is cosmetic but confusing during an incident and will complicate a future rebrand/migration.

## 1.3 Entry points — CONFIRMED

| Entry | File | Notes |
|---|---|---|
| Root layout | `app/layout.tsx` | `<html lang="en">` **hardcoded** (Finding J-10) |
| App shell | `app/(app)/layout.tsx` | Nav / main / BottomNav |
| Auth shell | `app/auth/layout.tsx` | Splash + own header |
| Onboarding shell | `app/(onboarding)/onboarding/layout.tsx` | Splash, no nav |
| Cloud provider | `lib/supabase/cloud.tsx` | wraps all three app shells |
| Toast provider | `components/app-ui.tsx:486` | |
| PWA registration | `components/pwa-register.tsx:6-10` | mounted in `app/layout.tsx:35` |
| Worker entry | `worker/index.ts` | single route `POST /api/health-guide` |
| Android entry | `android/app/src/main/java/ng/carenbuddi/app/MainActivity.java:103` | `loadUrl(APP_ORIGIN + "/app")` |

## 1.4 Build commands — CONFIRMED

| Command | Effect | Notes |
|---|---|---|
| `npm run dev` | `next dev` | |
| `npm run build` | `next build && node scripts/fix-rsc-segments.mjs` | post-build flattens RSC payload filenames |
| `npm run lint` | `eslint` | 3 pre-existing errors remain (Finding K-2) |
| `npm test` | `node --import ./tests/register.mjs --test` | 76 tests, all pass |
| `npx wrangler deploy` | deploys Worker + static assets | **not** an npm script |
| `./build-apk.ps1` | Android release+debug APK | **not** an npm script; Windows-only |

**Build fragility (P2, CONFIRMED):** `next build` depends on `fonts.googleapis.com` for Geist via `next/font/google` (`app/layout.tsx`). In an air-gapped CI this fails. There is no offline font fallback committed.

## 1.5 Android packaging technology — CONFIRMED

**Not** Capacitor, Cordova, TWA or Bubblewrap — all verified absent. Instead a custom WebView:

- `android/app/build.gradle:14,27` — `applicationId ng.carenbuddi.app`, `compileSdk 34`, `minSdk 24`, `targetSdk 34`, Java 17.
- `android/app/build.gradle:59-61` — the **only** dependency is `androidx.webkit:webkit:1.11.0`.
- `MainActivity.java:42-43` — serves the entire `out/` export from `https://appassets.androidplatform.net/` via `WebViewAssetLoader`, so the APK works fully offline.
- `MainActivity.java:212-228` — **serves a no-op service worker string for `/sw.js`** inside the APK. All service-worker behaviour (§8) is therefore **PWA-only**.
- `android/app/src/main/AndroidManifest.xml:4-5` — permissions: `INTERNET`, `ACCESS_NETWORK_STATE` only. No `POST_NOTIFICATIONS` (Finding I-6).

## 1.6 Environment configuration — CONFIRMED

- `.env*` is gitignored, `!.env*.example` retained (`.gitignore`).
- `.env.local.example` declares `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. **Only placeholders — no committed secrets found.**
- AI key is a Wrangler secret (`npx wrangler secret put AI_API_KEY`), never in env. Correct separation.

---

# 2. Existing features and implementation status

Legend: **IMPLEMENTED** = works end-to-end · **PARTIAL** = works with a real limitation · **UI-ONLY** = interface exists, no real backend · **STUB** = renders, does nothing · **ABSENT** = not built

## 2.1 Patient features (Section F)

| Feature | Route | Status | Note |
|---|---|---|---|
| Healthcare discovery / Find Care | `/find-care`, `/find-care/[id]` | **IMPLEMENTED** | real filters, Leaflet map, distance; reads `seedProviders` (72 records) — synthetic catalog |
| Provider detail | `/find-care/[id]` | **IMPLEMENTED** | call/WhatsApp/book actions; services & descriptions are English-only (Finding J-2) |
| Appointment requests | booking sheet | **PARTIAL** | persists to `healthlink:bookings`; no server, no notification |
| Medical records | `/records` | **PARTIAL** | user-entered only; `MedicalRecord` has **no owner field** (Finding G-3) |
| Health Passport | `/passport` | **PARTIAL** | QR renders via `qrcode.react`; **no accessible alternative** (J-4e); QR payload contents not verified |
| Care Circle | `/care-circle` | **PARTIAL** | local only; stores third-party names, relations, phone numbers |
| Medication info | in `/reminders` | **PARTIAL** | reminders stored, **nothing ever fires** (I-6) |
| Wellness — mood/symptoms/cycle | `/health/diary/*` | **PARTIAL** | implemented + tested (`scripts/test-health-diary.mjs`); **excluded from sync** (H-4) |
| Exercise / weight | `/health/exercise` | **PARTIAL** | images real (8 SVG); **video directory is empty** — users see a developer message (I-4) |
| Emergency guidance | `/emergency`, `/explore` | **IMPLEMENTED** | real static numbers + geolocation; **no dispatch integration**, honestly labelled |
| AI Health Guide | Health Guide panel | **PARTIAL** | real Worker → Gemini; **blocked in the APK** by origin allow-list (I-1) |
| Support / chat | `/support` | **UI-ONLY** | local transcript only; no ticketing, no staff view |
| Health days | `/health-days` | **UI-ONLY** | static event list |
| Reports / feedback | report button | **PARTIAL** | stored locally; no staff triage in product |
| Community worker log | `/worker` | **UI-ONLY** | stores aggregate counts; **"Offline — changes queued" badge is false** (I-6) |

## 2.2 Provider and facility features (Section G)

| Feature | Route | Status | Note |
|---|---|---|---|
| Provider registration | `/provider/register` | **PARTIAL** | works; smart entry, upgrades, resume |
| Credential verification | `/provider/onboarding` | **STUB (critical)** | documents are **metadata only — never uploaded** (G-1) |
| Provider workspace | `/provider/*` (7 sections) | **IMPLEMENTED (client-side)** | access model enforced in `lib/provider-workspace.ts`; **RLS contradicts it** (D-2) |
| Dashboard | `/provider` | **PARTIAL** | counts derived from real bookings; zeros are honest |
| Patient Care | `/provider/patients` | **PARTIAL** | care-relationship access; shared records/messaging/referrals **labelled unavailable** |
| Practice management | `/provider/practice` | **IMPLEMENTED (local)** | availability is opt-in and never assumed |
| Rapid Response | `/provider/rapid-response` | **UI-ONLY (honest)** | says "Awaiting integration", "no responder has been alerted" |
| Community | `/provider/community` | **UI-ONLY (honest)** | refused until moderation exists |
| Facility registration | `ProviderRequest` + `/admin/providers` | **PARTIAL** | admin review is client-side only |
| Provider Profile | `/provider/profile` | **PARTIAL** | verification summary; **no NIN/documents exposed** |

## 2.3 Features that exist only as decoration — CONFIRMED

These are the highest-risk items in Section 2 because they look functional:

| # | Feature | File | Reality | Sev |
|---|---|---|---|---|
| 1 | Notification preferences | `components/profile-settings.tsx:39,182-207`; `app/(app)/profile/page.tsx:627-657` | 3 booleans stored, read back, **drive nothing**. No `Notification` API, no `PushManager`, no `POST_NOTIFICATIONS`. | **P1** |
| 2 | "Offline — changes queued" badge | `app/(app)/worker/page.tsx:87-94` | Tells a community health worker their field data is safely queued. **There is no queue.** Data is only in volatile `localStorage`. | **P0** (misrepresentation) |
| 3 | Red dot on the notifications bell | `components/nav.tsx:97-106` | Dot is shown whenever signed in — **not** driven by unread state. | **P2** |
| 4 | Exercise video | `components/exercise-media.tsx:56-60` | Directory empty; every load shows a developer instruction to the patient. | **P2** |
| 5 | Community worker badge "Online — synced" | `app/(app)/worker/page.tsx:86-95` | No sync is performed. | **P1** |

---

# 3. Confirmed defects

Defects read directly from source or reproduced at runtime.

## D-1 — Sign-in does not verify the password — **P0, CONFIRMED**

**`app/auth/sign-in/page.tsx:79-93`**

```ts
const signInOffline = (): boolean => {
  const key = email.trim().toLowerCase();
  const existing = users.find((u) => u.email.toLowerCase() === key);
  if (!existing) { /* error */ return false; }
  setSession((prev) => ({ ...prev, userId: existing.id }));   // ← password never read
  return true;
};
```

`cloudMode = isCloudEnabled` (line 50) is **false in production** (§ top of report), so this is the live sign-in path. The `password` field collected at line 151 is validated for length only, then **discarded**.

**Impact:** anyone who knows a registered email address can sign in as that account with any password. That account owns the full `localStorage` health record: journal, medical records, menstrual cycles, mood and symptom entries, medication reminders, care-circle contacts, profile photograph, support transcripts.

**Why this is P0 and not P3:** the app markets itself as holding personal health records, stores them unencrypted, and gates them behind a control that performs no authentication.

## D-2 — Registering with an existing email takes over that local account — **P0, CONFIRMED**

**`app/auth/sign-up/page.tsx:120-134`**

```ts
if (existing) {
  setUsers((prev) => prev.map((u) =>
    u.id === existing.id ? { ...u, phone: u.phone ?? (trimmedPhone || undefined) } : u));
  setSession((prev) => ({ ...prev, userId: existing.id }));
  return true;
}
```

Signing up with someone else's email silently **overwrites their phone number** and **sets the session to their account**, with no password check. Combined with D-1 this is a complete local account-takeover primitive. The password is not stored at all — the `User` type has no password field.

## D-3 — RLS privilege escalation: any user can self-promote to admin — **P0, CONFIRMED (schema-level)**

**`supabase/migrations/0001_init.sql:167-169`**

```sql
create policy profiles_update_own on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
```

The policy constrains the **row** but not the **columns**. `profiles.role` (`0001_init.sql:72`) is `text not null default 'consumer' check (role in ('consumer','provider','admin'))`. A signed-in consumer can run:

```sql
update public.profiles set role = 'admin' where id = auth.uid();
```

Both `using` and `with check` still pass — it is still their own row — and the check constraint allows `'admin'`.

I searched both migrations for any guard: the only triggers are `profiles_set_updated_at`, `health_documents_set_updated_at`, `on_auth_user_created`, and two `*_set_updated_at` in migration 2. **No trigger protects `role`, and there are no column-level `GRANT`/`REVOKE` statements.**

**Impact if Supabase is ever enabled:** one self-serve UPDATE makes `public.is_staff()` true, which unlocks every staff policy — see D-4. This is currently **latent** only because the app is deployed with cloud disabled.

## D-4 — RLS grants every provider read access to every patient's booking — **P0, CONFIRMED (schema-level)**

**`supabase/migrations/0001_init.sql:181-183`** and the `is_staff()` definition at **`0001_init.sql:~40-52`**

```sql
create policy bookings_select on public.bookings
  for select using (auth.uid() = user_id or public.is_staff());
```

`is_staff()` returns true for **any** profile whose `role in ('provider','admin')` — it does not scope to the provider's own bookings.

**Impact if enabled:** any provider can select every row of `bookings`, which contains patient **name, phone and a free-text reason-for-visit message** (PHI), across all providers.

**This directly contradicts the client-side model** implemented in `lib/provider-workspace.ts` (`careRelationships`, `canAccessCare`), which restricts a provider to patients connected to them by an appointment. The database is more permissive than the application.

Same unscoped-`is_staff()` pattern applies to: `provider_requests_select_staff` (195), `provider_requests_update_staff` (199), `reports_select_staff` (208), `reports_update_staff` (212), `emergency_requests_select` (0002:111), `emergency_requests_update_staff` (0002:115), `emergency_events_*` (0002:121-125), `provider_emergency_participation_write_staff` (0002:141).

**Positive:** `health_documents` is correctly strict — `documents_owner_all ... using (auth.uid() = user_id)` (0001:173-174). No exceptions.

## D-5 — Provider identity documents are never uploaded — **P0, CONFIRMED**

**`app/(app)/provider/onboarding/page.tsx:400-413`**

```tsx
onPick({ docType, fileName: file.name, sizeBytes: file.size,
         mimeType: file.type, addedAt: new Date().toISOString() });   // File discarded
```

The `File` reference is thrown away at line 404. Only name/size/MIME/timestamp reach `healthlink:provider-applications`. There is **no `FormData`, no upload endpoint, and no storage bucket anywhere in the application.**

The MIME allow-list (`ACCEPTED_MIME`, line 41) and 8 MB cap (`MAX_DOC_BYTES`, line 40) are enforced on the *metadata*, not the bytes — the file is never read.

**Impact:** a provider can complete "verification" and be shown as holding an ID and a licence that **were never transmitted**. A reviewer has nothing to verify. Any reviewer who trusts the UI is reviewing nothing. For a healthcare platform this is a regulatory and fraud exposure, not a UX bug.

**Mitigating (credit where due):** the provider Profile correctly never renders NIN values or document contents — only status badges (`app/(app)/provider/profile/page.tsx:107-124`), and this is regression-tested (`e2e/provider-workspace.mjs`, "profile never exposes identity documents or NIN").

## D-6 — Sign-out leaves all health data on the device — **P0, CONFIRMED**

There are **four** sign-out implementations and **none of them clear any data**:

| Location | Action |
|---|---|
| `lib/supabase/cloud.tsx:207-215` | `supabase.auth.signOut()`, `setUser(null)` — touches no `healthlink:*` key |
| `lib/supabase/cloud.tsx:146-147` | `writeLocal(KEYS.session, { userId: null, lang })` |
| `components/profile-settings.tsx:101-115` | session nulled, `router.push("/auth/sign-in")` |
| `app/(app)/profile/page.tsx:252-266` | duplicate of the above |

I searched `app/`, `components/`, `lib/` for `localStorage.clear`, `removeItem`, `clearLocal`, `eraseLocal`, `resetData` — **zero matches.**

**Impact:** after sign-out, all 37 `localStorage` keys remain, including menstrual cycle data, mood entries, medical records and the profile photograph. Combined with the "Continue as guest" link (`components/app-guard.tsx:130-131`), which bypasses the gate while every `useStoredCollection` hook keeps reading the same keys, **the next person to open the app on a shared or family Android device sees the previous user's health data.** Only `lib/profile-photo.ts:88-93` scopes reads by `userId`; every other collection is unscoped.

## D-7 — There is no account deletion, contradicting the published privacy policy — **P1, CONFIRMED**

Searched for `deleteAccount`, "Delete account", "erase", "close account" across `app/` — **zero matches.** `app/(app)/account/page.tsx` (the Account & Security screen) contains no deletion control.

`app/(site)/privacy/page.tsx:33` promises *"When you close your account, we delete or anonymise your information"* and `:36-37` promises a route to *"ask us to delete everything we hold about you"*. **Neither exists in-product.** Line 37 further admits the DPO contact "will be published … before a public launch", so the stated route is currently unavailable.

For a health platform this is a compliance exposure independent of the technical state.

## D-8 — Android back button does not close sheets, dialogs or wizard steps — **P1, CONFIRMED**

Across the entire codebase: **`popstate` 0 matches, `beforePopState` 0, `history.pushState` 0, `router.back()` 0.** All 24 router call sites use `router.push()`.

Nested surfaces that hold state in `useState` without changing the URL are therefore **not** dismissed by back:

| Surface | File | Back result |
|---|---|---|
| Bottom sheet | `components/app-ui.tsx:391-441` | Navigates the page behind it, or exits |
| Confirm dialog | `components/app-ui.tsx:443-480` | Same; also has **no Escape handler at all** |
| Provider onboarding (5 steps) | `app/(app)/provider/onboarding/page.tsx:86-88` | **Abandons the application mid-form — typed input lost** |
| Patient onboarding (3 steps) | `components/onboarding-flow.tsx:128` | Exits onboarding |

`MainActivity.java:169-176` uses the deprecated `onBackPressed()`; `AndroidManifest.xml` sets no `android:enableOnBackInvokedCallback`, so there is no predictive back.

**Testing gap that let this ship:** `e2e/back-arrows.mjs` tests back **links** only. It never dispatches `history.back()`. The E2E suite structurally cannot catch this class of bug.

## D-9 — AI Health Guide is non-functional in the Android app — **P1, CONFIRMED**

`worker/index.ts:33-38` hard-codes `ALLOWED_ORIGINS` to two production hosts plus two localhost ports and rejects others with `403 origin_not_allowed` (`:130-132`).

The APK serves the app from `https://appassets.androidplatform.net/` (`MainActivity.java:42-43`). That origin is **not** on the list, so every Health Guide request from the APK fails and the user sees *"The AI service had a problem."* (`components/health-guide.tsx:380-390`).

Secondary: the two hard-coded production origins mean any additional hostname (e.g. a custom domain on the Worker) is blocked too.

## D-10 — Sync stamps documents that were never sent — **P1, CONFIRMED**

**`lib/supabase/sync.ts:76, 84, 89`**

`pushDocuments` filters out rows whose `payload === null` (line 84) but then stamps `healthlink:synced-at:<key>` for **every** key in `docKeys` (line 89), including the skipped ones.

**Impact:** a key that was locally empty is marked as successfully synced. The first real write from another device can be silently discarded. Latent while cloud is disabled.

## D-11 — Sync uses whole-collection last-write-wins; no merge — **P1, CONFIRMED**

**`lib/supabase/sync.ts:103-121`**

```ts
if (remoteStamp > localStamp) writeLocal(row.doc_key, row.payload);   // whole-collection overwrite
```

There is **no merge strategy**. The entire local collection is replaced by the remote array. Two devices that each add one journal entry offline will lose one entry entirely.

The doc comment at `:98-102` claims this is safe *"so two devices editing different features never clobber each other"* — that is true only at **collection** granularity, not entry granularity. For a multi-device health journal this is a real data-loss path.

## D-12 — The most sensitive data is excluded from sync — **P1, CONFIRMED**

`lib/supabase/sync.ts:9-20` (`SYNCED_KEYS`) covers 10 of 22 `KEYS`. **Excluded:** `menstrualCycles`, `moodEntries`, `symptomEntries`, `healthPreferences`, `profilePhotos`, `users`, `providerApplications`, `providerRequests`, `support-*`, `practice-settings`.

Menstrual, mood and symptom data — the most sensitive categories in the product — is **device-local only** and is lost on device change, app-data clear, or APK uninstall, with no warning to the user.

## D-13 — Provider can open a patient record that is not in their own book of work (mitigated, but asymmetric) — **P2, CONFIRMED**

The **client-side** model is correct: `lib/provider-workspace.ts` `canAccessCare()` requires a non-cancelled booking naming both parties, and `careRelationships()` excludes `userId: null` (guest requests are not patients). 16 unit tests cover this.

However the **database** model (D-4) is unscoped. Until Supabase is enabled and corrected, the application is safer than its schema — which will not survive the switch.

## D-14 — Manifest scope excludes most routes — **P2, CONFIRMED**

`public/manifest.json:6` declares `"scope": "/app"`. Everything outside `/app` — `/auth/*`, `/onboarding`, `/provider/*`, `/find-care/[id]`, `/careers`, `/privacy`, `/terms` — is outside the declared scope, so installed-PWA standalone behaviour is inconsistent there.

Meanwhile `public/sw.js:9-26` precaches `/onboarding`, `/find-care`, `/emergency`, `/explore`, `/services` — all outside the scope. **Scope and precache list disagree.**

Also missing: `id` (repeat installs can lose storage identity), `shortcuts`, `appleWebApp` metadata, and `lang`.

## D-15 — External links navigate the Android app out of itself — **P2, CONFIRMED**

`MainActivity.java:113-115` — `shouldOverrideUrlLoading` returns `false` for `http`/`https`, so any external link (Play Store, a provider site, Supabase OAuth, Pexels) loads **in place**, losing the app shell. There is no allow-list against `APP_ORIGIN`.

## D-16 — External navigation requests can cross to the app — **P3, REQUIRES TESTING**

`MainActivity.java:67-68` sets `JavaScriptCanOpenWindowsAutomatically(true)` with `SupportMultipleWindows(false)`. `setAllowFileAccess` is not enabled and no `addJavascriptInterface` is used, so the exposure is limited. Not independently reproduced.

---

# 4. Potential security vulnerabilities

Distinguished from §3 because they are risks **not yet reproduced**.

## V-1 — Unauthenticated read of responder phone numbers — **P1, CONFIRMED (schema-level, latent)**

**`supabase/migrations/0002_rapid_response.sql:137-138`**

```sql
create policy participation_select_public on public.provider_emergency_participation
  for select using (true);
```

The table contains `display_name`, **`phone`**, `accepts_emergency_requests` and **`coverage_area`** for every participating provider. `using (true)` means anyone holding the **public anon key** — i.e. any visitor — can read all of it with no authentication.

Exposing responder phone numbers and coverage areas to anonymous callers is both a privacy exposure and a safety concern.

## V-2 — No at-rest encryption of any health data — **P1, CONFIRMED**

No `crypto.subtle`, no `CryptoKey`, no encrypted storage anywhere. All 22 PHI/PII-bearing `localStorage` keys are plaintext JSON, including:

| Category | Key |
|---|---|
| Biometric image data | `healthlink:profile-photos` (base64 JPEG) |
| Reproductive health | `healthlink:menstrual-cycles` |
| Mental health | `healthlink:mood-entries` |
| Clinical records | `healthlink:records`, `healthlink:journal` |
| Medication regimen | `healthlink:reminders` |
| Third-party PII | `healthlink:care-circle`, `healthlink:support-*` |

Readable by any script on the origin, and by anyone with filesystem/adb access to the WebView data directory (`MainActivity.java:59` explicitly enables `setDomStorageEnabled(true)`).

## V-3 — `AndroidManifest.xml:8` sets `allowBackup="true"` on a release-signed health app — **P1, CONFIRMED**

Combined with V-2, a device backup or cloud-backup transfer can copy unencrypted PHI off-device. `android:allowBackup="false"` (or a strict backup rules file) is standard for health apps.

## V-4 — Build script auto-generates a signing keystore — **P1, CONFIRMED**

**`build-apk.ps1:119-137`** — if `android/keystore/carenbuddi.keystore` is absent, the script mints a **new** key with a random password and warns only via `Write-Host` (`:121-122`).

Anyone rebuilding from a clean clone produces a **differently-signed APK** that cannot upgrade-install over the shipped one, forcing users to uninstall — which, given D-6 and D-12, silently destroys all local health data. There is no keystore-provisioning documentation.

## V-5 — Rate limiting on the AI endpoint is per-isolate, not global — **P2, CONFIRMED**

`worker/index.ts:48-62` keeps buckets in an **in-memory `Map`**. Cloudflare isolates are ephemeral and numerous, so the 20-requests-per-60s budget (`RATE_LIMIT_MAX`, line 41) is trivially bypassed across isolates. The comment at `:14-15` is honest that this is "best effort", but it is not a real control against cost abuse.

Mitigations that *are* correct: origin allow-list (`:129-132`), `AI_API_KEY` held as a Wrangler secret and never shipped (`:188-200`), `MIXED_CONTENT_NEVER_ALLOW` in the WebView, `WebContentsDebuggingEnabled` correctly gated on `FLAG_DEBUGGABLE` (`MainActivity.java:70-71`), and no `addJavascriptInterface`.

## V-6 — Orphaned service worker can take over mid-session — **P2, CONFIRMED**

`public/sw.js:52` calls `self.skipWaiting()` unconditionally and `:62` calls `clients.claim()`, with **no** `updatefound` handler or user prompt (`components/pwa-register.tsx` is 12 lines). A running session can have its JavaScript swapped mid-interaction.

## V-7 — Service worker still returns an empty `504` for slow static assets — **P2, CONFIRMED**

`public/sw.js:167` — `return new Response("", { status: 504, statusText: "Offline" })`. The RSC/data-request path was fixed (and is regression-tested), but any *other* uncached asset exceeding 8 s (CSS, JS chunk, font, remote image) still gets an empty body. A stylesheet served this way yields an unstyled page.

Also: `fetchWithTimeout` (`:68-88`) races a timer but never calls `AbortController`, so "timed out" requests keep running.

## V-8 — Sensitive non-diagnostic data shipped inside the APK — **P2, CONFIRMED**

`public/CareNBuddi-1.0.0-release-signed.apk` (3.86 MB) and `public/CareNBuddi-1.0.0.zip` (3.21 MB) are committed under `public/`, so they are copied into `out/` and **published by the Worker**. `build-apk.ps1:109` excludes them from the *new* APK but not from the web deployment. Self-referential binaries ~7 MB in size are downloadable by anyone.

## V-9 — Seeded demo accounts ship real-looking identities in the public bundle — **P2, CONFIRMED**

`lib/storage.ts:378-391` seeds three accounts with **realistic Nigerian personal names, live-looking email domains and Nigerian mobile numbers**, including one with `role: "admin"` and one with `role: "provider"`.

Because of D-1 (no password check), typing any of those seeded email addresses into the sign-in form signs you into an admin or provider session. The numbers should also be verified as synthetic before any public launch — I have deliberately not reproduced them here.

## V-10 — Health records have no owner field — **P1, CONFIRMED**

`lib/types.ts:28-36` — `MedicalRecord` is `{ id, title, provider, date, category, summary, link }` with **no `userId`/`ownerId`**. Records are stored in a single flat collection keyed only by `healthlink:records`.

Currently safe *by accident*: the collection lives in one browser profile and every `useStoredCollection` read returns the whole array. But there is no ownership check at all, so the moment records are shared, rendered in a provider view, or moved server-side, there is nothing preventing one patient's record from being shown under another's. The same applies to `JournalEntry`, `Reminder`, `MenstrualCycle`, `MoodEntry`, `SymptomEntry`.

## V-11 — Notification permission never requested (Android 13+) — **P2, CONFIRMED**

`targetSdk 34` requires the runtime `POST_NOTIFICATIONS` permission. It is **not declared** in `AndroidManifest.xml`. Combined with §2.3, the app cannot deliver a notification even if push were implemented.

---

# 5. Backend and database findings

## 5.1 What backend actually exists — CONFIRMED

| Component | State |
|---|---|
| Cloudflare Worker | **One route**: `POST /api/health-guide` (`worker/index.ts:125-127`). No sync, auth, storage or query endpoint. |
| Supabase project | **None configured in this build** (§ top of report). Migrations exist but are unapplied. |
| Storage buckets | **None defined.** No `storage.buckets` in any migration. |
| Server-side authorisation | **None.** Static export; `AppGuard` runs client-side. |

## 5.2 Schema inventory — CONFIRMED

`supabase/migrations/0001_init.sql`: `profiles`, `health_documents`, `bookings`, `provider_requests`, `reports`.
`supabase/migrations/0002_rapid-response.sql`: `emergency_requests`, `emergency_request_events`, `provider_emergency_participation`.

RLS is enabled on all 8 tables (`0001:152-156`, `0002:98-100`). That is a genuine strength — the schema author did the right thing structurally.

## 5.3 Policy assessment

| Policy | Assessment |
|---|---|
| `documents_owner_all` (`0001:173`) | ✅ **Correct.** Strict owner-only, no exceptions. Model for the rest. |
| `profiles_select_own` (`0001:160`) | ⚠️ Allows `is_staff()` to read all profiles including phone numbers. Should be scoped. |
| `profiles_update_own` (`0001:168`) | ❌ **Row-scoped, not column-scoped → D-3 privilege escalation.** |
| `bookings_select` (`0001:182`) | ❌ **Unscoped `is_staff()` → D-4.** Should scope to the provider's own bookings + their own patients. |
| `bookings_insert_own` (`0001:178`) | ⚠️ `or auth.uid() is null` permits anonymous inserts — acceptable for guest booking, but see V-1 class of issue. |
| `bookings_update_staff` (`0001:186`) | ❌ Unscoped `is_staff()`; any staff can update any booking. |
| `provider_requests_*_staff` (`0001:195,199`) | ❌ Unscoped; any staff can read/modify all facility applications. |
| `reports_*_staff` (`0001:208,212`) | ❌ Same. |
| `participation_select_public` (`0002:137`) | ❌ **`using (true)` — anonymous world-read → V-1.** |
| `emergency_requests_select` (`0002:111`) | ❌ Unscoped `is_staff()`; any staff sees every emergency request. |
| `emergency_events_select_staff` (`0002:125`) | ⚠️ Same. |
| `participation_write_staff` (`0002:141`) | ❌ Same. |

## 5.4 Error handling — CONFIRMED

- Worker returns structured JSON errors with correct status codes (`403`, `429`) and a `retry-after` header (`worker/index.ts:130-132, 167-168`). Good.
- Worker failure paths are **honestly surfaced** in the UI: `configured: false` → fallback script (`worker/index.ts:188-192`; `components/health-guide.tsx:285-325`).
- Two-layer deterministic emergency pre-check exists (client `containsEmergencySignal()` `components/health-guide.tsx:350-353`; server `worker/index.ts:171-186`). Good safety design.
- **Client storage swallows quota failures silently.** Only `lib/profile-photo.ts:296-306` handles quota properly. `lib/storage.ts:265,346`, `lib/analytics.ts:36`, `lib/provider-practice.ts:122`, `lib/rapid-response.ts:399` all use bare `catch {}`, so **the UI can display data that will vanish on next reload.** — **P1**

## 5.5 Sync design — CONFIRMED

`sync.ts` is coherent with the schema: `health_documents` PK `(user_id, doc_key)` matches `onConflict: "user_id,doc_key"` (`sync.ts:87` vs `0001:80`). Auto-push is debounced 900 ms (`cloud.tsx:168-177`, `PUSH_DEBOUNCE_MS:53`) with a re-entrancy guard (`applyingRemote`, `cloud.tsx:90`).

Defects: **D-10** (spurious stamps), **D-11** (no merge), **D-12** (sensitive keys excluded), plus **no offline retry/outbox/queue and no resume sync** — a failed push sets `syncState:"error"` and the data simply stays local.

---

# 6. Authentication and role-permission findings

## 6.1 Registration — `app/auth/sign-up/page.tsx`

- Validation: name required, email format, password ≥ 8 chars, confirm match. — **Adequate.**
- **Password is never persisted** (`:120-145`). `User` has no password field. The collected password is discarded in offline mode. — **D-2**
- **Existing-email takeover.** — **D-2, P0**
- `acceptsTerms`/`acceptsPrivacy` checkboxes are present on the provider form. Good.

## 6.2 Login — `app/auth/sign-in/page.tsx`

- **No password verification.** — **D-1, P0**
- Open redirect protection is correct: `next` is validated as a same-site path before `router.push(next)` (`:111-114`). ✅
- No rate limiting, lockout or attempt throttling on the client (there is none server-side either, because there is no server).

## 6.3 Logout — P0

Four implementations, **none clear data**. — **D-6**

## 6.4 Password recovery — `app/auth/forgot-password/page.tsx`

- **Supabase path** (`cloud.resetPassword`) is real and correct for a configured project.
- **Offline path is a stub.** With cloud disabled there is no recovery — and no error is shown explaining that recovery is unavailable. **REQUIRES TESTING** whether the offline branch presents a dead end or implies a reset occurred. — **P2**
- Account & Security (`app/(app)/account/page.tsx:196, 224`) **renders the verification code on screen** and admits in its own copy that "demo mode shows the code instead of sending email". Shipping this to production is misleading; **P1** as a UX/integrity issue.

## 6.5 Email verification — `app/auth/verify/page.tsx`

- `healthlink:auth-pending` stores `{ email, at }` (`components/auth-form.tsx:22,34`) — **PII in localStorage**, minor.
- OTP input is the **best-implemented component in the codebase**: `role="group"`, per-box `aria-label`, `autoComplete="one-time-code"`, paste distribution (`:275-278`), Backspace walk-back, arrow-key navigation (`:251-273`). ✅
- The 6-digit code is verified server-side via Supabase OTP when enabled. Offline, no code is issued — the sign-in flow does not require verification anyway. — **P2, note**

## 6.6 Session persistence — CONFIRMED

- `healthlink:session` = `{ userId, lang }` (`lib/storage.ts:10-13, 28`). **No token, no expiry.**
- A session is a bare userId in localStorage. Anyone with devtools can set it to any value.
- Survives indefinitely; never expires; survives browser restart.

## 6.7 Account deletion — **ABSENT.** — **D-7, P1**

## 6.8 Role representation — CONFIRMED

`Role = "consumer" | "provider" | "admin"` (`lib/types.ts:101`), stored on the `User` record and mirrored in `public.profiles.role`.

**Enforcement is entirely client-side.** `components/app-guard.tsx`:

- `PRIVATE_PATHS` (`:10-27`) — session required.
- `STAFF_PATHS = ["/worker","/admin"]` (`:32`) — prefix match.
- `STAFF_EXACT = ["/provider"]` (`:42`) — exact match only, with an excellent comment (`:34-41`) explaining that a prefix match once locked applicants out of `/provider/register`.
- `matchesPath()` (`:51-54`) — exact or `base + "/"`, correctly avoiding the `/provider` vs `/provider/register` collision.
- Consumers hitting staff routes get a gate with a link back to `/profile` (`:67-76`).
- **"Continue as guest"** (`:130-131`) bypasses the private gate while all `useStoredCollection` hooks keep reading the same keys — this is what makes D-6 exploitable.

The path-matching logic is genuinely well engineered and its comments show real bug history. **The problem is not the logic — it is that it runs in the browser.**

**Fixing the path-matching logic does not and cannot secure the application.** Every guard in this file is advisory until authorisation moves server-side (RLS).

## 6.9 Provider workspace access model — the strongest part of the codebase

`lib/provider-workspace.ts` implements a correct care-relationship model:

- `careRelationships()` — only bookings naming this provider with a non-null `userId`.
- `canAccessCare()` — requires a non-cancelled booking connecting both parties; re-run when opening a patient rather than trusting the list.
- `unassignedRequests()` — guest bookings are requests, not patients.
- `dashboardCounts()` — every count derived from the same booking list the screens list; **no invented statistics.**
- `workspaceAccess()` — unverified applicants locked out; accounts with no application (seed/demo, admins) not locked out.
- Availability is opt-in (`lib/provider-practice.ts` `isOpenOn`/`hasAnyHours`); blank fee is "not set", not free; a booking with no date is never counted as upcoming.
- Capabilities that do not exist are labelled **"Not available yet"** rather than rendering empty lists that imply the data exists.

16 unit tests + 19 E2E checks cover this. This is the correct model — **the database must be brought into line with it (D-4), not the other way round.**

---

# 7. Provider and appointment workflow findings

| # | Finding | Sev | Status |
|---|---|---|---|
| G-1 | Identity/licence documents never uploaded; verification can be "completed" with nothing transmitted | **P0** | CONFIRMED (D-5) |
| G-2 | RLS allows any provider to read all bookings — contradicts the app's care-relationship model | **P0** | CONFIRMED (D-4) |
| G-3 | `MedicalRecord` has no owner field; ownership is unenforced | **P1** | CONFIRMED (V-10) |
| G-4 | No provider→patient record sharing mechanism exists; UI honestly says so | **P2** | CONFIRMED |
| G-5 | Facility availability cannot be represented as "open" — no reliable open/closed source exists | **P2** | CONFIRMED — correctly refused |
| G-6 | Rapid Response has no dispatch integration; UI correctly refuses to simulate one | **P2** | CONFIRMED — correctly refused |
| G-7 | Provider onboarding has no exit route; a provider who wants to "come back later" is trapped | **P2** | CONFIRMED |
| G-8 | Android back abandons a multi-step application mid-form, losing typed input | **P1** | CONFIRMED (D-8) |
| G-9 | Admin reviewer UI (`/admin/providers`) performs only a verified-status transition; reviewer identity is client-supplied | **P1** | CONFIRMED |
| G-10 | Care relationship derives from bookings only — a patient who has never booked cannot be reached, which is correct but means "urgent" patient context is impossible | **P3** | By design |
| G-11 | `lib/provider-workspace.ts` trusts a client-supplied `providerId`; with no server this is advisory only | **P1** | CONFIRMED |

---

# 8. Offline and Android findings

## 8.1 Service worker — `public/sw.js` (170 lines)

| Behaviour | Status |
|---|---|
| Precache shell (16 entries) | PARTIAL — `/care-circle`, `/passport`, `/ask`, `/provider/*`, `/auth/*` **not** precached |
| Install: `allSettled` not `addAll`, then `skipWaiting()` | IMPLEMENTED |
| Activate: purge other caches + `clients.claim()` | IMPLEMENTED (see V-6) |
| Navigations: network-first, 2 s ceiling, cache fallback, `/app` fallback, 503 offline | IMPLEMENTED, well-commented |
| RSC/data requests bypassed (the profile-freeze fix) | IMPLEMENTED, regression-tested |
| `.zip`/`.apk` bypass | IMPLEMENTED |
| Non-GET / cross-origin bypass | IMPLEMENTED |
| **Static asset 504 empty response** | **REQUIRES ATTENTION (V-7)** |
| **`AbortController` on timeout** | **ABSENT** |
| Cache trimming / quota handling | **ABSENT** — single `healthlink-v4` bucket grows unbounded |
| Navigation cache keys are raw URLs | `/app`, `/app/`, `/app?x=1` cache separately |

**Coupling risk (P2, CONFIRMED):** the RSC bypass regex `/__next\..*\.txt$/` depends on the filename mangling performed by `scripts/fix-rsc-segments.mjs`, which only runs via `npm run build`. Skip that script (or run `next build` directly) and the guard silently stops matching real filenames, reintroducing the profile-freeze class of bug.

## 8.2 PWA registration — `components/pwa-register.tsx` (12 lines)

Registered at `:8`, errors swallowed by `.catch(() => {})` (silent failure). **No** `updatefound`, **no** controller-change handling, **no** background sync, **no** periodic sync, **no** push.

## 8.3 Storage

- **IndexedDB: ABSENT.** localStorage only.
- **No encryption** (V-2).
- **No cookie usage** in app code.
- 37 `localStorage` keys + 1 `sessionStorage` key; **22 carry PHI or third-party PII.**
- **No data clearing on sign-out** (D-6).
- **Quota failures silently swallowed** outside profile photos (§5.4).
- `refreshLocal()` (`lib/storage.ts:202-205`) is exported and documented but has **zero call sites — dead code.**
- `healthlink:theme` is written from two places (`components/theme-provider.tsx:8,25` and `app/(app)/profile/page.tsx:121,129`) — duplicated ownership, a divergence risk.

## 8.4 Android

| Area | Finding | Sev |
|---|---|---|
| Back button | **D-8** — no interception anywhere | **P1** |
| Predictive back | `onBackPressed()` deprecated; no `enableOnBackInvokedCallback`; `launchMode="singleTask"` with no `onNewIntent`; `webView.clearHistory()` never called, so a restored session returns with a stale back-stack | **P2** |
| Keyboard | `inputMode`/`autoComplete` coverage is **thorough** (19+ sites). ✅ But **no `visualViewport`, no scroll-into-view on focus, no focus trap in any sheet.** | **P2** |
| Sheets | Escape works (hardware keyboards only); **no focus trap, no focus restoration, no swipe-to-dismiss** (grabber bar is decorative) | **P2** |
| `ConfirmDialog` | **No `role="dialog"`, no `aria-modal`, no Escape, no focus trap** — worse than `BottomSheet` | **P2** |
| File upload | WebView `onShowFileChooser` implemented properly incl. multi-select (`MainActivity.java:92-96, 124-167`). ✅ **But `capture` attribute absent** on both file inputs, so Android will not offer direct camera capture. | **P2** |
| Permissions | Only `INTERNET` + `ACCESS_NETWORK_STATE`. No `POST_NOTIFICATIONS` (V-11), no camera (fine — picker only). | **P2** |
| Splash | Non-blocking, `aria-hidden`, CSS failsafe at 1700 ms, reduced-motion honoured. ✅ **Caveat:** `pointer-events` remain active for the first 1000 ms. | **P3** |
| APK reproducibility | `gradlew` + assets gitignored; keystore auto-generated (V-4); build is a Windows-only PowerShell script not wired to npm | **P1** |
| APK binaries published on the web | V-8 | **P2** |

---

# 9. Accessibility findings

## 9.1 What is genuinely good — credit where due

This is a better-than-average accessibility baseline:

- **Global focus ring survives `outline-none`.** `app/globals.css:361-365` declares `:focus-visible{outline:2px solid var(--color-brand-700)...}` **unlayered**, which beats the 19 `outline-none` utilities in the cascade. Verified against the built CSS.
- **All 10 `<img>` elements have `alt`.** Decorative ones correctly use `alt=""` with an `sr-only` initials span (`app-ui.tsx:656,709`).
- **`Segmented`, `Switch`, `Chip`, `Button`, `IconButton`, `ListRow` are all correct**: native `<button>`, `aria-pressed`/`aria-checked`, and `IconButton`'s `label` prop is **required by the type** so an unnamed icon button cannot compile.
- **OTP input is excellent** (§6.5).
- `<details>`/`<summary>` used natively at `emergency/page.tsx:71-72` and `components/health.tsx:119-120`. ✅
- **A role-selection `<div onClick>` bug was previously found and fixed**, with an explanatory comment at `app/auth/sign-up/role/page.tsx:12`. Good culture.
- Reduced-motion is honoured for the splash, sheets, onboarding and scroll-reveal.

## 9.2 Localisation is the largest accessibility problem — **P1, CONFIRMED**

**A. `lang` attribute is hardcoded** — `app/layout.tsx:32` is `<html lang="en">`. `components/ui.tsx:11-13` changes only `session.lang` in localStorage and **never updates `document.documentElement.lang`**.

**Consequence:** a screen reader applies English pronunciation and letter-spacing rules to Yoruba, Hausa and Igbo for the entire session, in every language. This is the single highest-impact localisation defect.

**B. ~45% of UI strings are English-only.** The project's own checker (`scripts/check-i18n.mjs`) reports:

```
used but not defined in en (rely on inline fallback): 590
```

Of **1,317** distinct keys used in code, **590** (45%) are absent from the English dictionary and fall back to inline English strings. Dictionary key counts: `en` 998, `yo`/`ha`/`ig` 1,001 each — but the *used* set is 1,308+ per language.

**This means the following render 100% in English even when Yoruba/Hausa/Igbo is selected:** the entire My Health Diary (`/health/diary/*`), the Health Guide, Nearby Emergency, Support, and the **entire provider workspace and all provider onboarding/status/register screens** (143 `pws:*` + 108 `pr:*` keys).

One key, `pr_soon`, is defined only in English and is dead. Four keys (`a_demo_note`, `auth_verify_no_email`, `auth_verify_short`, `lang`) are translated in yo/ha/ig but **missing from English** — so English and Yoruba users see different text for the same string.

**C. Health-article bodies are English-only.** `lib/locales/yo.ts`, `ha.ts`, `ig.ts` are **empty objects**. Only 4 of 12 topics carry any translation, and those translate **only `title` and `summary`** — `whatItIs`, `symptoms[]`, `riskFactors[]`, `prevention[]`, `whenToSeekHelp` and `faqs[]` are English in all four languages.

**D. Non-dictionary content is never translatable:** `COST_TIER_LABELS` (`lib/content.ts:65-69`, rendered live at `book-sheet.tsx:157`), all 72 provider records (name/city/address/hours/services/description), all 8 exercise names and instructions, and `components/ui.tsx:22` (`<span className="sr-only">Language</span>`).

**E. Text expansion will clip.** `truncate` appears 150×. It is applied to the title and subtitle of **every** `SectionHeader` (`app-ui.tsx:63-64`) and **every** `ListRow` (`app-ui.tsx:190-191`) — the two most reused primitives in the app. High-risk sites: `app-ui.tsx:143` (`Chip` is `whitespace-nowrap shrink-0`), `components/nav.tsx:89,93` (global header, ~210 px wide), `components/nav.tsx:163-169` (bottom-nav labels at 10 px will wrap to 3+ lines in Yoruba), `components/health-charts.tsx:238-293` (label + value + trend in ~150 px), `components/provider-card.tsx:69-107` (6 truncates), `components/nearby-emergency.tsx:183-355`.

There is no `:lang()` rule, no locale-specific override and no tooltip.

## 9.3 ARIA and semantics — CONFIRMED

Census: `aria-label` 50 · `role=` 21 · `aria-live` **3** · `onKeyDown` **3** · `aria-current` 6 · `aria-pressed` 4 · **`aria-invalid` 0** · **`aria-errormessage` 0** · **`aria-busy` 0** · `tabIndex` **1**.

| # | Finding | File | Sev |
|---|---|---|---|
| A-1 | **`<div onClick>` with no role/tabIndex/keyboard handler** — a user's own support conversations cannot be opened by keyboard. Only instance in the codebase. | `app/(app)/support/page.tsx:197` | **P1** (WCAG 2.1.1) |
| A-2 | **`Tabs` missing `role="tabpanel"`, `aria-controls`, roving tabIndex and arrow-key navigation.** | `app-ui.tsx:323-357` | **P1** (WCAG 2.1.1, 4.1.2) |
| A-3 | **`ConfirmDialog` has no `role="dialog"`, no `aria-modal`, no Escape, no focus trap** — used for destructive confirmations (delete record, cancel booking, sign out). | `app-ui.tsx:443-480` | **P1** |
| A-4 | **QR code has no accessible name or text alternative.** Screen-reader users get nothing from the Health Passport QR. | `app/(app)/passport/page.tsx:153` | **P1** |
| A-5 | **`Field` renders its error inside the `<label>`** with no `role="alert"`, no `aria-live`, and the input gets no `aria-invalid`. The error is read as part of the field's name on every focus. | `app-ui.tsx:534-553` | **P1** (WCAG 3.3.2, 4.1.2) |
| A-6 | **Journal entry form uses bare `<input>`s with placeholder-only labels** — 9 controls. Placeholders vanish on focus and are not reliable accessible names. | `app/(app)/journal/page.tsx:278-389` | **P1** (WCAG 1.3.1) |
| A-7 | **Support form: 4 controls have `<label>` as a *sibling*, not a wrapper** — no association. | `app/(app)/support/page.tsx:155,164,177,232` | **P1** |
| A-8 | **Toast live region is the toast itself, mounted on insertion** — announcements unreliable; errors are never `assertive`. | `app-ui.tsx:500-521` | **P2** |
| A-9 | **Profile cropper is pointer-only** — `<div>` with mouse/touch/wheel, `touch-none`, no role/tabIndex/keyboard. Zoom is wheel-only. Entirely unusable by keyboard. | `components/profile-cropper.tsx:149-165` | **P1** (WCAG 2.1.1) |
| A-10 | **`report-button` textarea has no label**; trigger has no `aria-expanded`/`aria-controls`; popover has no Escape. | `components/report-button.tsx:46-64` | **P2** |
| A-11 | **No skip-to-content link** across 8 `<main>` elements — a keyboard user tabs through the header + 5 bottom-nav links on every page. | app-wide | **P2** |
| A-12 | **No route-change focus management** — the whole app contains 4 `.focus()` calls, 3 of them in the OTP input. Page transitions never announce the new page. | app-wide | **P2** |
| A-13 | **Charts have no text alternative.** `Sparkline` renders a trend shape with no summary; `Ring` is `aria-hidden` with no `role="meter"`. Trend direction is conveyed by colour chip only. | `components/health-charts.tsx:106-248` | **P2** |
| A-14 | **`animate-bounce` "Thinking…" indicator has `aria-label` on a plain `<div>`** — not exposed to AT. | `components/health-guide.tsx:587` | **P3** |

## 9.4 Colour contrast — computed from the palette hex values

Exact ratios for solid pairs (WCAG relative-luminance formula). Pairs involving `opacity-*` or gradients are marked REQUIRES VERIFICATION.

| Foreground | Background | Ratio | Verdict |
|---|---|---|---|
| `#087F8C` brand-700 | `#ffffff` | 4.75 | PASS AA |
| **`#0B8778` brand-600** | `#ffffff` | **4.42** | **FAIL AA** — used at `appointment-card.tsx:65`, `provider-card.tsx:106` |
| **`#087F8C`** | **`#EAF7F5` brand-50** | **4.32** | **FAIL AA** — active tabs, and 100+ `bg-brand-50 text-brand-700` chips/badges |
| **`#C24834` coral-700** | **`#FFF1EE` coral-50** | **4.47** | **FAIL AA** by 0.03 — `app-ui.tsx:178` |
| **`#94a3b8` slate-400** | `#ffffff` | **2.56** | **SEVERE FAIL** — see below |
| `#94a3b8` | `#f8fafc` | 2.45 | **SEVERE FAIL** |
| **`#cbd5e1` slate-300** | `#ffffff` | **1.48** | **SEVERE FAIL** — current date, `app/(app)/app/page.tsx:357` |
| **`#f43f5e` rose-500** | `#fff1f2` | **3.34** | **FAIL** — EmptyState/ErrorState icons, delete affordance |
| **`#d97706` amber-600** | `#ffffff` | **3.19** | **FAIL** — "Reminders" metric, `app/(app)/app/page.tsx:154` |
| `#4caf50` green-500 | `#ffffff` | 2.78 | FAIL — chart bars |
| `#ff7a6b` coral-500 | `#ffffff` | 2.55 | FAIL — notification dot |
| `#ffe4e6` rose-100 | `#e11d48` rose-600 | 3.91 | FAIL — emergency "Police · Ambulance · Fire" |

**The dominant problem is `text-slate-400` (`#94a3b8` at 2.56:1), used ~80 times for small supporting text — and it is what the medically important disclaimers consistently use:**

- `components/health-guide.tsx:636` — the 10 px **AI medical disclaimer**
- `components/nearby-emergency.tsx:395` — the **"positions are approximate" safety disclaimer**
- `components/book-sheet.tsx:260` — the booking disclaimer
- `app/(app)/app/page.tsx:353`, `appointments/page.tsx:319`, `find-care/page.tsx:288` — "not a diagnosis" footers
- `nearby-emergency.tsx:404` — an **interactive** "Retry address lookup" link at 2.56:1

The legal and safety-critical text is rendered in the lowest-contrast token in the palette. — **P1**

Dark mode (`globals.css:29-53`) introduces non-Tailwind values (`--card #1e293b`, `--text-tertiary #64748b`) so the two themes are not guaranteed equivalent — **REQUIRES VERIFICATION**. The focus ring is `brand-700` in both themes; on dark surfaces it is faint.

## 9.5 Text scaling — **P2, CONFIRMED**

**199 occurrences of fixed `text-[Npx]`** across 42 files, which do not respond to browser font-size settings. No `html { font-size }` override exists.

Smallest sizes: `text-[9px]` (1 site), `text-[10px]` (~12 sites incl. **all 5 bottom-nav labels** and the AI disclaimer), `text-[11px]` (~80 sites).

At 200% zoom, `#app-shell` is fixed-height with `overflow:hidden` (`globals.css:154-161`), and `app/(app)/layout.tsx:16` uses a fixed `pb-24` bottom padding — the bottom nav can overlap the last content. `body { overflow-x: hidden }` (`globals.css:99`) clips rather than allowing reflow.

## 9.6 Non-text alternatives — **P2, CONFIRMED**

- **No speech synthesis / TTS anywhere** (0 matches for `speechSynthesis`, `Audio`). For a product aimed at users with low literacy and intended for Yoruba/Hausa/Igbo, the AI Health Guide has **no spoken output channel at all**.
- **`<video>` has no `<track kind="captions">`, no `kind="descriptions"`, no `aria-label`** — `components/exercise-media.tsx:65-78`. (Currently moot: the video directory is empty — every load 404s and shows a developer message.)
- Medication status is encoded by colour alone (`app/(app)/app/page.tsx:169-172`).
- Colour-only encoding in `MeasurementTile` trend chips (`health-charts.tsx:43-47`).

## 9.7 Reduced motion — **P3, CONFIRMED**

Well covered for splash/sheets/onboarding/reveal. **Not covered:** `.tap { transform: scale(0.97) }` (`globals.css:330-336`) is on every Button/Chip/ListRow and has no reduced-motion opt-out; `animate-bounce` "Thinking…" dots; `animate-spin` refresh icons; `animate-pulse` loaders.

---

# 10. Missing tests

## 10.1 What exists — and it passes

| Suite | Result |
|---|---|
| `tests/provider-workspace.test.ts` | 16 tests |
| `tests/auth-back.test.ts` | 7 tests |
| `tests/service-worker.test.ts` | 4 tests |
| `tests/theme-provider.test.ts` | 2 tests |
| `npm test` total | **76 tests, 76 pass** |
| `scripts/test-rapid-response.mjs` | 22 pass |
| `scripts/test-health-diary.mjs` | 8 pass (timezone matrix) |
| `e2e/provider-workspace.mjs` | 19 checks |
| `e2e/provider-journey.mjs` | 49 checks |
| `e2e/back-arrows.mjs` | 18 checks |

The provider-workspace unit tests are genuinely good security tests — they assert that another provider's patient, an unassigned booking, a cancelled-only patient and "knowing an id" all resolve to **no access**.

## 10.2 What is missing — by priority

| # | Gap | Why it matters | Sev |
|---|---|---|---|
| M-1 | **No test exercises `history.back()` / Android back** | D-8 shipped undetected because `back-arrows.mjs` only clicks back *links*. | **P1** |
| M-2 | **No auth test.** No test signs in with a wrong password, with no password, or asserts that sign-out clears data. | D-1 and D-6 are the two worst findings and **neither would be caught**. | **P0** |
| M-3 | **No RLS policy test.** No test asserts that a provider cannot read another provider's bookings, or that a consumer cannot `update` their own `role`. | D-3 and D-4 would both pass CI today. | **P0** |
| M-4 | **No document-upload test.** No test asserts that an attached file is actually transmitted. | D-5 — the most serious functional stub. | **P0** |
| M-5 | **No test for localStorage key isolation between accounts** | The class of bug behind D-6. | **P1** |
| M-6 | **No accessibility testing.** `axe-core` is not a dependency; no test references a11y, ARIA or contrast. | A-1…A-14 and the contrast failures are invisible to CI. | **P1** |
| M-7 | **No i18n completeness gate.** `scripts/check-i18n.mjs` exists and reports 590 missing keys — but **is not wired into `npm test` or `npm run build`**, so nothing fails on it. | The 45% English-only surface is silently shippable. | **P1** |
| M-8 | **No sync/conflict test.** No test exercises two devices, offline push, or the `D-10`/`D-11` defects. | Both are latent behind the disabled cloud flag. | **P1** |
| M-9 | **No Worker test.** No test for origin allow-list, rate limiting, input limits, or the missing APK origin (D-9). | D-9 is a shipped, user-visible break. | **P2** |
| M-10 | **No quota-exhaustion test.** Only profile photos handle quota failure. | Silent data loss elsewhere. | **P2** |
| M-11 | **No visual-regression or screenshot test** | Contrast, truncation and dark-mode regressions are invisible. | **P2** |
| M-12 | **No APK smoke test.** The APK is not built or verified in CI. | D-9 shipped because the APK path is never exercised. | **P2** |
| M-13 | **No build-reproducibility check.** No lockfile, so CI can silently upgrade. | — | **P2** |
| M-14 | **Lint has 3 pre-existing errors** and does not fail the build. | Errors in `support/page.tsx:65` and `auth/verify/page.tsx:58` (setState-in-effect) are tolerated. | **P2** |

---

# 11. Prioritised remediation plan

## P0 — Ship-stopping

| # | Fix | Files |
|---|---|---|
| **1** | **Do not treat client-side auth as authentication.** Either (a) enable Supabase and make it the only path, or (b) remove the sign-up/sign-in UI and label the app explicitly as a local-only demo that stores nothing sensitive. **Shipping an auth screen that accepts any password over a health record is worse than having no auth screen.** | `app/auth/sign-in/page.tsx`, `app/auth/sign-up/page.tsx`, `lib/supabase/cloud.tsx`, `components/app-guard.tsx` |
| **2** | **Fix RLS before enabling cloud.** Block self-promotion by restricting updatable columns; scope `is_staff()` reads to the provider's own bookings. | `supabase/migrations/0003_rls_hardening.sql` (new), `0001_init.sql` |
| **3** | **Make document upload real, or remove the upload UI.** A provider must never be shown as verified against documents that were never transmitted. | `app/(app)/provider/onboarding/page.tsx:400-434`, `lib/provider-application.ts`, new upload endpoint |
| **4** | **Clear all local health data on sign-out** and gate guest browsing so it cannot read a previous user's collections. | `lib/supabase/cloud.tsx:207-215`, `components/profile-settings.tsx:101-115`, `app/(app)/profile/page.tsx:252-266`, `lib/storage.ts` |
| **5** | **Remove the false "Offline — changes queued" badge**, or implement a real outbox. | `app/(app)/worker/page.tsx:87-94` |

## P1 — Essential

| # | Fix | Files |
|---|---|---|
| 6 | Close `participation_select_public` to authenticated users | `supabase/migrations/0003_*.sql` |
| 7 | Implement Android back interception (sheets, dialogs, wizard steps) | `components/app-ui.tsx:391-480`, `components/nav.tsx`, `android/.../MainActivity.java:169-176`, `AndroidManifest.xml` |
| 8 | Add account deletion + data export | new route, `lib/storage.ts` |
| 9 | Add `ownerId` to all clinical record types | `lib/types.ts`, `lib/storage.ts` |
| 10 | Fix sync: null-payload stamps, merge strategy, include diary keys | `lib/supabase/sync.ts`, `lib/supabase/cloud.tsx` |
| 11 | Wire `scripts/check-i18n.mjs` into `npm test`; gate on 0 missing keys | `package.json`, `scripts/check-i18n.mjs` |
| 12 | Add `lang` syncing to `<html>` | `components/ui.tsx:11-13`, `app/layout.tsx:32` |
| 13 | Fix contrast: raise `text-slate-400` and all failing pairs, prioritising disclaimers | `app/globals.css:21-23,29-53`, ~80 call sites |
| 14 | Fix a11y: A-1…A-5, A-9 (keyboard, dialogs, QR, field errors, journal labels) | `app/(app)/support/page.tsx:197`, `components/app-ui.tsx:323-553`, `app/(app)/passport/page.tsx:153`, `app/(app)/journal/page.tsx:278-389`, `components/profile-cropper.tsx:149-165` |
| 15 | Add `POST_NOTIFICATIONS`; implement or remove notification UI | `AndroidManifest.xml`, `components/profile-settings.tsx:182-207`, `app/(app)/profile/page.tsx:627-657`, `components/nav.tsx:97-106` |
| 16 | Provision and document the release keystore; set `allowBackup="false"` | `build-apk.ps1:119-137`, `AndroidManifest.xml:8`, `docs/` |
| 17 | Remove the committed APK/ZIP from `public/` | `public/CareNBuddi-1.0.0-release-signed.apk`, `public/CareNBuddi-1.0.0.zip` |
| 18 | Add P0 tests M-2, M-3, M-4 | new test files |

## P2 — Important

| # | Fix | Files |
|---|---|---|
| 19 | Replace fixed `text-[Npx]` with rem; handle 200% zoom | ~42 files with fixed sizes, `app/globals.css:154-166` |
| 20 | Fix text truncation for Yoruba/Hausa/Igbo expansion | `components/app-ui.tsx:63-64,143,190-191`, `components/nav.tsx:89,93,163-169` |
| 21 | Add APK origin to `ALLOWED_ORIGINS` (D-9) | `worker/index.ts:33-38` |
| 22 | Allow-list external navigations in the WebView | `MainActivity.java:113-115` |
| 23 | Fix manifest `scope`, add `id` and `shortcuts` | `public/manifest.json:6` |
| 24 | Handle quota failures everywhere, not just profile photos | `lib/storage.ts:265,346`, `lib/analytics.ts:36`, `lib/provider-practice.ts:122`, `lib/rapid-response.ts:399` |
| 25 | Complete precache list; add cache trimming; use `AbortController` | `public/sw.js:9-26,68-88` |
| 26 | Fix lint errors; add lockfile | `app/(app)/support/page.tsx:65`, `app/auth/verify/page.tsx:58`, add lockfile |
| 27 | Wire `build-apk.ps1` into npm; add `capture` to file inputs | `package.json`, `app/(app)/profile/page.tsx:333`, `app/(app)/provider/onboarding/page.tsx:397` |
| 28 | Swap `google-fonts` to a local fallback | `app/layout.tsx` |
| 29 | Add an exit route to provider onboarding (G-7) | `app/(app)/provider/onboarding/page.tsx` |
| 30 | Fix `ConfirmDialog` semantics; add focus traps | `components/app-ui.tsx:443-480` |

## P3 — Enhancements

Translate health-article bodies (`lib/locales/*.ts`) · add TTS for the Health Guide · video captions · add skip-to-content link · route-change focus management · chart text alternatives · reduced-motion for `.tap` · rename `healthlink:` storage prefix · align `0.1.0` / `1.0.0` versions · publish DPO contact per the privacy policy · global rate limiting for the Worker.

---

# 12. Exact files requiring modification

| Priority | File | Change |
|---|---|---|
| **P0** | `app/auth/sign-in/page.tsx:79-93` | Remove password-less `signInOffline`; require Supabase or remove the screen |
| **P0** | `app/auth/sign-up/page.tsx:120-145` | Remove existing-account takeover; persist credentials via Supabase only |
| **P0** | `supabase/migrations/0003_rls_hardening.sql` *(new)* | Column-scoped role updates; provider-scoped bookings/reports/emergency policies |
| **P0** | `supabase/migrations/0001_init.sql:167-169` | Restrict `profiles_update_own` to non-role columns |
| **P0** | `supabase/migrations/0001_init.sql:181-187` | Scope `bookings_select`/`_update_staff` to the provider's own bookings |
| **P0** | `app/(app)/provider/onboarding/page.tsx:400-434` | Implement real upload, or remove the picker |
| **P0** | `lib/provider-application.ts` | Store an upload reference, not bare metadata |
| **P0** | `lib/supabase/cloud.tsx:207-215` | Clear all `healthlink:*` on sign-out |
| **P0** | `components/profile-settings.tsx:101-115` | Same |
| **P0** | `app/(app)/profile/page.tsx:252-266` | Same (duplicate) |
| **P0** | `app/(app)/worker/page.tsx:87-94` | Remove the false queued badge |
| **P1** | `supabase/migrations/0001_init.sql:195,199,208,212` | Scope staff policies |
| **P1** | `supabase/migrations/0002_rapid-response.sql:111,115,125,137,141` | Scope staff policies; close world-read |
| **P1** | `components/app-ui.tsx:391-480` | Back interception, focus trap, dialog semantics |
| **P1** | `components/nav.tsx:75,132,238` | Register sheets with the back handler |
| **P1** | `android/.../MainActivity.java:169-176` | Replace deprecated `onBackPressed` |
| **P1** | `android/.../AndroidManifest.xml:8,17` | `allowBackup="false"`; predictive back flag |
| **P1** | `lib/types.ts:12-36` | Add `ownerId` to record types |
| **P1** | `lib/supabase/sync.ts:76,84,89,103-121` | Fix stamps; add merge; extend `SYNCED_KEYS` |
| **P1** | `components/ui.tsx:11-13`, `app/layout.tsx:32` | Sync `<html lang>` |
| **P1** | `app/globals.css:21-23,29-53` | Raise failing contrast tokens |
| **P1** | `app/(app)/support/page.tsx:155,164,177,197,232` | Label association; keyboard-operable rows |
| **P1** | `components/app-ui.tsx:323-357,534-553` | Tabs pattern; field error semantics |
| **P1** | `app/(app)/passport/page.tsx:153` | QR text alternative |
| **P1** | `app/(app)/journal/page.tsx:278-389` | Label all 9 controls |
| **P1** | `components/profile-cropper.tsx:149-165` | Keyboard-operable crop |
| **P1** | `build-apk.ps1:119-137`, `docs/` | Keystore provisioning |
| **P1** | `public/` | Remove committed APK/ZIP |
| **P2** | `worker/index.ts:33-38` | Add APK origin; externalise allow-list |
| **P2** | `MainActivity.java:113-115` | Navigation allow-list |
| **P2** | `public/manifest.json:6` | Fix `scope`, add `id` |
| **P2** | `public/sw.js:9-26,68-88,167` | Precache list; `AbortController`; 504 path |
| **P2** | `lib/storage.ts:265,346` and siblings | Quota handling |
| **P2** | `app/(app)/support/page.tsx:65`, `app/auth/verify/page.tsx:58` | Lint errors |
| **P2** | `package.json` | Lockfile; wire `build-apk.ps1`, `check-i18n.mjs` |
| **P2** | `app/layout.tsx` | Local font fallback |

---

# 13. Safe test procedures for verifying the fixes

All procedures are non-destructive, use synthetic data only, and run against a local build or a dedicated test Supabase project. **Never run these against production.**

### 13.1 Verify the P0 auth fix

1. `npm run build`, then `npx wrangler dev --local --port 8795`.
2. Create account A with a synthetic email (`qa-a@example.test`), a synthetic password, and synthetic health data (weight 70kg, one mood entry "happy").
3. Sign out. Assert `localStorage` has **zero** `healthlink:` keys — `Object.keys(localStorage).filter(k => k.startsWith("healthlink:"))` must be `[]` beyond `session`.
4. Attempt to sign in as A with a deliberately wrong password. Assert the app **rejects** it and the session `userId` is `null`.
5. Attempt to sign in with an empty password. Assert rejection.
6. Sign up again using A's email. Assert the app **refuses** and does not modify A's `phone` or set the session to A's id.
7. Confirm B cannot read A's records: after signing in as B, assert the journal/records collections do not contain A's synthetic entries.

### 13.2 Verify the RLS fix (dedicated test project only)

1. Create a disposable Supabase project. Apply all migrations including the new hardening migration.
2. Create three synthetic users: `consumer-a`, `provider-1`, `provider-2`.
3. **Privilege escalation test** — as `consumer-a`, attempt:
   `update public.profiles set role='admin' where id = auth.uid();`
   Assert it is **rejected**. Repeat with `role='provider'`. Assert rejection.
4. **Booking isolation test** — as `provider-1`, `select * from public.bookings;`
   Assert the result contains **only** bookings where `provider_id` is provider-1's own. Assert zero rows belonging to provider-2 or to an unrelated patient.
5. **Anonymous world-read test** — using the **anon** key with **no** session, `select * from public.provider_emergency_participation;`
   Assert it is rejected or returns zero rows.
6. **Document isolation** — as `consumer-a`, `select * from public.health_documents;`
   Assert only `consumer-a`'s own rows. (This policy is already correct — this is a regression guard.)
7. Document the disposable project id in the test file and **destroy the project afterwards**.

### 13.3 Verify the document-upload fix

1. Use a synthetic file with no real document content (e.g. a 10 KB text file named `qa-test-id.txt`).
2. Complete provider onboarding and attach it.
3. Assert the upload returns a server-side reference (e.g. a storage path).
4. **Download the object back** and assert the bytes match the input.
5. Assert the provider Profile and any public listing render **no** file contents and no NIN value — extend the existing check in `e2e/provider-workspace.mjs`.
6. Assert the storage bucket's RLS denies anonymous read.

### 13.4 Verify the Android back fix

1. Build the APK per `build-apk.ps1` (or use `adb` against a local install).
2. On a device or emulator, open **Patient Care** → tap **More** (bottom sheet). Press the system back button. **Assert:** the sheet closes and the underlying page is unchanged.
3. Repeat for `ConfirmDialog` (trigger a destructive confirmation, e.g. delete a synthetic record).
4. Enter provider onboarding, advance to step 3, press back. **Assert:** returns to step 2 with entered values intact.
5. Repeat for patient onboarding.
6. At the first step of each wizard, press back. Assert the user can leave via the intended exit route (G-7).
7. Regression: press back repeatedly to the root. Assert the app exits cleanly rather than looping.
8. Add an automated equivalent to CI that dispatches `history.back()` in `e2e/` — closing the M-1 gap.

### 13.5 Verify sync correctness

1. Use a **disposable** Supabase project and two browser contexts.
2. Context 1 (device A): sign in, add two synthetic journal entries, wait for the debounce.
3. Context 2 (device B): sign in. Assert both entries arrive.
4. **Conflict test:** with both devices online, add one entry on A and one on B before either syncs. Sync both. Assert **both entries survive** (fails today — D-11).
5. **Stamp test:** on a device where a key is locally empty, sync. Assert `synced-at:<key>` is **not** written (fails today — D-10).
6. **Diary coverage test:** assert menstrual/mood/symptom keys appear in `SYNCED_KEYS` (fails today — D-12).
7. Destroy the project afterwards.

### 13.6 Verify accessibility fixes

1. Add `axe-core` to devDependencies; run it against every route in CI.
2. Run an NVDA (Windows) or VoiceOver (macOS/iOS) pass over: `/onboarding` (all steps), `/auth/sign-in`, `/provider/patients` (open a patient), `/provider/practice`, `/reminders`, `/support`.
3. Assert `<html lang>` changes when switching to Yoruba, Hausa and Igbo.
4. Assert `node scripts/check-i18n.mjs` reports **0** missing keys and that the command **fails the build** if not.
5. Keyboard-only pass: reach and open a support conversation; traverse `Tabs` with arrow keys; complete a delete confirmation; operate the profile cropper.
6. Text-expansion pass: set the browser language and check the global header, bottom nav, `ListRow` subtitles and provider cards at Yoruba.
7. Contrast: verify the disclaimer strings (`hg_disclaimer`, `er_approx`, `ft_notdx`, `em_footer`, `fc_book_note`) at ≥4.5:1 in **both** light and dark themes.
8. Text scaling: set browser font-size to 200% and confirm no clipped or overlapping content, especially the bottom nav.
9. Add a screen-reader alternative for the Health Passport QR and assert it is announced meaningfully.

### 13.7 Verify the false-UI removals

1. Assert the worker queue screen does **not** display "changes queued" unless a real outbox exists.
2. Assert the notification bell dot is absent when there are no unread items, and present only when there are.
3. Assert no screen displays a notification preference that has no delivery mechanism, or that each is accompanied by the existing honest copy ("Notification delivery is planned for the digital MVP").

### 13.8 CI gates to add

```
npm run lint            # must exit 0 (currently 3 errors)
npm test                # unit
node scripts/check-i18n.mjs   # must exit 0 (currently 590 missing keys)
node scripts/audit-pages.mjs  # route integrity
npm run build           # must exit 0
e2e suite               # incl. the new history.back() and auth tests
axe-core pass           # must exit 0
```

---

# 14. Summary — the five most important confirmed findings

## Confirmed — reproduced or read directly from source

1. **P0 — Sign-in never checks the password, and the deployed build has no cloud backend.** `app/auth/sign-in/page.tsx:79-93` signs in on email alone; `cloudMode` is `false` in production (verified: zero Supabase hosts in the live bundle). **Anyone who knows an email address can access that account's full unencrypted health record.** This is the finding that makes the platform unsafe to hold real patient data today.

2. **P0 — Supabase RLS allows privilege escalation and cross-provider data access.** `profiles_update_own` is row-scoped but not column-scoped, so any user can `set role='admin'` on their own profile (`0001_init.sql:167-169`, no trigger guards it). And `bookings_select` grants **every** provider read of **every** patient's booking — name, phone and reason for visit (`0001:181-183` + `is_staff()`). Both are latent only because cloud is disabled; **fix these before enabling Supabase.**

3. **P0 — Provider "verification" can be completed with documents that were never uploaded.** `app/(app)/provider/onboarding/page.tsx:400-434` discards the `File` and stores only name/size/MIME. No `FormData`, no endpoint, no storage bucket exists anywhere. A reviewer relying on the UI is reviewing nothing.

4. **P0 — Sign-out leaves all health data on the device.** Four sign-out implementations, none clearing data; there is no `localStorage.clear`/`removeItem` anywhere in the codebase. Combined with "Continue as guest", **the next person to open the app on a shared Android device sees the previous user's menstrual cycle, mood, medical record and profile photo.**

5. **P1 — Android back does not close sheets, dialogs or wizard steps.** Zero `popstate`/`history.pushState`/`router.back()` in the entire codebase; all 24 router calls are `push`. Back abandons a 5-step provider application mid-form with typed input lost. The E2E suite tests back *links* only, so it structurally cannot catch this.

**Honourable mention (correctly built, worth protecting):** the client-side care-relationship access model in `lib/provider-workspace.ts` is genuinely well designed and tested — a provider can only reach a patient connected by a live appointment, guest requests are not patients, availability is opt-in, and unimplemented capabilities say so rather than faking them. **The database is currently more permissive than the application. Bring the schema into line with this model, not the reverse.**

## Requires further testing — not reproduced

| Item | Why unresolved |
|---|---|
| **Offline password-reset path** | Code read shows no Supabase branch when disabled; not confirmed whether the UI shows a dead end or implies a reset occurred. |
| **Worker rate-limit bypass across isolates** | Architecture (`in-memory Map`, `worker/index.ts:48-62`) strongly implies bypass; not load-tested. |
| **Dark-mode contrast parity** | Dark palette introduces non-Tailwind values; not rendered and measured. |
| **`opacity-*` text contrast** (`health-days:135`, `reminders:93`, `book-sheet:195`) | Effective ratio depends on compositing; needs rendering. |
| **`JavaScriptCanOpenWindowsAutomatically` navigation exposure** | No `addJavascriptInterface` and no `setAllowFileAccess`, so exposure looks limited; not independently exploited. |
| **Synced diary data volume in production** | No production Supabase project exists to inspect. |
| **Focus-ring visibility in dark mode** | Computed as faint on `#1e293b`; needs visual confirmation. |
| **`field` hydration/SSR edge cases at other breakpoints** | Tested at one viewport only. |

**A caveat on this audit's own limits:** it is entirely static plus a small number of live-bundle checks. I did not execute the migrations, did not have access to a Supabase project, did not run the APK on a device, and did not perform dynamic security testing or penetration testing. The RLS findings in particular are derived from reading the migration SQL — they are well-supported by the policy text but **should be confirmed against a real Supabase instance before you rely on them**, using §13.2.

---

*Audit performed read-only. No files were modified during the audit. No secrets, API keys, tokens or patient health information are reproduced in this report.*