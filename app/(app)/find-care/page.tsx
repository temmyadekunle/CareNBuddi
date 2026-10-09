"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Badge,
  BottomSheet,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  ListRow,
  Screen,
  Segmented,
  Switch,
  inputClass,
} from "@/components/app-ui";
import {
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  EmergencyIcon,
  FilterIcon,
  PinIcon,
  RefreshIcon,
  SearchIcon,
} from "@/components/icons";
import { BookSheet } from "@/components/book-sheet";
import { matchProvider } from "@/components/health";
import { ProviderCard } from "@/components/provider-card";
import {
  ALL_STATES,
  PROVIDER_CATEGORIES,
  PROVIDER_CATEGORY_LABELS,
  providerCostTier,
  type CostTier,
  type Provider,
  type ProviderCategory,
} from "@/lib/content";
import { useLang, useT } from "@/lib/i18n";
import { KEYS, refreshLocal, seedProviders, useStoredCollection } from "@/lib/storage";

const ANY_STATE = "__any_state__";
const ANY_CATEGORY = "__any_category__";
type CostFilter = "any" | CostTier;

/**
 * Deep links from the AI Health Guide land here with ?category=&state=&q=.
 * The params are read once, validated against the real category/state lists,
 * and applied as the initial filters — the existing UI then owns them.
 * useSearchParams needs a Suspense boundary in a static export build.
 */
export default function FindCarePage() {
  return (
    <Suspense
      fallback={
        <Screen>
          <div className="mt-2 h-11 w-full animate-pulse rounded-xl bg-slate-200/70" />
        </Screen>
      }
    >
      <FindCareInner />
    </Suspense>
  );
}

