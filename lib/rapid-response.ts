/**
 * Rapid Response — verified emergency data and coordination logic.
 *
 * This module is deliberately pure: no React, Next, DOM or content imports.
 * scripts/test-rapid-response.mjs imports this file directly under Node's
 * TypeScript type stripping, and the UI components consume the same
 * functions — one source of truth for contacts, pilot coverage, distances,
 * request statuses and the escalation policy.
 *
 * Verification rule: every published number carries a named source, a source
 * URL and the date it was last checked. Numbers that could not be verified
 * against an official or reputable published source are never listed — a
 * wrong emergency number is worse than a missing one.
 */

/* ------------------------------------------------------- verified contacts */

export type EmergencyServiceType =
  | "all_services"
  | "state_emergency"
  | "civil_defence"
  | "police"
  | "road_traffic";

export type EmergencyContactStatus = "active" | "unverified";

export interface VerifiedEmergencyContact {
  id: string;
  name: string;
  serviceType: EmergencyServiceType;
  number: string;
  coverage: string;
  state?: string;
  priority: number;
  instructions: string;
  status: EmergencyContactStatus;
  source: string;
  sourceUrl: string;
  lastVerified: string;
}

export const PRIMARY_EMERGENCY_NUMBER = "112";

/**
 * National + pilot-area numbers, ordered by priority (1 = call first).
 * Verified 2026-10-09. Re-verification workflow: docs/rapid-response.md.
 */
export const EMERGENCY_CONTACT_CATALOG: readonly VerifiedEmergencyContact[] = [
  {
    id: "ng-112",
    name: "National emergency line",
    serviceType: "all_services",
    number: "112",
    coverage: "Nationwide",
    priority: 1,
    instructions:
      "One toll-free number for police, ambulance, fire and road safety. Say your exact location first.",
    status: "active",
    source:
      "NCC National Numbering Plan (ITU-T E.129) filing; NEMSAS public guidance",
    sourceUrl:
      "https://www.ncc.gov.ng/sites/default/files/2024-11/PRESENTATION-OF-EMERGENCY-SERVICES-NUMBER-TO-ITU-ACCORDING-TO-NIGERIA'S-NATIONAL-NUMBERING-PLAN-(NNP).pdf",
    lastVerified: "2026-10-09",
  },
  {
    id: "og-state-emergency",
    name: "Ogun State emergency line",
    serviceType: "state_emergency",
    number: "08111200033",
    coverage: "Ogun State (incl. Sango Ota)",
    state: "Ogun",
    priority: 2,
    instructions:
      "Ogun State emergency call centre. Use if 112 does not connect.",
    status: "active",
    source: "NEMSAS emergency contact guide (Voice of Nigeria, Aug 2026)",
    sourceUrl: "https://von.gov.ng/nemsas-reaffirms-112-emergency-medical-line",
    lastVerified: "2026-10-09",
  },
  {
    id: "ng-199",
    name: "Civil Defence & rescue hotline",
    serviceType: "civil_defence",
    number: "199",
    coverage: "Nationwide",
    priority: 3,
    instructions:
      "NSCDC 24/7 hotline, widely used as a police/rescue shortcut. Dial 112 first for life-threatening emergencies.",
    status: "active",
    source: "NSCDC official website; Pulse Nigeria state directory (Jun 2026)",
    sourceUrl: "https://nscdc.gov.ng/",
    lastVerified: "2026-10-09",
  },
  {
    id: "og-police-command",
    name: "Ogun State Police Command",
    serviceType: "police",
    number: "09062837609",
    coverage: "Ogun State",
    state: "Ogun",
    priority: 4,
    instructions:
      "Command emergency line. Toll-free complaints line: 08000009111.",
    status: "active",
    source: "Official Ogun State Police Command account (@OgunPoliceNG)",
    sourceUrl: "https://x.com/OgunPoliceNG",
    lastVerified: "2026-10-09",
  },
  {
    id: "ng-122-frsc",
    name: "Road traffic emergencies (FRSC)",
    serviceType: "road_traffic",
    number: "122",
    coverage: "Nationwide",
    priority: 5,
    instructions:
      "Federal Road Safety Corps — road crashes and blocked highways.",
    status: "active",
    source: "Pulse Nigeria state directory (Jun 2026); HEI helpline list",
    sourceUrl:
      "https://www.pulse.ng/story/nigeria-emergency-numbers-state-directory-2026062213515128457",
    lastVerified: "2026-10-09",
  },
  {
    id: "lag-767",
    name: "Lagos State emergency line",
    serviceType: "state_emergency",
    number: "767",
    coverage: "Lagos State",
    state: "Lagos",
    priority: 6,
    instructions:
      "Lagos emergency service (police, ambulance, traffic). 112 also works.",
    status: "active",
    source: "NEMSAS emergency contact guide (Voice of Nigeria, Aug 2026)",
    sourceUrl: "https://von.gov.ng/nemsas-reaffirms-112-emergency-medical-line",
    lastVerified: "2026-10-09",
  },
];

