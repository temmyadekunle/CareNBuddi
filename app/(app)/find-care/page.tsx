"use client";

import { useMemo, useState } from "react";
import { ALL_STATES, PROVIDER_CATEGORIES, PROVIDER_CATEGORY_LABELS, providerCostTier, type CostTier } from "@/lib/content";
import { ProviderCard, matchProvider } from "@/components/health";
import { KEYS, seedProviders, useStoredCollection } from "@/lib/storage";
import { useT, useLang } from "@/lib/i18n";

const ANY_STATE = "__any_state__";
const ANY_CATEGORY = "__any_category__";

export default function FindCarePage() {
  const t = useT();
  const lang = useLang();
  const [providers] = useStoredCollection(KEYS.providers, seedProviders);
  const [query, setQuery] = useState("");
  const [state, setState] = useState(ANY_STATE);
  const [category, setCategory] = useState(ANY_CATEGORY);
  const [cost, setCost] = useState<"any" | CostTier>("any");

  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    return providers.filter((p) => {
      if (q && !matchProvider(p, q)) return false;
      if (state !== ANY_STATE && p.state !== state) return false;
      if (category !== ANY_CATEGORY && p.category !== category) return false;
      if (cost !== "any" && providerCostTier(p.category) !== cost) return false;
      return true;
    });
  }, [providers, q, state, category, cost]);

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
            {t("f_location")}
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            >
              <option value={ANY_STATE}>{t("f_all_states")}</option>
              {ALL_STATES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            {t("f_category")}
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            >
              <option value={ANY_CATEGORY}>{t("f_all")}</option>
              {PROVIDER_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {catLabel(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            {t("f_cost", "Cost")}
            <select
              value={cost}
              onChange={(e) => setCost(e.target.value as "any" | CostTier)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            >
              <option value="any">{t("f_any_cost", "Any cost")}</option>
              <option value="low">{t("f_low_cost", "₦ Lower cost")}</option>
              <option value="mid">{t("f_mid_cost", "₦₦ Typical")}</option>
              <option value="high">{t("f_high_cost", "₦₦₦ Private")}</option>
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {results.length} {results.length === 1 ? t("f_facility_one") : t("f_facility_many")} · {t("f_verified")} ✓
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