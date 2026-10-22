export type Lang = "en" | "yo" | "ha" | "ig";

export interface LangMeta {
  code: Lang;
  label: string;
  native: string;
}

export const LANGS: LangMeta[] = [
  { code: "en", label: "English", native: "English" },
  { code: "yo", label: "Yoruba", native: "Èdè Yorùbá" },
  { code: "ha", label: "Hausa", native: "Hausa" },
  { code: "ig", label: "Igbo", native: "Asụsụ Igbo" },
];

/**
 * English-language names for each code, for prompts and machine text:
 * "Reply in Yoruba" rather than the endonym, which the model may misread.
 */
export const LANG_NAMES: Record<Lang, string> = {
  en: "English",
  yo: "Yoruba",
  ha: "Hausa",
  ig: "Igbo",
};

/** True exactly when `value` is one of the four supported languages. */
export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && LANGS.some((l) => l.code === value);
}