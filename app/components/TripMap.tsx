"use client";

import { useEffect, useMemo, useRef } from "react";
import type { ActivityCategory, TripDay } from "../trip-data";
import { filterMapActivities } from "../trip-utils";

type TripMapProps = {
  days: TripDay[];
  selectedDayId: string;
  allDays: boolean;
  categories: Set<ActivityCategory>;
  onSelectDay: (dayId: string) => void;
};

export function TripMap({ days, selectedDayId, allDays, categories, onSelectDay }: TripMapProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const points = useMemo(
    () => filterMapActivities(days, selectedDayId, allDays, categories),
    [days, selectedDayId, allDays, categories],
  );

  useEffect(() => {
    let cancelled = false;

    async function mountMap() {
      if (!hostRef.current) return;
      const L = await import("leaflet");
      if (cancelled || !hostRef.current) return;

      if (!mapRef.current) {
        // Leaflet is an external widget, so React owns only this host node while
        // the effect owns setup and cleanup: https://react.dev/reference/react/useEffect#controlling-a-non-react-widget
        const map = L.map(hostRef.current, { zoomControl: true, scrollWheelZoom: false }).setView([42.352, -71.075], 12);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);
        mapRef.current = map;
        layerRef.current = L.layerGroup().addTo(map);
      }

      const map = mapRef.current;
      const layer = layerRef.current;
      if (!map || !layer) return;
      layer.clearLayers();

      const bounds: [number, number][] = [];
      const byDay = new Map<string, [number, number][]>();
      for (const { day, activity } of points) {
        const coords = activity.coordinates!;
        bounds.push(coords);
        const route = byDay.get(day.id) ?? [];
        route.push(coords);
        byDay.set(day.id, route);

        const marker = L.circleMarker(coords, {
          radius: 8,
          color: "#ffffff",
          weight: 2,
          fillColor: day.color,
          fillOpacity: 0.95,
        });
        const popup = document.createElement("div");
        popup.className = "map-popup";
        const label = document.createElement("strong");
        label.textContent = `${activity.timeLabel} ${activity.title}`;
        const meta = document.createElement("span");
        meta.textContent = `${day.date} · ${day.location}`;
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "查看這一天";
        button.addEventListener("click", () => onSelectDay(day.id));
        popup.append(label, meta, button);
        marker.bindPopup(popup).addTo(layer);
      }

      for (const day of days) {
        const route = byDay.get(day.id);
        if (route && route.length > 1) {
          // Direct Leaflet setup follows the library's official quick-start primitives:
          // https://leafletjs.com/examples/quick-start/
          L.polyline(route, { color: day.color, weight: 3, opacity: 0.66, dashArray: "7 8" }).addTo(layer);
        }
      }

      if (bounds.length === 1) map.setView(bounds[0], 14);
      if (bounds.length > 1) map.fitBounds(L.latLngBounds(bounds), { padding: [28, 28], maxZoom: 14 });
    }

    void mountMap();
    return () => { cancelled = true; };
  }, [days, onSelectDay, points]);

  useEffect(() => () => {
    mapRef.current?.remove();
    mapRef.current = null;
    layerRef.current = null;
  }, []);

  return <div ref={hostRef} className="trip-map-canvas" aria-label="全行程地圖" />;
}
