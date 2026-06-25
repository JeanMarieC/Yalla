// Phase 13 — Urban POI source. Geocode a city, then pull real venues by
// category from the Mapbox Search Box API. Facts (name, coords, category) come
// from Mapbox; the AI only adds vibe later. Token reused from env.

import type { LatLng } from "../routing";

export interface RawPOI {
  name: string;
  lat: number;
  lng: number;
  category: string;
  placeTypes: string[];
  // Phase 14.2 — rich facts. OSM supplies these; Mapbox usually leaves them
  // undefined (so those rows keep "unknown" hours and zero prominence).
  osmType?: "node" | "way" | "relation";
  osmId?: number;
  rawHours?: string; // original OSM opening_hours string
  address?: string;
  neighborhood?: string;
  prominence?: number; // 0..1 free quality proxy
}

function token(): string {
  const t = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? process.env.MAPBOX_TOKEN;
  if (!t) throw new Error("Mapbox token is not set.");
  return t;
}

export async function geocodeCity(
  city: string,
): Promise<{ center: LatLng; country: string } | null> {
  const url =
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(city)}.json` +
    `?types=place&limit=1&access_token=${token()}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = (await res.json()) as {
    features?: { center: [number, number]; context?: { id: string; text: string }[] }[];
  };
  const f = data.features?.[0];
  if (!f) return null;
  const [lng, lat] = f.center;
  const country = f.context?.find((c) => String(c.id).startsWith("country"))?.text ?? "";
  return { center: { lat, lng }, country };
}

// Mapbox canonical categories → our place_types. Unknown ones just fail softly.
const CATEGORIES: { id: string; types: string[] }[] = [
  { id: "restaurant", types: ["restaurant"] },
  { id: "coffee", types: ["cafe", "coffee"] },
  { id: "bar", types: ["bar"] },
  { id: "bakery", types: ["bakery"] },
  { id: "museum", types: ["museum"] },
  { id: "park", types: ["park", "outdoors", "walk"] },
  { id: "tourist_attraction", types: ["attraction"] },
  { id: "nightlife", types: ["nightlife", "bar"] },
  { id: "art_gallery", types: ["art", "gallery"] },
];

export async function fetchMapboxPOIs(
  center: LatLng,
  perCategory = 6,
): Promise<RawPOI[]> {
  const out: RawPOI[] = [];
  for (const cat of CATEGORIES) {
    try {
      const url =
        `https://api.mapbox.com/search/searchbox/v1/category/${cat.id}` +
        `?access_token=${token()}&proximity=${center.lng},${center.lat}&limit=${perCategory}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = (await res.json()) as {
        features?: { properties?: { name?: string }; geometry?: { coordinates?: [number, number] } }[];
      };
      for (const f of data.features ?? []) {
        const name = f.properties?.name;
        const coords = f.geometry?.coordinates;
        if (!name || !coords) continue;
        out.push({ name, lng: coords[0], lat: coords[1], category: cat.id, placeTypes: cat.types });
      }
    } catch {
      // category unsupported / transient — skip
    }
  }
  return out;
}
