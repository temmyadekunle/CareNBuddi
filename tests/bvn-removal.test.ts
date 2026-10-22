import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  PASSPORT_DEFAULTS,
  stripLegacyBvn,
  type PassportPrefs,
} from "../lib/passport";
import { translate } from "../lib/i18n";

/**
 * BVN removal regression guards.
 *
 * The Bank Verification Number was removed from the Health Passport at
 * explicit request: it had no verification purpose in the app and holding a
 * bank identifier alongside health data is an avoidable privacy risk. These
 * tests pin the removal so it cannot quietly return, while proving that the
 * kept identity data — NIN — and every other passport field survive the
 * legacy-payload scrub.
 */

const root = process.cwd();
const sourceFiles: Record<string, string> = {};
for (const relative of [
  "app/(app)/profile/page.tsx",
  "components/profile-settings.tsx",
  "lib/i18n.ts",
  "lib/dict/yo.ts",
  "lib/dict/ha.ts",
  "lib/dict/ig.ts",
]) {
  sourceFiles[relative] = readFileSync(path.join(root, relative), "utf8");
}

/* ----------------------------------------------- removed from the interface */

test("the passport shape no longer carries a BVN field", () => {
  const keys = Object.keys(PASSPORT_DEFAULTS);
  assert.ok(!keys.includes("bvn"), "PASSPORT_DEFAULTS still contains bvn");
  assert.deepEqual(keys.sort(), ["emergencyContact", "emergencyPhone", "hmo", "nin"]);
});

test("no BVN label or translation key remains in any dictionary", () => {
  for (const [file, source] of Object.entries(sourceFiles)) {
    assert.ok(!source.includes("prof_bvn"), `prof_bvn still present in ${file}`);
  }
  for (const lang of ["en", "yo", "ha", "ig"] as const) {
    // Missing keys fall back to the raw key by contract (translate), so a
    // direct probe without a fallback proves the key is genuinely gone.
    assert.equal(translate(lang, "prof_bvn"), "prof_bvn");
    assert.equal(translate(lang, "prof_bvn_hint"), "prof_bvn_hint");
  }
});

test("the profile interface renders no BVN input", () => {
  const page = sourceFiles["app/(app)/profile/page.tsx"];
  assert.ok(!/BVN \(Bank/i.test(page), "BVN field markup still in the profile page");
  assert.ok(!/passport\.bvn/.test(page), "passport.bvn read/write still in the profile page");
  const settings = sourceFiles["components/profile-settings.tsx"];
  assert.ok(!/bvn: string/.test(settings), "the bvn field is back on PassportPrefs");
  assert.ok(!/bvn: ""/.test(settings), "the bvn default is back on PASSPORT_DEFAULTS");
});

/* ------------------------------------------------- NIN and document upload intact */

test("NIN and the other passport fields are preserved", () => {
  assert.equal(PASSPORT_DEFAULTS.nin, "");
  assert.equal(PASSPORT_DEFAULTS.hmo, "");
  assert.equal(PASSPORT_DEFAULTS.emergencyContact, "");
  assert.equal(PASSPORT_DEFAULTS.emergencyPhone, "");
  // The NIN label must stay translated in all four dictionaries.
  for (const lang of ["en", "yo", "ha", "ig"] as const) {
    const label = translate(lang, "prof_nin");
    assert.notEqual(label, "prof_nin", `prof_nin is missing in ${lang}`);
  }
});

test("the profile page keeps the NIN field and identity-document components", () => {
  const page = sourceFiles["app/(app)/profile/page.tsx"];
  assert.ok(page.includes("prof_nin"), "the NIN field was dropped from the profile page");
  assert.ok(page.includes("inputMode=\"numeric\""), "the numeric NIN input pattern is gone");
  assert.ok(page.includes("ProfileCropper"), "the avatar/photo upload path was touched");
  assert.ok(page.includes("uploadAvatarToCloud"), "the cloud avatar upload path was touched");
});

/* ------------------------------------------------ legacy payload scrub */

test("stripLegacyBvn removes a legacy BVN value and keeps everything else", () => {
  const legacy = {
    hmo: "NHIS-123",
    emergencyContact: "Ada",
    emergencyPhone: "0803",
    nin: "12345678901",
    bvn: "22198765432",
  } as unknown;
  const { clean, hadBvn } = stripLegacyBvn(legacy);
  assert.equal(hadBvn, true, "a legacy payload must be detected");
  assert.equal("bvn" in clean, false, "the scrub must remove the legacy value");
  const prefs = clean as PassportPrefs & Record<string, unknown>;
  assert.equal(prefs.nin, "12345678901");
  assert.equal(prefs.hmo, "NHIS-123");
  assert.equal(prefs.emergencyContact, "Ada");
  assert.equal(prefs.emergencyPhone, "0803");
});

test("stripLegacyBvn passes clean payloads through without flagging a write", () => {
  const cleanPayload: PassportPrefs = {
    hmo: "",
    emergencyContact: "Ada",
    emergencyPhone: "0803",
    nin: "12345678901",
  };
  const { clean, hadBvn } = stripLegacyBvn(cleanPayload);
  assert.equal(hadBvn, false, "a clean payload must not trigger a write or backup push");
  assert.deepEqual(clean, cleanPayload);
});

test("stripLegacyBvn survives garbage storage values", () => {
  for (const garbage of [undefined, null, "not-an-object", 42, [], { bvn: "1" }]) {
    const { clean } = stripLegacyBvn(garbage);
    assert.equal("bvn" in clean, false, `garbage ${JSON.stringify(garbage)} leaked bvn through`);
  }
});
