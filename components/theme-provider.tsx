"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useStoredValue } from "@/lib/storage";

export type ThemeMode = "light" | "dark" | "system";

export const THEME_KEY = "healthlink:theme";
export const THEME_DEFAULT: ThemeMode = "system";

interface ThemeValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  effective: "light" | "dark";
}

const ThemeContext = createContext<ThemeValue | null>(null);

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useStoredValue<ThemeMode>(THEME_KEY, THEME_DEFAULT);
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">(() => getSystemTheme());

  const effective = useMemo<"light" | "dark">(() => {
    if (mode === "system") return systemTheme;
    return mode;
  }, [mode, systemTheme]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? "dark" : "light");
    media.addEventListener("change", handler);

    const observer = new MutationObserver((records) => {
      // Setting an attribute always queues a mutation record, even when the
      // value is identical, so writing "data-theme" from inside this callback
      // used to wake the observer up again immediately and spin forever without
      // ever yielding. Ignore records this observer produced itself.
      if (records.every((record) => record.attributeName === "data-theme")) return;
      document.documentElement.setAttribute("data-theme", effective);
    });

    document.documentElement.setAttribute("data-theme", effective);
    document.documentElement.classList.add("themes-enabled");
    observer.observe(document.documentElement, { attributes: true, childList: true, subtree: false });

    return () => {
      media.removeEventListener("change", handler);
      observer.disconnect();
    };
  }, [effective]);

  return <ThemeContext.Provider value={{ mode, setMode, effective }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
