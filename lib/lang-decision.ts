import { isLang, LANG_NAMES, type Lang } from "./lang";

/**
 * Language-preference decisions, in one testable place.
 *
 * ## The conflict rule (predictable, deliberately simple)
 *
 * The language lives in two places: the device session
 * (`healthlink:session.lang` — what the whole UI reads) and, for signed-in
 * users, the Supabase profile (`profiles.lang`).
 *
 * - AT SIGN-IN / RESTORE: a saved server preference wins when it is a
 *   supported language ("your account language follows you" — across devices,
 *   past a guest's choice, past a legacy profile without one). When the
 *   server has none (new or legacy account, cloud unavailable) the device's
 *   current choice stands, including a guest's pre-signup choice — which is
 *   also how the choice survives into a new account: sign-up seeds
 *   `profiles.lang` from the device session.
 * - WHILE SIGNED IN: changes made in the app write the device session
 *   (authoritative for the running UI) and patch `profiles.lang` — ONLY the
 *   language column — best-effort. A failed profile write keeps the device
 *   choice; doing nothing server-side is always the failure mode, never
 *   losing the UI language. The server catches up on a later restore.
 * - WHILE SIGNED OUT: changes touch only the device session, and they
 *   survive sign-out/session-end (lib/session.ts preserves the language while
 *   clearing the user pointer).
 *
 * Sync note: because a signed-in change also reaches the server, "server
 * wins at sign-in" keeps a returning user's own last choice AND lets a
 * change made on another device restore; neither requires device-side
 * ownership bookkeeping.
 *
 * ## Machine-readable values are not translated
 *
 * Route paths, provider categories (`GuideCategory`), states, intent/status
 * enums and database values stay in English; only user-facing dictionary
 * strings and AI natural-language replies follow the preference.
 */

export type LangSource = "server" | "device";

/**
 * Which language an adopted (signed-in / restored) session should run in.
 * `source` records whether the decision came from the saved server
 * preference or the device session — tests assert the rule matrix on it.
 */
export function adoptedLang(
  session: { lang?: unknown } | null | undefined,
  profileLang: unknown,
): { lang: Lang; source: LangSource } {
  const server = isLang(profileLang) ? profileLang : null;
  if (server) return { lang: server, source: "server" };
  // parseLang-by-way-of-isLang: a corrupted or stale session value must
  // never crash the app; it falls back to the seeded default instead.
  const device = isLang(session?.lang) ? session.lang : "en";
  return { lang: device, source: "device" };
}

/** A profile-update payload that contains ONLY the language column. */
export function languagePatch(lang: Lang): { lang: Lang } {
  if (!isLang(lang)) throw new Error("invalid-lang");
  return { lang };
}

/**
 * Applies the language to the document element (`<html lang="...">`), the
 * attribute assistive tech and the browser's font/shaping pipeline read.
 * Accepts an injectable document for tests.
 */
export function applyDocumentLang(
  lang: Lang,
  doc: { documentElement: { lang: string } } | null | undefined,
): void {
  if (!doc) return;
  doc.documentElement.lang = lang;
}

/** English name of a language, for AI directives; returns null for unsupported. */
export function guideLanguageName(lang: unknown): string | null {
  return isLang(lang) ? LANG_NAMES[lang] : null;
}
