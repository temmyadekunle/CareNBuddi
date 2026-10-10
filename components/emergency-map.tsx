"use client";

import { useEffect, useRef, useState } from "react";

export interface MapPoint {
  id: string;
  label: string;
  lat: number;
  lng: number;
  directionsUrl: string;
}

const FACILITY_ICON =
  '<span style="display:block;width:16px;height:16px;border-radius:9999px;background:#e11d48;border:3px solid #fff;box-shadow:0 1px 6px rgba(15,23,42,.45)"></span>';
const ORIGIN_ICON =
  '<span style="display:block;width:16px;height:16px;border-radius:9999px;background:#2563eb;border:3px solid #fff;box-shadow:0 1px 6px rgba(15,23,42,.45)"></span>';

export function EmergencyMap({
  points,
  origin,
  directionsLabel,
  onFail,
}: {
  points: MapPoint[];
  origin: { lat: number; lng: number } | null;
  directionsLabel: string;
  onFail: () => void;
}) {
  const holder = useRef<HTMLDivElement | null>(null);
  const onFailRef = useRef(onFail);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onFailRef.current = onFail;
  }, [onFail]);

  useEffect(() => {
    let disposed = false;
    let map: import("leaflet").Map | null = null;
    let watchdog = 0;
    let failed = false;
    const fail = () => {
      if (disposed || failed) return;
      failed = true;
      onFailRef.current();
    };

    (async () => {
      try {
        const L = await import("leaflet");
        await import("leaflet/dist/leaflet.css");
        if (disposed || !holder.current) return;

        map = L.map(holder.current, { scrollWheelZoom: false });
        let tilesLoaded = false;
        const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        });
        let tileErrors = 0;
        tiles.on("load", () => {
          tilesLoaded = true;
        });
        tiles.on("tileerror", () => {
          tileErrors += 1;
          if (!tilesLoaded && tileErrors >= 5) fail();
        });
        tiles.addTo(map);

        const bounds = L.latLngBounds([]);
        if (origin) {
          L.marker([origin.lat, origin.lng], {
            icon: L.divIcon({ html: ORIGIN_ICON, className: "", iconSize: [16, 16], iconAnchor: [8, 8] }),
          }).addTo(map);
          bounds.extend([origin.lat, origin.lng]);
        }
        for (const point of points) {
          const popup = document.createElement("div");
          const name = document.createElement("div");
          name.style.fontWeight = "600";
          name.textContent = point.label;
          const link = document.createElement("a");
          link.href = point.directionsUrl;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = directionsLabel;
          link.style.display = "inline-block";
          link.style.marginTop = "4px";
          popup.appendChild(name);
          popup.appendChild(link);
          L.marker([point.lat, point.lng], {
            icon: L.divIcon({ html: FACILITY_ICON, className: "", iconSize: [16, 16], iconAnchor: [8, 8] }),
          })
            .bindPopup(popup)
            .addTo(map);
          bounds.extend([point.lat, point.lng]);
        }

        if (bounds.isValid()) {
          map.fitBounds(bounds.pad(0.3), { maxZoom: 13 });
        } else {
          map.setView([9.08, 8.68], 6);
        }

        window.setTimeout(() => {
          if (!disposed) map?.invalidateSize();
        }, 120);
        watchdog = window.setTimeout(() => {
          if (!tilesLoaded) fail();
        }, 8000);
        if (!disposed) setReady(true);
      } catch {
        fail();
      }
    })();

    return () => {
      disposed = true;
      window.clearTimeout(watchdog);
      map?.remove();
      map = null;
      setReady(false);
    };
  }, [points, origin, directionsLabel]);

  return (
    <div className="relative">
      <div
        ref={holder}
        className="h-64 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
        aria-hidden={!ready}
      />
    </div>
  );
}
