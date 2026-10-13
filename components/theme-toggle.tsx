"use client";

import { useTheme } from "./theme-provider";

const OPTIONS: { value: "light" | "dark" | "system"; label: string; desc: string }[] = [
  { value: "light", label: "Light", desc: "Always light" },
  { value: "dark", label: "Dark", desc: "Always dark" },
  { value: "system", label: "System", desc: "Follow device" },
];

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { mode, setMode } = useTheme();

  if (compact) {
    const option = OPTIONS.find((o) => o.value === mode);
    return (
      <select
        value={mode}
        onChange={(e) => setMode(e.target.value as "light" | "dark" | "system")}
        className="rounded bg-transparent text-sm font-medium text-slate-700 outline-none dark:text-slate-200"
        aria-label="Theme"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {OPTIONS.map((o) => (
        <label
          key={o.value}
          className="flex items-center justify-between rounded-xl border border-slate-200 p-2.5 dark:border-slate-700 dark:bg-slate-800/50"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{o.label}</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{o.desc}</p>
          </div>
          <input
            type="radio"
            name="theme"
            value={o.value}
            checked={mode === o.value}
            onChange={() => setMode(o.value)}
            className="h-4 w-4 text-brand-700"
          />
        </label>
      ))}
    </div>
  );
}
