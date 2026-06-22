"use client";

// Phase 5/7 — The map. Renders a list of points as either numbered itinerary
// pins (with a route line) or glowing "live" event pins (no route). Pure
// presentation: it draws points and reports taps; it owns no domain logic.

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export interface MapPoint {
  lng: number;
  lat: number;
}

interface MapProps {
  points: MapPoint[];
  selectedIndex: number | null;
  onSelectPoint: (index: number) => void;
  showRoute?: boolean;
  variant?: "stop" | "event";
}

// Numbered itinerary pin (monochrome).
const STOP_BASE =
  "flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-zinc-900 text-xs font-semibold text-white shadow-md transition-transform duration-200";
const STOP_SELECTED = "scale-125 ring-4 ring-zinc-900/15";

// Glowing "alive" event pin.
const EVENT_BASE =
  "relative inline-flex h-5 w-5 cursor-pointer items-center justify-center transition-transform duration-200";
const EVENT_SELECTED = "scale-150";

function makeStopEl(i: number) {
  const el = document.createElement("button");
  el.className = STOP_BASE;
  el.textContent = String(i + 1);
  return el;
}

function makeEventEl() {
  const el = document.createElement("button");
  el.className = EVENT_BASE;
  el.innerHTML =
    '<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>' +
    '<span class="relative inline-flex h-3 w-3 rounded-full bg-rose-500 ring-2 ring-white"></span>';
  return el;
}

export default function Map({
  points,
  selectedIndex,
  onSelectPoint,
  showRoute = true,
  variant = "stop",
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useEffect(() => {
    if (!token || !containerRef.current || points.length === 0) return;
    mapboxgl.accessToken = token;

    const coords = points.map((p) => [p.lng, p.lat] as [number, number]);

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: coords[0],
      zoom: 12,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      if (showRoute && coords.length > 1) {
        map.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: coords },
          },
        });
        map.addLayer({
          id: "route",
          type: "line",
          source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#18181b", "line-width": 2.5, "line-opacity": 0.5 },
        });
      }

      points.forEach((_, i) => {
        const el = variant === "event" ? makeEventEl() : makeStopEl(i);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectPoint(i);
        });
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat(coords[i])
          .addTo(map);
        markersRef.current.push(marker);
      });

      const bounds = coords.reduce(
        (b, c) => b.extend(c),
        new mapboxgl.LngLatBounds(coords[0], coords[0]),
      );
      map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 0 });
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [points, token, onSelectPoint, showRoute, variant]);

  // Highlight + fly to the selected point.
  useEffect(() => {
    const base = variant === "event" ? EVENT_BASE : STOP_BASE;
    const selectedCls = variant === "event" ? EVENT_SELECTED : STOP_SELECTED;
    markersRef.current.forEach((marker, i) => {
      marker.getElement().className =
        i === selectedIndex ? `${base} ${selectedCls}` : base;
    });
    if (selectedIndex != null && mapRef.current && points[selectedIndex]) {
      const { lng, lat } = points[selectedIndex];
      mapRef.current.flyTo({ center: [lng, lat], zoom: 14, speed: 0.8 });
    }
  }, [selectedIndex, points, variant]);

  if (!token) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-100 p-6 text-center text-sm text-zinc-500">
        Map unavailable — set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local.
      </div>
    );
  }

  return <div ref={containerRef} className="h-full w-full" />;
}
