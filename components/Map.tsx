"use client";

// Phase 5 — The map. Mapbox GL canvas with custom sparse numbered pins and one
// stylized route line. Pure presentation: it renders stops and reports taps;
// it owns no itinerary logic. Client-only (mapbox-gl needs the browser).

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { ItineraryStop } from "@/lib/ai/planDay";

interface MapProps {
  stops: ItineraryStop[];
  selectedIndex: number | null;
  onSelectStop: (index: number) => void;
}

// Custom pin styling — written as full literal strings so Tailwind keeps them.
const PIN_BASE =
  "flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-zinc-900 text-xs font-semibold text-white shadow-md transition-transform duration-200";
const PIN_SELECTED = "scale-125 ring-4 ring-zinc-900/15";

export default function Map({ stops, selectedIndex, onSelectStop }: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // Initialize the map once and (re)draw pins + route when stops change.
  useEffect(() => {
    if (!token || !containerRef.current || stops.length === 0) return;
    mapboxgl.accessToken = token;

    const coords = stops.map(
      (s) => [s.place.lng, s.place.lat] as [number, number],
    );

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
      // One stylized route line through the stops in order.
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

      // Custom numbered pins, in chronological order.
      stops.forEach((stop, i) => {
        const el = document.createElement("button");
        el.className = PIN_BASE;
        el.textContent = String(i + 1);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectStop(i);
        });
        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat(coords[i])
          .addTo(map);
        markersRef.current.push(marker);
      });

      // Frame the whole day.
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
  }, [stops, token, onSelectStop]);

  // Highlight the selected pin and fly to it.
  useEffect(() => {
    markersRef.current.forEach((marker, i) => {
      marker.getElement().className =
        i === selectedIndex ? `${PIN_BASE} ${PIN_SELECTED}` : PIN_BASE;
    });
    if (selectedIndex != null && mapRef.current && stops[selectedIndex]) {
      const { lng, lat } = stops[selectedIndex].place;
      mapRef.current.flyTo({ center: [lng, lat], zoom: 14, speed: 0.8 });
    }
  }, [selectedIndex, stops]);

  if (!token) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-100 p-6 text-center text-sm text-zinc-500">
        Map unavailable — set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local.
      </div>
    );
  }

  return <div ref={containerRef} className="h-full w-full" />;
}