function FindCareInner() {
  const t = useT();
  const lang = useLang();
  const [providers] = useStoredCollection(KEYS.providers, seedProviders);
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [state, setState] = useState(() => {
    const value = searchParams.get("state");
    return value && (ALL_STATES as readonly string[]).includes(value) ? value : ANY_STATE;
  });
  const [category, setCategory] = useState(() => {
    const value = searchParams.get("category");
    return value && (PROVIDER_CATEGORIES as readonly string[]).includes(value)
      ? value
      : ANY_CATEGORY;
  });
  const [cost, setCost] = useState<CostFilter>("any");
  const [open24, setOpen24] = useState(false);

  const [stateOpen, setStateOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [booking, setBooking] = useState<Provider | null>(null);
  const [tapped, setTapped] = useState(false);

  const q = query.trim().toLowerCase();

  /**
   * The provider list is already sitting in memory, so filtering it is
   * synchronous and finishes in well under a millisecond. There is no request
   * to wait for.
   *
   * This list used to fake a load: a 500ms delay on first paint and 320ms after
   * every keystroke, replacing all the results with skeleton cards each time.
   * On a phone that made typing and filtering feel like the app had frozen,
   * even though the work was already done. So the results now update as you
   * type, and nothing is hidden behind a spinner.
   */
  const filtered = useMemo<Provider[] | null>(() => {
    try {
      return providers.filter((provider) => {
        if (q && !matchProvider(provider, q)) return false;
        if (state !== ANY_STATE && provider.state !== state) return false;
        if (category !== ANY_CATEGORY && provider.category !== category) return false;
        if (cost !== "any" && providerCostTier(provider.category) !== cost) return false;
        if (open24 && !provider.hours.toLowerCase().includes("24 hours")) return false;
        return true;
      });
    } catch {
      return null;
    }
  }, [providers, q, state, category, cost, open24]);

  const failed = filtered === null;
  const results = filtered ?? [];
  const activeFilters =
    (category === ANY_CATEGORY ? 0 : 1) + (cost === "any" ? 0 : 1) + (open24 ? 1 : 0);

  const catLabel = (value: ProviderCategory) =>
    PROVIDER_CATEGORY_LABELS[lang]?.[value] ?? value;

  const clearFilters = () => {
    setQuery("");
    setState(ANY_STATE);
    setCategory(ANY_CATEGORY);
    setCost("any");
    setOpen24(false);
  };

  /**
   * Re-reads the list from device storage. The brief spin is only there to
   * acknowledge the tap: the read itself is immediate and the results below
   * are never replaced by a loading state.
   */
  const reload = () => {
    refreshLocal(KEYS.providers);
    setTapped(true);
    window.setTimeout(() => setTapped(false), 350);
  };

  return (
    <Screen>
      <div className="flex items-start gap-3 pt-1">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-bold leading-tight tracking-tight text-slate-900">
            {t("f_title", "Find Care")}
          </h1>
          <p className="mt-0.5 text-xs leading-snug text-slate-500">
            {t(
              "fc_sub",
              "Hospitals, PHCs, labs, pharmacies and professionals — with the next available slot.",
            )}
          </p>
        </div>
        <button
          type="button"
          aria-label={t("fc_refresh", "Refresh results")}
          title={t("fc_refresh", "Refresh results")}
          onClick={reload}
          className="tap inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
        >
          <RefreshIcon className={`h-4 w-4 ${tapped ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="sticky top-0 z-20 -mx-4 mt-3 bg-slate-50/95 px-4 py-2 backdrop-blur-md">
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <label htmlFor="care-search" className="sr-only">
            {t("f_search", "Search by name, service, or LGA\u2026")}
          </label>
          <input
            id="care-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("f_search", "Search by name, service, or LGA\u2026")}
            className={`${inputClass} h-11 pl-9 pr-11 [&::-webkit-search-cancel-button]:appearance-none`}
          />
          {query && (
            <button
              type="button"
              aria-label={t("fc_clear_search", "Clear search")}
              onClick={() => setQuery("")}
              className="tap absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStateOpen(true)}
            className="tap flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-left hover:border-brand-300"
          >
            <PinIcon className="h-4 w-4 shrink-0 text-brand-600" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">
              {state === ANY_STATE ? t("f_all_states", "All states") : state}
            </span>
            <ChevronDownIcon className="h-4 w-4 shrink-0 text-slate-400" />
          </button>
          <Button
            tone="secondary"
            className="shrink-0"
            onClick={() => setFiltersOpen(true)}
          >
            <FilterIcon className="h-4 w-4" />
            {t("fc_filters", "Filters")}
            {activeFilters > 0 && <Badge tone="brand">{activeFilters}</Badge>}
          </Button>
        </div>
      </div>

      <div className="no-scrollbar -mx-4 mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4">
        <Chip
          className="snap-start min-h-11!"
          active={category === ANY_CATEGORY}
          onClick={() => setCategory(ANY_CATEGORY)}
        >
          {t("f_all", "All categories")}
        </Chip>
        {PROVIDER_CATEGORIES.map((value) => (
          <Chip
            key={value}
            className="snap-start min-h-11!"
            active={category === value}
            onClick={() => setCategory(category === value ? ANY_CATEGORY : value)}
          >
            {catLabel(value)}
          </Chip>
        ))}
      </div>

      <p className="mt-3.5 truncate text-xs text-slate-500">
        {results.length}{" "}
        {results.length === 1 ? t("f_facility_one", "facility") : t("f_facility_many", "facilities")} ·{" "}
        {t("f_verified", "Verified")} ✓
      </p>

      {failed ? (
        <div className="mt-3">
          <ErrorState
            title={t("fc_error_title", "Couldn't load results")}
            body={t(
              "fc_error_d",
              "We could not read your facilities list. Try again in a moment.",
            )}
            retryLabel={t("fc_retry", "Try again")}
            onRetry={reload}
          />
        </div>
      ) : results.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            icon={<SearchIcon className="h-6 w-6" />}
            title={t("fc_empty_title", "No providers found")}
            body={t(
              "fc_empty_d",
              "Try a different search term, or clear your filters to see everything.",
            )}
            action={
              <Button tone="secondary" className="mt-2" onClick={clearFilters}>
                {t("fc_clear_filters", "Clear filters")}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-3 space-y-2.5">
          {results.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              onBook={() => setBooking(provider)}
            />
          ))}
        </div>
      )}

      <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-400">
        {t(
          "ft_notdx",
          "CareNBuddi provides general health information and navigation. It is not a medical diagnosis and does not replace a healthcare professional.",
        )}
      </p>

      <BottomSheet
        open={stateOpen}
        onClose={() => setStateOpen(false)}
        title={t("fc_choose_state", "Choose a state")}
      >
        <div className="-mx-4 divide-y divide-slate-100">
          <ListRow
            icon={<PinIcon className="h-5 w-5" />}
            title={t("f_all_states", "All states")}
            chevron={false}
            meta={
              state === ANY_STATE ? (
                <CheckIcon className="h-4 w-4 text-brand-700" />
              ) : undefined
            }
            onClick={() => {
              setState(ANY_STATE);
              setStateOpen(false);
            }}
          />
          {ALL_STATES.map((option) => (
            <ListRow
              key={option}
              icon={<PinIcon className="h-5 w-5" />}
              title={option}
              chevron={false}
              meta={
                state === option ? <CheckIcon className="h-4 w-4 text-brand-700" /> : undefined
              }
              onClick={() => {
                setState(option);
                setStateOpen(false);
              }}
            />
          ))}
        </div>
      </BottomSheet>

      <BottomSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title={t("fc_filters", "Filters")}
        footer={
          <div className="flex gap-2">
            <Button tone="secondary" onClick={clearFilters}>
              {t("fc_reset", "Reset")}
            </Button>
            <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
              {t("fc_show_n", "Show {n} results").replace("{n}", String(results.length))}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-600">{t("f_category", "Category")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Chip
                className="min-h-11!"
                active={category === ANY_CATEGORY}
                onClick={() => setCategory(ANY_CATEGORY)}
              >
                {t("f_all", "All categories")}
              </Chip>
              {PROVIDER_CATEGORIES.map((value) => (
<Chip
                key={value}
                className="min-h-11!"
                active={category === value}
                onClick={() => setCategory(value)}
              >
                  {catLabel(value)}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-600">{t("f_cost", "Cost")}</p>
            <div className="mt-2">
              <Segmented<CostFilter>
                options={[
                  { value: "any", label: t("f_any_cost", "Any cost") },
                  { value: "low", label: t("f_low_cost", "₦ Lower cost") },
                  { value: "mid", label: t("f_mid_cost", "₦₦ Typical") },
                  { value: "high", label: t("f_high_cost", "₦₦₦ Private") },
                ]}
                value={cost}
                onChange={setCost}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
            <span className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-700">
              <EmergencyIcon className="h-4 w-4 shrink-0 text-rose-500" />
              <span className="truncate">{t("f_open_24", "Open 24 hours")}</span>
            </span>
            <Switch
              checked={open24}
              onChange={setOpen24}
              label={t("f_open_24", "Open 24 hours")}
            />
          </div>
        </div>
      </BottomSheet>

      <BookSheet
        provider={booking}
        open={booking !== null}
        onClose={() => setBooking(null)}
      />
    </Screen>
  );
}