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