export function activeEmergencyContacts(): VerifiedEmergencyContact[] {
  return EMERGENCY_CONTACT_CATALOG.filter((c) => c.status === "active").sort(
    (a, b) => a.priority - b.priority,
  );
}

/**
 * What the product does and — just as importantly — does not do. Kept as
 * data so tests can assert the honesty guarantees stay intact.
 */
export const RAPID_RESPONSE_CAPABILITIES = {
  dispatchesAmbulances: false,
  notifiesProviders: false,
  showsVerifiedNumbers: true,
  showsEmergencyFacilities: true,
  callsAreDirectTelLinks: true,
} as const;

/* --------------------------------------------------- pilot service areas */

export interface ServiceArea {
  id: string;
  name: string;
  state: string;
  lgas: string[];
  cities: string[];
  aliases: string[];
}

/**
 * Pilot coverage. Expansion = add an entry; nothing else hardcodes geography.
 * The alias "sango ota" resolves to the town of Ota, which is how the
 * directory stores it (`city: "Ota, Ogun"`).
 */
export const SERVICE_AREAS: readonly ServiceArea[] = [
  {
    id: "sango-ota",
    name: "Sango Ota",
    state: "Ogun",
    lgas: ["Ado-Odo/Ota"],
    cities: ["Sango-Ota", "Ota"],
    aliases: ["sango", "adoodo", "ado odo"],
  },
  {
    id: "ifo",
    name: "Ifo",
    state: "Ogun",
    lgas: ["Ifo"],
    cities: ["Ifo"],
    aliases: [],
  },
];

function normalizePlace(value: string): string {
  return value
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/[,\s]+/g, " ")
    .trim();
}

export function matchesServiceArea(query: string): ServiceArea | null {
  const norm = normalizePlace(query);
  if (norm.length < 3) return null;
  for (const area of SERVICE_AREAS) {
    const terms = [...area.cities, ...area.aliases, ...area.lgas].map(
      normalizePlace,
    );
    for (const term of terms) {
      if (norm === term || norm.includes(term) || (norm.length >= 3 && term.includes(norm))) {
        return area;
      }
    }
  }
  return null;
}

export function isPilotProvider(p: { state: string; city: string }): boolean {
  const city = normalizePlace(p.city);
  return SERVICE_AREAS.some(
    (area) =>
      area.state === p.state &&
      [...area.cities, ...area.aliases, ...area.lgas].some((term) =>
        city.includes(normalizePlace(term)),
      ),
  );
}

/* -------------------------------------------------- distance & ordering */

export interface LatLon {
  lat: number;
  lng: number;
}

export function haversineKm(a: LatLon, b: LatLon): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km <= 0) return "0 m";
  const meters = km * 1000;
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  return `${km.toFixed(1)} km`;
}

