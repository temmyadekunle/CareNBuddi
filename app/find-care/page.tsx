"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ALL_CATEGORIES, ALL_STATES, PROVIDERS } from "@/lib/content";
import { ProviderCard, matchProvider } from "@/components/health";

export default function FindCarePage() {
  return (
    <Suspense fallback={null}>
      <FindCareContent />
    </Suspense>
  );
}

function FindCareContent() {
  const params = useSearchParams();
  const initialCategory = params.get("category");
  const [query, setQuery] = useState("");
  const [state, setState] = useState("All states");
  const [category, setCategory] = useState(
    initialCategory && ALL_CATEGORIES.includes(initialCategory)
      ? initialCategory
      : "All categories",
  );

  const q = query.trim().toLowerCase();

  const providers = useMemo(() => {
    return PROVIDERS.filter((p) => {
      if (q && !matchProvider(p, q)) return false;
      if (state !== "All states" && p.state !== state) return false;
      if (category !== "All categories" && p.category !== category) return false;
      return true;
    });
  }, [q, state, category]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Find care</h1>
        <p className="mt-1 text-sm text-slate-500">
          Search hospitals, clinics, laboratories, pharmacies and professionals.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label htmlFor="care-search" className="sr-only">
            Search facilities
          </label>
          <input
            id="care-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, service, city…"
            className="w-full max-w-sm rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
          />
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            Location
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
            >
              <option>All states</option>
              {ALL_STATES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            What do you need?
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
            >
              <option>All categories</option>
              {ALL_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-500">{providers.length} facilities found</p>
      </div>

      {providers.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No facilities matched your filters. Try widening the search.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((p) => (
            <ProviderCard key={p.id} provider={p} />
          ))}
        </div>
      )}
    </main>
  );
}