# Rapid Response — operations & integration guide

Rapid Response gives people in the pilot area (Sango Ota / Ota / Ifo, Ogun
State) fast access to **verified** emergency numbers, nearby emergency-capable
facilities (list + map), and an honest description of what the product can and
cannot do. This document is the operational boundary: it tells a future
partner/ops team how the pieces work and what must be done by hand.

## What ships (MVP)

- `/emergency` hub: tap-to-call catalog of **verified** national and
  pilot-area numbers, each with source, source URL and `lastVerified` date.
- Home card → "Need Emergency Help?" with `Call Emergency Services` (tel:112)
  and `Find Nearby Emergency Care` (`/emergency#nearby`).
- Nearby emergency care: list view (default) with call + directions, optional
  distance sorting behind an explicit geolocation prompt, and a List/Map
  toggle (Leaflet + OpenStreetMap tiles).
- Layered AI safety in the Health Guide (existing): emergency signals always
  short-circuit to `tel:112` + `/emergency`.
- Schema for future coordination: `supabase/migrations/0002_rapid_response.sql`.

## What deliberately does NOT ship

| Missing | Why |
| --- | --- |
| Ambulance dispatch / "request an ambulance" | No partner. Simulating dispatch would be dishonest. |
| Provider notification (push/SMS) | Requires infrastructure + partner agreements. |
| Provider/ops dashboard UI | Built when the first partner activates; the schema and RLS already exist. |
| Surveyed facility coordinates | None of the seed facilities publish lat/lng; see below. |

The client-side guard rails live in `lib/rapid-response.ts`:

```ts
RAPID_RESPONSE_CAPABILITIES = {
  dispatchesAmbulances: false,   // enforced by test
  notifiesProviders: false,
  showsVerifiedNumbers: true,
  showsEmergencyFacilities: true,
  callsAreDirectTelLinks: true,
}
```

## Emergency number catalog (verification workflow)

Single source of truth: `EMERGENCY_CONTACT_CATALOG` in
`lib/rapid-response.ts`. `lib/content.ts` no longer carries its own copy.

Every entry requires:

| Field | Rule |
| --- | --- |
| `number` | 3-digit short code or 11-digit NG number (`/^(\d{3}|0\d{10})$/`) |
| `source` + `sourceUrl` | Official (`.gov.ng`, agency site, official account) or reputable published directory |
| `lastVerified` | ISO date of the last manual check |
| `status` | `active` shown; `unverified` hidden from the UI |

**Adding/re-checking a number**

1. Verify against an official source (NCC, NEMSAS, state command, agency
   site). If you cannot find a source you would stake a life on, do not add
   the number.
2. Add/refresh the entry (number, source, `sourceUrl`, `lastVerified`).
3. Run `node scripts/test-rapid-response.mjs` — it fails on missing sources,
   future dates, bad number formats, or an unordered priority list.
4. Re-check **all** entries at least every 90 days; update `lastVerified`
   dates in the same commit.

Current catalog (checked 2026-10-09): 112 (NCC NNP/ITU filing + NEMSAS),
Ogun State 08111200033 (NEMSAS via Voice of Nigeria), 199 (NSCDC official),
Ogun Police Command 09062837609 (@OgunPoliceNG official account), FRSC 122,
Lagos 767 (NEMSAS).

## Pilot coverage & expansion

`SERVICE_AREAS` (same file) is the only place geography is configured.
Expansion = append an entry (name, state, LGAs, cities, aliases). The alias
`"sango ota"` resolves to the town of `Ota`, which is how the directory stores
it (`city: "Ota, Ogun"`). Nothing else in the app hardcodes the pilot.

## Facilities, the map and coordinates

- Emergency-capable facilities are the existing directory records with
  `emergency: true` (18 currently, 2 in Ogun: Ota Cottage Hospital and an
  Abeokuta facility).
- There is **no** surveyed lat/lng in the directory. The map resolves
  addresses at runtime through OpenStreetMap Nominatim (≤1 request/second,
  max 10 per session, cached in localStorage under
  `healthlink:geocode-cache`), and the UI labels every position and distance
  as approximate. Facilities that fail to resolve stay in the list; they are
  never dropped and never given invented coordinates.
- Map failure modes (tile CDN blocked, offline, import error) fall back to an
  ErrorState with a one-tap switch to the list. The list never depends on the
  map.
- **Coordinate onboarding (future partner data):** once a partner publishes
  real coordinates, add optional `lat`/`lng` fields to `Provider` and store
  them — `orderEmergencyFacilities()` already prefers known coordinates and
  falls back to pilot-first ordering when origin/coordinates are unknown.

## Ambulance architecture (honest by design)

User-facing truth: **call 112 first; CareNBuddi does not dispatch.** The
"Need an ambulance?" card on `/emergency` says exactly that and offers the
national line and the Ogun State line as direct tel links.

For when a partner exists, the coordination model is already defined in
`lib/rapid-response.ts` and mirrored by the SQL schema:

- Status machine: `RAPID_RESPONSE_STATUSES` +
  `RAPID_STATUS_TRANSITIONS` (guarded by `canTransition()`); the SQL `check`
  constraint mirrors the same list.
- Escalation policy (`DEFAULT_ESCALATION_POLICY`):

  | Elapsed (open request) | Action |
   | --- | --- |
  | ≥ 2 min | `remind_provider` |
  | ≥ 5 min | `escalate_to_backup` |
  | ≥ 15 min | `mark_unavailable` + tell the user to call 112 |

  `evaluateEscalation(status, elapsedMs)` is pure and unit-tested; terminal
  states (`completed`, `unavailable`, `cancelled`) never escalate.
- Audit: every transition is expected to append to
  `emergency_request_events` (append-only, staff-written, requester-readable).

## RBAC / operations boundary

| Actor | `emergency_requests` | `emergency_request_events` | `provider_emergency_participation` |
| --- | --- | --- | --- |
| Anonymous / requester | INSERT own (`user_id = auth.uid()` or null), SELECT own | SELECT own request's history | SELECT (public) |
| Provider / admin (`is_staff()`) | SELECT, UPDATE (status machine) | SELECT all, INSERT | SELECT, all writes |
| Browser (RLS enforced) | cannot move statuses | cannot append events | cannot self-activate |

The app enforces the same boundary client-side: `/worker`, `/provider`,
`/admin` remain behind `AppGuard`'s `STAFF_PATHS` role gate. `/emergency`
stays guest-accessible on purpose.

## Tests & checks

```bash
node scripts/test-rapid-response.mjs   # catalog honesty, areas, distances,
                                       # geocoding, statuses, escalation
npm run lint                           # baseline: 3 problems (1 error, 2 warnings)
node scripts/check-i18n.mjs
node scripts/audit-pages.mjs
npm run build                          # static export must stay green
```
