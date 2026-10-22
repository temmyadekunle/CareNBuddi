"use client";

import { useEffect } from "react";
import { useLang } from "@/lib/i18n";
import { applyDocumentLang } from "@/lib/lang-decision";

/**
 * Keeps `<html lang="...">` in step with the device-session language.
 *
 * The server-rendered document always ships with `lang="en"` (the seeded
 * default — the switcher choice lives in localStorage, which the server
 * cannot read, so no flash of an unhydrated attribute value is avoidable
 * without a cookie; device sessions are deliberately cookie-free). This
 * component applies the live choice as soon as it mounts and on every
 * change, which is what assistive technology and the browser's font/shaping
 * pipeline read. All route groups are inside the root layout, so one mount
 * covers every screen.
 */
export function DocumentLang() {
  const lang = useLang();
  useEffect(() => {
    applyDocumentLang(lang, document);
  }, [lang]);
  return null;
}
