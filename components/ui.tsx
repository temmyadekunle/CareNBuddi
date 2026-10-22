"use client";

import { LANGS, type Lang } from "@/lib/lang";
import { changeLanguage, useLang, useT } from "@/lib/i18n";
import { KEYS, useStoredValue, type Session } from "@/lib/storage";
import { languagePatch } from "@/lib/lang-decision";
import { useCloudOptional } from "@/lib/supabase/cloud";
import { updateProfile } from "@/lib/supabase/sync";

/**
 * One purpose: change the UI language for the whole app.
 *
 * Writing: always updates the device session (instant, works offline, and
 * survives refresh/navigation/sign-out). When a user is signed in with the
 * cloud configured, it also patches `profiles.lang` — ONLY the language
 * column, nothing else (languagePatch builds a single-field payload, so no
 * role/name/phone path is touched). That profile write is best-effort: if
 * the network or the write fails, the device choice stands and the choice is
 * re-synced on the next restore; nothing about the UI misleadingly changes.
 */
export function LangSwitcher({ compact = false }: { compact?: boolean }) {
  const lang = useLang();
  const t = useT();
  const [, setSession] = useStoredValue<Session>(KEYS.session, { userId: null, lang: "en" });
  const cloud = useCloudOptional();
  const user = cloud?.user ?? null;

  const change = (next: Lang) => {
    setSession((prev) => changeLanguage(prev, next));
    if (user) {
      updateProfile(user.id, languagePatch(next)).catch(() => {
        /* Fail-safe: the device choice stands; the server is updated on the
           next restore or another change. Never block the UI language. */
      });
    }
  };

  return (
    <label
      className={`inline-flex items-center gap-1.5 ${compact ? "" : "border border-slate-200 rounded-lg bg-white px-2 py-1.5"}`}
    >
      <span className="text-sm" aria-hidden>
        🌐
      </span>
      <span className="sr-only">{t("a_language", "Language")}</span>
      <select
        value={lang}
        onChange={(e) => change(e.target.value as Lang)}
        aria-label={t("a_language_aria", "Change language")}
        className="rounded bg-transparent text-sm font-medium text-slate-700 outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code}>
            {l.code === "en" ? "English" : l.native}
          </option>
        ))}
      </select>
    </label>
  );
}