export function isValidLatLon(value: unknown): value is LatLon {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { lat?: unknown; lng?: unknown };
  return (
    typeof v.lat === "number" &&
    typeof v.lng === "number" &&
    Number.isFinite(v.lat) &&
    Number.isFinite(v.lng) &&
    v.lat >= -90 &&
    v.lat <= 90 &&
    v.lng >= -180 &&
    v.lng <= 180
  );
}

/**
 * Ordering used by the emergency page:
 *  - with an origin: known coordinates first, nearest first; unknown last.
 *  - without an origin: pilot-area facilities first, then alphabetical.
 * Facilities without coordinates are never dropped and never faked.
 */
export function orderEmergencyFacilities<
  T extends { name: string; state: string; city: string; lat?: number; lng?: number },
>(items: readonly T[], origin: LatLon | null): T[] {
  const located = items.filter(
    (item) => typeof item.lat === "number" && typeof item.lng === "number",
  );
  const unlocated = items.filter(
    (item) => typeof item.lat !== "number" || typeof item.lng !== "number",
  );
  const byPilotThenName = (a: T, b: T) => {
    const pilot = Number(isPilotProvider(b)) - Number(isPilotProvider(a));
    if (pilot !== 0) return pilot;
    return a.city.localeCompare(b.city) || a.name.localeCompare(b.name);
  };
  if (!origin) {
    return [...items].sort(byPilotThenName);
  }
  const sortedLocated = [...located].sort(
    (a, b) =>
      haversineKm(origin, { lat: a.lat as number, lng: a.lng as number }) -
      haversineKm(origin, { lat: b.lat as number, lng: b.lng as number }),
  );
  return [...sortedLocated, ...unlocated.sort(byPilotThenName)];
}

export function isEmergencyFacility(p: { emergency?: boolean }): boolean {
  return p.emergency === true;
}

export function emergencyFacilities<
  T extends { emergency?: boolean },
>(items: readonly T[]): T[] {
  return items.filter(isEmergencyFacility);
}

/* ------------------------------------------------------------ geocoding */

export const GEOCODE_CACHE_KEY = "healthlink:geocode-cache";

export interface GeocodeResult {
  lat: number;
  lng: number;
  label: string;
  approximate: true;
}

export function facilityGeocodeQuery(f: {
  name: string;
  address: string;
  city: string;
}): string {
  // Use address + town (first part of city) for cleaner Nominatim queries
  const town = f.city.split(",")[0].trim();
  return `${f.address}, ${town}, Nigeria`.replace(/\s*,\s*,/g, ",");
}

type FetchLike = (
  input: string,
  init?: { signal?: AbortSignal },
) => Promise<{
  ok: boolean;
  json: () => Promise<unknown>;
}>;

/**
 * Runtime lookup through OpenStreetMap Nominatim. Results are approximate
 * (resolved from the written address, not surveyed) — the UI must label them
 * as such. One call per facility, cached by the caller.
 */
