import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import {
  adoptedLang,
  applyDocumentLang,
  guideLanguageName,
  languagePatch,
} from "../lib/lang-decision";
import { isLang, LANGS } from "../lib/lang";
import { changeLanguage, translate } from "../lib/i18n";
import type { Session } from "../lib/storage";
import { KEYS, readLocal } from "../lib/storage";
import {
  guideReplyLanguageDirective,
  normalizeGuideLang,
} from "../lib/guide-core";
import { endUserSession } from "../lib/session";

/**
 * Language selection + internationalisation.
 *
 * Rules under test (see lib/lang-decision.ts for the write-up):
 *   - default is English; every supported language is selectable;
 *   - at sign-in/restore a supported server preference wins, otherwise the
 *     device choice stands (incl. corrupted values never crashing);
 *   - the choice survives refresh/navigation/sign-out/in-memory changes;
 *   - switching languages never touches the signed-in user's identity and
 *     never sends anything except the language column to the profile;
 *   - the document language attribute is applied;
 *   - AI-guide language directives keep enum values in English.
 */

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  key(i: number) { return Array.from(this.map.keys())[i] ?? null; }
  removeItem(k: string) { this.map.delete(k); }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
}

const store = new MemoryStorage();
(globalThis as unknown as { localStorage: Storage }).localStorage = store;

beforeEach(() => store.clear());

/* ----------------------------------------------- supported language codes */

test("the four languages are defined and isLang accepts exactly them", () => {
  assert.deepEqual(
    LANGS.map((l) => l.code),
    ["en", "yo", "ha", "ig"],
  );
  for (const l of LANGS) assert.equal(isLang(l.code), true);
  for (const bad of [undefined, null, "", "fr", "EN", "yoo", 1, {}, true]) {
    assert.equal(isLang(bad), false);
  }
});

/* ------------------------------------------- conflict rule at sign-in */

test("a supported server preference wins at sign-in/restore", () => {
  const result = adoptedLang({ lang: "en" }, "yo");
  assert.deepEqual(result, { lang: "yo", source: "server" });
});

test("with no server preference the device choice — including a guest's — stands", () => {
  assert.deepEqual(adoptedLang({ lang: "ig" }, undefined), {
    lang: "ig",
    source: "device",
  });
  assert.deepEqual(adoptedLang({ lang: "ha" }, null), {
    lang: "ha",
    source: "device",
  });
  assert.deepEqual(adoptedLang({ lang: "yo" }, "nonsense-value"), {
    lang: "yo",
    source: "device",
  });
});

test("no session at all falls back to the seeded default (English)", () => {
  assert.deepEqual(adoptedLang(null, null), { lang: "en", source: "device" });
  assert.deepEqual(adoptedLang(undefined, ""), { lang: "en", source: "device" });
});

test("a corrupted session language value never crashes adoption", () => {
  assert.deepEqual(adoptedLang({ lang: { hostile: true } }, null), {
    lang: "en",
    source: "device",
  });
});

/* ------------------------------------------- language switch, session intact */

test("switching languages keeps the signed-in user attached", () => {
  const session: Session = { userId: "user-1", lang: "en" };
  const next = changeLanguage(session, "yo");
  assert.equal(next.lang, "yo");
  assert.equal(next.userId, "user-1", "identity must not be reset by a language change");
  assert.notEqual(next, session, "a new object must be produced for React state");
});

test("the choice persists across a simulated refresh", () => {
  store.setItem(KEYS.session, JSON.stringify({ userId: "user-1", lang: "ha" }));
  const session = readLocal<Session>(KEYS.session);
  assert.equal(session?.lang, "ha");
  assert.equal(session?.userId, "user-1");
});

test("language survives logout and the user pointer does not", () => {
  store.setItem(KEYS.session, JSON.stringify({ userId: "user-1", lang: "yo" }));
  endUserSession("user-1", "signout");
  const session = JSON.parse(store.getItem(KEYS.session)!);
  assert.equal(session.userId, null);
  assert.equal(session.lang, "yo", "the pre-logout device choice must survive");
});

/* ------------------------------------------- profile patch is scoped */

test("the profile patch contains ONLY the language column", () => {
  assert.deepEqual(languagePatch("ig"), { lang: "ig" });
  assert.deepEqual(Object.keys(languagePatch("en")), ["lang"]);
  assert.throws(() => languagePatch("de" as never), /invalid-lang/);
});

/* ------------------------------------------- document attribute */

test("applyDocumentLang sets <html lang> and tolerates no document", () => {
  const doc = { documentElement: { lang: "wrong" } };
  applyDocumentLang("yo", doc);
  assert.equal(doc.documentElement.lang, "yo");
  assert.doesNotThrow(() => applyDocumentLang("en", null));
});

/* ------------------------------------------- AI guide language */

test("guide language normalises to a supported code, default English", () => {
  assert.equal(normalizeGuideLang("yo"), "yo");
  assert.equal(normalizeGuideLang("ig"), "ig");
  assert.equal(normalizeGuideLang(undefined), "en");
  assert.equal(normalizeGuideLang("fr"), "en");
  assert.equal(normalizeGuideLang({}), "en");
});

test("the AI directive names the language and pins the enums to English", () => {
  assert.equal(guideReplyLanguageDirective("en"), "");
  const yo = guideReplyLanguageDirective("yo");
  assert.ok(yo.includes("Yoruba"), "must name the language");
  assert.ok(yo.includes("exactly in English"), "enum values must stay English");
  const ig = guideReplyLanguageDirective("ig");
  assert.ok(ig.includes("Igbo"));
  assert.equal(guideReplyLanguageDirective("not-a-lang"), "");
});

test("guideLanguageName exposes English names for the directive/tests", () => {
  assert.equal(guideLanguageName("ha"), "Hausa");
  assert.equal(guideLanguageName("nope"), null);
});

/* ------------------------------------------- dictionaries */

test("language strings exist and are translated in all four dictionaries", () => {
  for (const key of ["a_language", "a_language_d", "a_language_aria", "hg_lang_note"]) {
    const en = translate("en", key);
    assert.notEqual(en, key, `en dictionary is missing ${key}`);
    for (const code of ["yo", "ha", "ig"] as const) {
      const value = translate(code, key);
      assert.notEqual(value, key, `${code} dictionary is missing ${key}`);
      assert.notEqual(value, en, `${code} must not silently reuse the English copy of ${key}`);
    }
  }
});

/**
 * Coverage policy, asserted so it cannot silently regress the other way:
 * the provider-applications ADMIN console (`aa_*`) and `pr_soon` are
 * English-only server fallbacks today — the translator must return the
 * English copy, not the raw key, for them in all non-English locales.
 */
test("admin-console strings fall back to English rather than the raw key", () => {
  for (const key of ["aa_title", "aa_decision", "pr_soon"]) {
    for (const code of ["yo", "ha", "ig"] as const) {
      assert.equal(translate(code, key), translate("en", key), `${key} in ${code} must match the English fallback`);
    }
  }
});
