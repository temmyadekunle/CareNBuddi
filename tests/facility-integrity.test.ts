import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { OPERATING_STATES, PROVIDERS, type Provider } from "../lib/content";
import { GUIDE_STATES, normalizeState } from "../lib/guide-core";
import { NIGERIAN_STATES } from "../lib/states";

/**
 * The facility directory must not publish facts the app cannot stand behind.
 *
 * It used to carry a phone number, a WhatsApp number, a star rating and a
 * "verified" flag for every entry. Those values were invented: no facility had
 * been contacted, so a tap-to-call reached a number that does not belong to the
 * clinic, and a verification badge asserted a review that never happened.
 *
 * These tests pin the removal, and the Abuja/FCT spelling that used to make
 * every FCT facility disappear from the state filter.
 */

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

const detail = read("../app/(app)/find-care/[id]/client.tsx");
const directory = read("../app/(app)/find-care/page.tsx");
const card = read("../components/provider-card.tsx");
const health = read("../components/health.tsx");
const emergency = read("../components/nearby-emergency.tsx");
const home = read("../app/(app)/app/page.tsx");
const guide = read("../components/health-guide.tsx");
const book = read("../components/book-sheet.tsx");
const emergencyPage = read("../app/(app)/emergency/page.tsx");

/* -------------------------------------------- fabricated contact data */

test("no provider record carries a phone, WhatsApp, rating or verified flag", () => {
  for (const provider of PROVIDERS as (Provider & Record<string, unknown>)[]) {
    assert.equal("phone" in provider, false, `${provider.id} still has phone`);
    assert.equal("whatsapp" in provider, false, `${provider.id} still has whatsapp`);
    assert.equal("rating" in provider, false, `${provider.id} still has rating`);
    assert.equal("verified" in provider, false, `${provider.id} still has verified`);
  }
});

test("no facility screen can dial or message a fabricated number", () => {
  for (const [name, src] of [
    ["find-care detail", detail],
    ["provider card", card],
    ["health", health],
    ["nearby emergency", emergency],
    ["home", home],
  ] as const) {
    assert.doesNotMatch(src, /whatsappUrl/, `${name} rebuilt a WhatsApp link`);
    assert.doesNotMatch(src, /wa\.me/, `${name} rebuilt a WhatsApp link`);
    assert.doesNotMatch(src, /tel:\$\{provider\.|tel:\$\{facility\./, `${name} dials a directory entry`);
  }
});

test("emergency screens keep the sourced national number", () => {
  // Removing invented facility numbers must not remove the verified 112 line.
  assert.match(emergencyPage, /112/);
  assert.match(emergencyPage, /cannot send one/);
});

/* ----------------------------------------- verification labels and awards */

test("no facility screen renders a verification badge", () => {
  for (const [name, src] of [
    ["find-care detail", detail],
    ["find-care directory", directory],
    ["provider card", card],
    ["health", health],
    ["nearby emergency", emergency],
    ["home", home],
    ["health guide", guide],
  ] as const) {
    assert.doesNotMatch(src, /\.verified/, `${name} still reads a verified flag`);
    assert.doesNotMatch(src, /f_verified/, `${name} still uses the verified label`);
  }
});

test("the guide no longer ranks facilities by an invented rating", () => {
  assert.doesNotMatch(guide, /\.rating/);
  assert.doesNotMatch(guide, /\.verified/);
});

/* --------------------------------------------------- Abuja / FCT mapping */

test("every provider state is a canonical Nigerian state", () => {
  const canonical = new Set(NIGERIAN_STATES);
  for (const provider of PROVIDERS) {
    assert.ok(canonical.has(provider.state), `${provider.id} has unknown state "${provider.state}"`);
  }
});

test("no provider calls the FCT plain Abuja", () => {
  assert.deepEqual(
    PROVIDERS.filter((p) => p.state === "Abuja").map((p) => p.id),
    [],
  );
  assert.ok(PROVIDERS.some((p) => p.state === "Federal Capital Territory (FCT)"));
});

test("the state filter list has no duplicate or stale entries", () => {
  assert.deepEqual(OPERATING_STATES, NIGERIAN_STATES);
  assert.equal(new Set(OPERATING_STATES).size, OPERATING_STATES.length);
  assert.equal(OPERATING_STATES.includes("Abuja"), false);
});

test("the health guide normalises Abuja to the directory's FCT spelling", () => {
  assert.equal(normalizeState("Abuja"), "Federal Capital Territory (FCT)");
  assert.equal(normalizeState("FCT"), "Federal Capital Territory (FCT)");
  assert.equal(normalizeState("Federal Capital Territory"), "Federal Capital Territory (FCT)");
  // The guide's own allowed list must use the same spelling the directory uses.
  assert.ok(GUIDE_STATES.includes("Federal Capital Territory (FCT)"));
  assert.equal(GUIDE_STATES.includes("Abuja"), false);
});

test("an Abuja guide match finds FCT facilities", () => {
  const state = normalizeState("Abuja");
  assert.ok(PROVIDERS.some((p) => p.state === state));
});

/* ------------------------------------------------- booking claim accuracy */

test("a saved request is not recorded as a confirmed appointment", () => {
  assert.match(book, /status: "new"/);
  assert.doesNotMatch(book, /status: "confirmed"/);
  assert.doesNotMatch(book, /Appointment booked/);
});

test("request screens say the facility has not been contacted", () => {
  assert.match(detail, /has not been contacted/);
  assert.match(book, /has not been contacted/);
  assert.doesNotMatch(detail, /facility will contact you/);
});

test("the detail screen still offers a saved request rather than a booking", () => {
  assert.match(detail, /Request a visit/);
  assert.match(detail, /fc_no_contact/);
});