export async function geocodeAddress(
  query: string,
  fetcher: FetchLike = fetch as unknown as FetchLike,
): Promise<GeocodeResult | null> {
  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ng&q=" +
    encodeURIComponent(query);
  try {
    const res = await fetcher(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const first = rows[0] as { lat?: unknown; lon?: unknown; display_name?: unknown };
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (!isValidLatLon({ lat, lng })) return null;
    return {
      lat,
      lng,
      label: typeof first.display_name === "string" && first.display_name ? first.display_name : query,
      approximate: true,
    };
  } catch {
    return null;
  }
}

export function readGeocodeCache(): Record<string, GeocodeResult> {
  try {
    if (typeof localStorage === "undefined") return {};
    const raw = localStorage.getItem(GEOCODE_CACHE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const out: Record<string, GeocodeResult> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isValidLatLon(value)) {
        out[key] = {
          lat: value.lat,
          lng: value.lng,
          label: "",
          approximate: true,
        };
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function writeGeocodeCache(cache: Record<string, GeocodeResult>): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* storage unavailable — geocoding just re-runs next visit */
  }
}

/* --------------------------------------------------- request lifecycle */

export const RAPID_RESPONSE_STATUSES = [
  "created",
  "provider_contacted",
  "accepted",
  "dispatched",
  "en_route",
  "arrived",
  "completed",
  "unavailable",
  "escalated",
  "cancelled",
] as const;

export type RapidResponseStatus = (typeof RAPID_RESPONSE_STATUSES)[number];

export const TERMINAL_RAPID_STATUSES: readonly RapidResponseStatus[] = [
  "completed",
  "unavailable",
  "cancelled",
];

/** Statuses that are still waiting on a provider to engage. */
export const OPEN_RAPID_STATUSES: readonly RapidResponseStatus[] = [
  "created",
  "provider_contacted",
];

export function isRapidResponseStatus(value: string): value is RapidResponseStatus {
  return (RAPID_RESPONSE_STATUSES as readonly string[]).includes(value);
}

export function isTerminalStatus(status: string): boolean {
  return (TERMINAL_RAPID_STATUSES as readonly string[]).includes(status);
}

export const RAPID_STATUS_TRANSITIONS: Record<
  RapidResponseStatus,
  readonly RapidResponseStatus[]
> = {
  created: ["provider_contacted", "escalated", "unavailable", "cancelled"],
  provider_contacted: ["accepted", "escalated", "unavailable", "cancelled"],
  accepted: ["dispatched", "escalated", "unavailable", "cancelled"],
  dispatched: ["en_route", "unavailable", "cancelled"],
  en_route: ["arrived", "unavailable", "cancelled"],
  arrived: ["completed", "unavailable"],
  completed: [],
  unavailable: [],
  escalated: ["provider_contacted", "accepted", "unavailable", "cancelled"],
  cancelled: [],
};

export function canTransition(from: string, to: string): boolean {
  if (!isRapidResponseStatus(from) || !isRapidResponseStatus(to)) return false;
  if (from === to) return true;
  return RAPID_STATUS_TRANSITIONS[from].includes(to);
}

/* ------------------------------------------------------- escalation */

export interface EscalationPolicy {
  remindAfterMs: number;
  escalateAfterMs: number;
  unavailableAfterMs: number;
}

/**
 * Time-based escalation while a request is still open. The final action is
 * always honest: mark the request unavailable and send the user back to the
 * national line — CareNBuddi never simulates a dispatch it cannot perform.
 */
export const DEFAULT_ESCALATION_POLICY: EscalationPolicy = {
  remindAfterMs: 2 * 60_000,
  escalateAfterMs: 5 * 60_000,
  unavailableAfterMs: 15 * 60_000,
};

export type EscalationAction =
  | "none"
  | "remind_provider"
  | "escalate_to_backup"
  | "mark_unavailable";

export interface EscalationDecision {
  action: EscalationAction;
  requiresCall112: boolean;
}

export function evaluateEscalation(
  status: string,
  elapsedMs: number,
  policy: EscalationPolicy = DEFAULT_ESCALATION_POLICY,
): EscalationDecision {
  const none: EscalationDecision = { action: "none", requiresCall112: false };
  if (!isRapidResponseStatus(status)) return none;
  if (isTerminalStatus(status)) return none;
  if (!OPEN_RAPID_STATUSES.includes(status)) return none;
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return none;
  if (elapsedMs >= policy.unavailableAfterMs) {
    return { action: "mark_unavailable", requiresCall112: true };
  }
  if (elapsedMs >= policy.escalateAfterMs) {
    return { action: "escalate_to_backup", requiresCall112: false };
  }
  if (elapsedMs >= policy.remindAfterMs) {
    return { action: "remind_provider", requiresCall112: false };
  }
  return none;
}

/** Mirrors the table in supabase/migrations/0002_rapid_response.sql. */
export interface RapidRequestRecord {
  id: string;
  requesterName: string;
  requesterPhone: string;
  locationText: string;
  areaId: string | null;
  status: RapidResponseStatus;
  providerId: string | null;
  createdAtMs: number;
  updatedAtMs: number;
}
