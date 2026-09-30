"use client";

import { useMemo, useState } from "react";
import { ALL_STATES, PROVIDER_CATEGORIES, PROVIDER_CATEGORY_LABELS } from "@/lib/content";
import { ProviderCard, matchProvider } from "@/components/health";
import { KEYS, seedProviders, useStoredCollection } from "@/lib/storage";
import { useT, useLang } from "@/lib/i18n";

export default function FindCarePage() {
  const t = useT();
  const lang = useLang();
  const [providers] = useStoredCollection(KEYS.providers, seedProviders);
  const [query, setQuery] = useState("");
  const [state, setState] = useState("All states");
  const [category, setCategory] = useState("All categories");

  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    return providers.filter((p) => {
      if (q && !matchProvider(p, q)) return false;
      if (state !== "All states" && p.state !== state) return false;
      if (category !== "All categories" && p.category !== category) return false;
      return true;
    });
  }, [providers, q, state, category]);

  const catLabel = (c: string) => PROVIDER_CATEGORY_LABELS[lang]?.[c as never] ?? c;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("f_title")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("f_sub")}</p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label htmlFor="care-search" className="sr-only">
            {t("f_search")}
          </label>
          <input
            id="care-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("f_search")}
            className="w-full max-w-sm rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          />
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            Location
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            >
              <option>All states</option>
              {ALL_STATES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            >
              <option>All categories</option>
              {PROVIDER_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {catLabel(c)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {results.length} {results.length === 1 ? "facility" : "facilities"} · {t("f_verified")} ✓
        </p>
      </div>

      {results.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          {t("f_no_results")}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((p) => (
            <ProviderCard key={p.id} provider={p} />
          ))}
        </div>
      )}
    </main>
  );
}