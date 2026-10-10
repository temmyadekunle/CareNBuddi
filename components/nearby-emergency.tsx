"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, Segmented } from "@/components/app-ui";
import { EmergencyMap, type MapPoint } from "@/components/emergency-map";
import { PinIcon, PhoneIcon, ShieldIcon } from "@/components/icons";
import {
  PROVIDER_CATEGORY_LABELS,
  directionsUrl,
  type Provider,
} from "@/lib/content";
import { useLang, useT } from "@/lib/i18n";
import {
  emergencyFacilities,
  facilityGeocodeQuery,
  formatDistance,
  geocodeAddress,
  haversineKm,
  orderEmergencyFacilities,
  readGeocodeCache,
  writeGeocodeCache,
  type GeocodeResult,
  type LatLon,
} from "@/lib/rapid-response";
import { KEYS, seedProviders, useStoredCollection } from "@/lib/storage";

const MAX_GEOCODES = 10;
const GEOCODE_DELAY_MS = 1100;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type LocState = "idle" | "locating" | "granted" | "denied" | "unsupported";
type GeoState = { status: "idle" | "running" | "done" | "failed"; done: number; total: number };

export function NearbyEmergency() {
  const t = useT();
  const lang = useLang();
  const [providers] = useStoredCollection(KEYS.providers, seedProviders);
  const facilities = useMemo(() => emergencyFacilities(providers), [providers]);

  const [view, setView] = useState<"list" | "map">("list");
  const [origin, setOrigin] = useState<LatLon | null>(null);
  const [loc, setLoc] = useState<LocState>("idle");
  const [coords, setCoords] = useState<Record<string, GeocodeResult>>(() =>
    readGeocodeCache(),
  );
  const [geo, setGeo] = useState<GeoState>({ status: "idle", done: 0, total: 0 });
  const [mapFailed, setMapFailed] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const runRef = useRef(0);

  const ordered = useMemo(
    () => orderEmergencyFacilities(facilities, origin),
    [facilities, origin],
  );
  const shouldGeocode = origin !== null || view === "map";

  useEffect(() => {
    if (!shouldGeocode) {
      runRef.current += 1;
      return;
    }
    const run = ++runRef.current;
    (async () => {
      const cache = readGeocodeCache();
      const pending = orderEmergencyFacilities(facilities, null)
        .filter((facility) => !cache[facility.id])
        .slice(0, MAX_GEOCODES);
      if (pending.length === 0) {
        if (runRef.current === run) {
          setCoords(cache);
          setGeo((g) => ({ ...g, status: "done" }));
        }
        return;
      }
      if (runRef.current === run) {
        setGeo({ status: "running", done: 0, total: pending.length });
      }
      for (let i = 0; i < pending.length; i++) {
        const found = await geocodeAddress(facilityGeocodeQuery(pending[i]));
        if (runRef.current !== run) return;
        if (found) {
          cache[pending[i].id] = found;
          writeGeocodeCache(cache);
          setCoords({ ...cache });
        }
        setGeo({ status: "running", done: i + 1, total: pending.length });
        if (i < pending.length - 1) await sleep(GEOCODE_DELAY_MS);
        if (runRef.current !== run) return;
      }
      if (runRef.current === run) {
        const resolved = Object.keys(cache).length;
        setGeo({
          status: resolved > 0 ? "done" : "failed",
          done: pending.length,
          total: pending.length,
        });
      }
    })();
  }, [shouldGeocode, facilities, retryTick]);

  const points = useMemo<MapPoint[]>(
    () =>
      ordered
        .filter((facility) => coords[facility.id])
        .map((facility) => ({
          id: facility.id,
          label: facility.name,
          lat: coords[facility.id].lat,
          lng: coords[facility.id].lng,
          directionsUrl: directionsUrl(facility),
        })),
    [ordered, coords],
  );

  const locate = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLoc("unsupported");
      return;
    }
    setLoc("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLoc("granted");
      },
      () => setLoc("denied"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  };

  const categoryLabel = (provider: Provider) =>
    PROVIDER_CATEGORY_LABELS[lang]?.[provider.category] ?? provider.category;

  if (facilities.length === 0) {
    return (
      <EmptyState
        icon={<PinIcon className="h-6 w-6" />}
        title={t("er_none_title", "No emergency facilities listed")}
        body={t(
          "er_none_d",
          "Nothing is available here right now. In an emergency, dial 112.",
        )}
      />
    );
  }

  return (
    <Card>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">
            {t("er_count", "{n} emergency facilities").replace(
              "{n}",
              String(facilities.length),
            )}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {origin
              ? t("er_sorted", "Sorted by distance from you")
              : t("er_no_loc", "Share your location to sort by distance")}
          </p>
        </div>
        <div className="w-36 shrink-0">
          <Segmented<"list" | "map">
            value={view}
            onChange={(next) => {
              setMapFailed(false);
              setView(next);
            }}
            options={[
              { value: "list", label: t("er_list", "List") },
              { value: "map", label: t("er_map", "Map") },
            ]}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {origin ? (
          <Button tone="secondary" onClick={() => { setOrigin(null); setLoc("idle"); }}>
            {t("er_clear_loc", "Clear location")}
          </Button>
        ) : (
          <Button
            tone="secondary"
            onClick={locate}
            disabled={loc === "locating"}
          >
            <PinIcon className="h-4 w-4" />
            {loc === "locating"
              ? t("er_locating", "Locating…")
              : t("er_locate", "Use my location")}
          </Button>
        )}
        {loc === "denied" && (
          <span className="text-xs font-medium text-amber-700">
            {t(
              "er_denied",
              "Location blocked — distances are hidden until you allow it.",
            )}
          </span>
        )}
        {loc === "unsupported" && (
          <span className="text-xs font-medium text-amber-700">
            {t("er_unsupported", "Location is not available on this device.")}
          </span>
        )}
        {origin && geo.status === "running" && (
          <span className="text-xs font-medium text-slate-500">
            {t("er_resolving", "Resolving addresses… {done}/{total}")
              .replace("{done}", String(geo.done))
              .replace("{total}", String(geo.total))}
          </span>
        )}
      </div>

      {view === "map" ? (
        <div className="mt-3">
          {mapFailed ? (
            <ErrorState
              title={t("er_map_error_title", "Map unavailable")}
              body={t(
                "er_map_error_d",
                "The map could not load. Every facility is still available in the list view.",
              )}
              retryLabel={t("er_show_list", "Show list")}
              onRetry={() => {
                setMapFailed(false);
                setView("list");
              }}
            />
          ) : geo.status === "running" ||
            (geo.status === "idle" && shouldGeocode) ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-brand-700" />
              <p className="mt-3 text-xs text-slate-500">
                {t("er_map_loading", "Resolving facility addresses… {done}/{total}")
                  .replace("{done}", String(geo.done))
                  .replace("{total}", String(geo.total))}
              </p>
            </div>
          ) : points.length === 0 ? (
            <EmptyState
              icon={<PinIcon className="h-6 w-6" />}
              title={t("er_map_empty_title", "Map positions unavailable")}
              body={t(
                "er_map_empty_d",
                "Facility addresses could not be resolved right now. Use the list view — every facility is there.",
              )}
              action={
                <Button tone="secondary" className="mt-2" onClick={() => setView("list")}>
                  {t("er_show_list", "Show list")}
                </Button>
              }
            />
          ) : (
            <EmergencyMap
              points={points}
              origin={origin}
              directionsLabel={t("er_directions", "Directions")}
              onFail={() => setMapFailed(true)}
            />
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-2.5">
          {ordered.map((facility) => {
            const position = coords[facility.id];
            const distance =
              origin && position ? haversineKm(origin, position) : null;
            return (
              <div
                key={facility.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {facility.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {categoryLabel(facility)} · {facility.city}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {facility.address}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {distance !== null && (
                      <Badge tone="rose">{formatDistance(distance)}</Badge>
                    )}
                    {facility.verified && (
                      <Badge tone="brand">
                        <ShieldIcon className="mr-1 h-3 w-3" />
                        {t("f_verified", "Verified")}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="mt-2.5 flex gap-2">
                  <a
                    href={`tel:${facility.phone}`}
                    className="tap inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-600 px-3 text-sm font-semibold text-white active:bg-rose-700"
                  >
                    <PhoneIcon className="h-4 w-4" />
                    {t("er_call", "Call")}
                  </a>
                  <a
                    href={directionsUrl(facility)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="tap inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-brand-300 hover:text-brand-700"
                  >
                    <PinIcon className="h-4 w-4" />
                    {t("er_directions", "Directions")}
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        {t(
          "er_approx",
          "Positions and distances are approximate — resolved from each facility's address (OpenStreetMap). Confirm with the facility before travelling.",
        )}
      </p>
      {shouldGeocode && points.length < ordered.length && (
        <button
          type="button"
          className="mt-1 text-[11px] font-semibold text-slate-400 underline"
          onClick={() => setRetryTick((n) => n + 1)}
        >
          {t("er_retry_lookup", "Retry address lookup")}
        </button>
      )}
    </Card>
  );
}
