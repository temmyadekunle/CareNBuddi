"use client";

import { LANGS, type Lang } from "@/lib/lang";
import { useLang } from "@/lib/i18n";
import { KEYS, useStoredValue, type Session } from "@/lib/storage";

export function LangSwitcher({ compact = false }: { compact?: boolean }) {
  const lang = useLang();
  const [, setSession] = useStoredValue<Session>(KEYS.session, { userId: null, lang: "en" });

  const change = (next: Lang) => {
    setSession((prev) => ({ ...prev, lang: next }));
  };

  return (
    <label
      className={`inline-flex items-center gap-1.5 ${compact ? "" : "border border-slate-200 rounded-lg bg-white px-2 py-1.5"}`}
    >
      <span className="text-sm" aria-hidden>
        🌐
      </span>
      <span className="sr-only">Language</span>
      <select
        value={lang}
        onChange={(e) => change(e.target.value as Lang)}
        className="rounded bg-transparent text-sm font-medium text-slate-700 outline-none"
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