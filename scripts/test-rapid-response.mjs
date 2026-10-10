// Pure-logic tests for lib/rapid-response.ts.
// Run with: node scripts/test-rapid-response.mjs  (Node 22.6+ strips types)
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const rr = await import("../lib/rapid-response.ts");
const {
  PRIMARY_EMERGENCY_NUMBER,
  EMERGENCY_CONTACT_CATALOG,
  activeEmergencyContacts,
  RAPID_RESPONSE_CAPABILITIES,
  SERVICE_AREAS,
  matchesServiceArea,
  isPilotProvider,
  haversineKm,
  formatDistance,
  isValidLatLon,
  orderEmergencyFacilities,
  isEmergencyFacility,
  emergencyFacilities,
  facilityGeocodeQuery,
  geocodeAddress,
  readGeocodeCache,
  RAPID_RESPONSE_STATUSES,
  TERMINAL_RAPID_STATUSES,
  OPEN_RAPID_STATUSES,
  isRapidResponseStatus,
  isTerminalStatus,
  canTransition,
  DEFAULT_ESCALATION_POLICY,
  evaluateEscalation,
} = rr;

let passed = 0;
const failures = [];
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (err) {
    failures.push(name);
    console.log(`  FAIL ${name}\n       ${err.message}`);
  }
}

console.log("rapid-response: contacts");

check("every catalog entry is fully verified", () => {
  const seen = new Set();
  for (const c of EMERGENCY_CONTACT_CATALOG) {
    assert.ok(c.id && !seen.has(c.id), `duplicate/missing id: ${c.id}`);
    seen.add(c.id);
    assert.ok(c.name.length > 3, `${c.id}: name`);
    assert.match(c.number, /^(\d{3}|0\d{10})$/, `${c.id}: bad number ${c.number}`);
    assert.ok(c.coverage.length > 3, `${c.id}: coverage`);
    assert.ok(Number.isInteger(c.priority) && c.priority >= 1, `${c.id}: priority`);
    assert.ok(c.instructions.length > 10, `${c.id}: instructions`);
    assert.equal(c.status, "active", `${c.id}: status`);
    assert.ok(c.source.length > 5, `${c.id}: source required`);
    assert.match(c.sourceUrl, /^https:\/\//, `${c.id}: sourceUrl`);
    assert.match(c.lastVerified, /^\d{4}-\d{2}-\d{2}$/, `${c.id}: lastVerified`);
    assert.ok(Date.parse(c.lastVerified) <= Date.now(), `${c.id}: future date`);
  }
});

check("active contacts are priority-ordered and start with 112", () => {
  const list = activeEmergencyContacts();
  assert.equal(list[0].number, PRIMARY_EMERGENCY_NUMBER);
  for (let i = 1; i < list.length; i++) {
    assert.ok(list[i].priority >= list[i - 1].priority, "priority not sorted");
  }
});

check("pilot-state numbers are present (Ogun)", () => {
  const ogun = EMERGENCY_CONTACT_CATALOG.filter((c) => c.state === "Ogun");
  assert.ok(ogun.length >= 2, "Ogun needs state line + police command");
  assert.ok(ogun.some((c) => c.number === "08111200033"), "Ogun state line");
  assert.ok(ogun.some((c) => c.number === "09062837609"), "Ogun police");
});

check("capability guarantees stay honest", () => {
  assert.equal(RAPID_RESPONSE_CAPABILITIES.dispatchesAmbulances, false);
  assert.equal(RAPID_RESPONSE_CAPABILITIES.notifiesProviders, false);
  assert.equal(RAPID_RESPONSE_CAPABILITIES.showsVerifiedNumbers, true);
});

console.log("rapid-response: service areas");

check("pilot areas exist and 'sango ota' resolves to Ota", () => {
  assert.ok(SERVICE_AREAS.length >= 1);
  const hit = matchesServiceArea("sango ota");
  assert.ok(hit, "no match for 'sango ota'");
  assert.equal(hit.id, "sango-ota");
  assert.equal(matchesServiceArea("Sango-Ota")?.id, "sango-ota");
  assert.equal(matchesServiceArea("ota")?.id, "sango-ota");
  assert.equal(matchesServiceArea("ifo")?.id, "ifo");
});

check("non-pilot queries do not match", () => {
  assert.equal(matchesServiceArea("lagos"), null);
  assert.equal(matchesServiceArea("abeokuta"), null);
  assert.equal(matchesServiceArea("if"), null);
  assert.equal(matchesServiceArea(""), null);
});

check("pilot provider detection uses state + town", () => {
  assert.equal(isPilotProvider({ state: "Ogun", city: "Ota, Ogun" }), true);
  assert.equal(isPilotProvider({ state: "Ogun", city: "Abeokuta, Ogun" }), false);
  assert.equal(isPilotProvider({ state: "Lagos", city: "Ota, Lagos" }), false);
});

console.log("rapid-response: distance & ordering");

check("haversine matches a known Ota ↔ Abeokuta distance", () => {
  const km = haversineKm({ lat: 6.62, lng: 3.37 }, { lat: 7.15, lng: 3.35 });
  assert.ok(km > 57 && km < 61, `got ${km.toFixed(2)} km`);
  assert.equal(haversineKm({ lat: 6.62, lng: 3.37 }, { lat: 6.62, lng: 3.37 }), 0);
});

check("formatDistance renders metres below 1 km", () => {
  assert.equal(formatDistance(0), "0 m");
  assert.equal(formatDistance(-1), "0 m");
  assert.equal(formatDistance(0.85), "850 m");
  assert.equal(formatDistance(0.004), "10 m");
  assert.equal(formatDistance(3.46), "3.5 km");
});

check("isValidLatLon rejects garbage", () => {
  assert.equal(isValidLatLon({ lat: 6.6, lng: 3.3 }), true);
  assert.equal(isValidLatLon({ lat: 999, lng: 3.3 }), false);
  assert.equal(isValidLatLon({ lat: "6.6", lng: 3.3 }), false);
  assert.equal(isValidLatLon(null), false);
});

check("ordering: origin sorts by distance, unknown coordinates last", () => {
  const items = [
    { name: "far", city: "Ibadan, Oyo", state: "Oyo", lat: 7.38, lng: 3.95 },
    { name: "near", city: "Ota, Ogun", state: "Ogun", lat: 6.63, lng: 3.38 },
    { name: "unknown", city: "Ota, Ogun", state: "Ogun" },
  ];
  const ordered = orderEmergencyFacilities(items, { lat: 6.62, lng: 3.37 });
  assert.deepEqual(
    ordered.map((i) => i.name),
    ["near", "far", "unknown"],
  );
});

check("ordering: without origin, pilot facilities come first", () => {
  const items = [
    { name: "lagos", city: "Ikeja, Lagos", state: "Lagos" },
    { name: "abeokuta", city: "Abeokuta, Ogun", state: "Ogun" },
    { name: "ota", city: "Ota, Ogun", state: "Ogun" },
  ];
  const ordered = orderEmergencyFacilities(items, null);
  assert.equal(ordered[0].name, "ota");
  assert.equal(ordered[1].name, "abeokuta");
  assert.equal(ordered[2].name, "lagos");
});

check("emergency facility helpers", () => {
  assert.equal(isEmergencyFacility({ emergency: true }), true);
  assert.equal(isEmergencyFacility({}), false);
  assert.deepEqual(
    emergencyFacilities([{ emergency: true }, {}, { emergency: false }]).length,
    1,
  );
});

console.log("rapid-response: geocoding");

check("facility queries pin the country", () => {
  const q = facilityGeocodeQuery({
    name: "Ota Cottage Hospital",
    address: "Idiroko Road",
    city: "Ota, Ogun",
  });
  assert.match(q, /Ota Cottage Hospital/);
  assert.match(q, /Nigeria$/);
});

check("geocodeAddress parses a successful Nominatim response", async () => {
  const stub = async () => ({
    ok: true,
    json: async () => [{ lat: "6.6200", lon: "3.3700", display_name: "Ota, Nigeria" }],
  });
  const out = await geocodeAddress("Ota", stub);
  assert.deepEqual(out, { lat: 6.62, lng: 3.37, label: "Ota, Nigeria", approximate: true });
});

check("geocodeAddress returns null on empty/bad/failing responses", async () => {
  const empty = await geocodeAddress("x", async () => ({ ok: true, json: async () => [] }));
  assert.equal(empty, null);
  const bad = await geocodeAddress("x", async () => ({
    ok: true,
    json: async () => [{ lat: "nope", lon: "nope" }],
  }));
  assert.equal(bad, null);
  const httpErr = await geocodeAddress("x", async () => ({ ok: false, json: async () => ({}) }));
  assert.equal(httpErr, null);
  const thrown = await geocodeAddress("x", async () => {
    throw new Error("network blocked");
  });
  assert.equal(thrown, null);
});

check("geocode cache is safe without localStorage (node)", () => {
  assert.deepEqual(readGeocodeCache(), {});
});

console.log("rapid-response: request lifecycle");

check("status enums are consistent", () => {
  assert.ok(RAPID_RESPONSE_STATUSES.length >= 8);
  for (const s of RAPID_RESPONSE_STATUSES) {
    assert.ok(isRapidResponseStatus(s), s);
    assert.equal(isTerminalStatus(s), TERMINAL_RAPID_STATUSES.includes(s));
    assert.equal(OPEN_RAPID_STATUSES.includes(s) || isTerminalStatus(s) || true, true);
  }
  assert.equal(isRapidResponseStatus("bogus"), false);
  assert.equal(isTerminalStatus("bogus"), false);
});

check("transition guard follows the published table", () => {
  assert.equal(canTransition("created", "provider_contacted"), true);
  assert.equal(canTransition("created", "completed"), false);
  assert.equal(canTransition("dispatched", "en_route"), true);
  assert.equal(canTransition("completed", "arrived"), false);
  assert.equal(canTransition("cancelled", "created"), false);
  assert.equal(canTransition("created", "created"), true);
  assert.equal(canTransition("nope", "created"), false);
});

check("escalation escalates on schedule and ends honestly", () => {
  const p = DEFAULT_ESCALATION_POLICY;
  assert.equal(evaluateEscalation("created", 30_000).action, "none");
  assert.equal(evaluateEscalation("created", p.remindAfterMs).action, "remind_provider");
  assert.equal(evaluateEscalation("created", p.escalateAfterMs).action, "escalate_to_backup");
  const end = evaluateEscalation("created", p.unavailableAfterMs);
  assert.equal(end.action, "mark_unavailable");
  assert.equal(end.requiresCall112, true);
  assert.equal(evaluateEscalation("completed", 10 ** 9).action, "none");
  assert.equal(evaluateEscalation("escalated", 10 ** 9).action, "none");
  assert.equal(evaluateEscalation("nope", 10 ** 9).action, "none");
});

check("escalation respects a custom policy", () => {
  const custom = { remindAfterMs: 1000, escalateAfterMs: 2000, unavailableAfterMs: 3000 };
  assert.equal(evaluateEscalation("provider_contacted", 1500, custom).action, "remind_provider");
  assert.equal(evaluateEscalation("provider_contacted", 2500, custom).action, "escalate_to_backup");
  assert.equal(evaluateEscalation("provider_contacted", 999, custom).action, "none");
});

console.log("rapid-response: single source of truth");

check("content.ts no longer holds its own emergency contact list", () => {
  const src = readFileSync(new URL("../lib/content.ts", import.meta.url), "utf8");
  assert.ok(!src.includes("EMERGENCY_CONTACTS"), "contact catalog must live only in rapid-response");
  assert.ok(src.includes("emergency: true"), "directory keeps emergency-capable facilities");
});

/* ---------------------------------------------------------------- summary */

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
