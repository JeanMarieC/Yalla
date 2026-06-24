// Phase 13 — Outdoor / nature source (the hiking layer). OpenStreetMap via the
// Overpass API: free, no key, global. Pulls point-like outdoor features
// (peaks, viewpoints, beaches, parks, attractions) near a city center.

import type { LatLng } from "../routing";
import type { RawPOI } from "./mapbox";

const OVERPASS = "https://overpass-api.de/api/interpreter";

interface OverpassEl {
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

// Map an element's tags to our place_types (and confirm it's an outdoor feature).
function typesFor(tags: Record<string, string>): string[] | null {
  if (tags.natural === "peak") return ["peak", "viewpoint", "hiking", "outdoors"];
  if (tags.tourism === "viewpoint") return ["viewpoint", "scenic", "outdoors"];
  if (tags.natural === "beach") return ["beach", "coastal", "outdoors"];
  if (tags.leisure === "park") return ["park", "outdoors", "walk"];
  if (tags.tourism === "attraction") return ["attraction", "outdoors"];
  return null;
}

export async function fetchOSMOutdoors(
  center: LatLng,
  radiusMeters = 15000,
  limit = 30,
): Promise<RawPOI[]> {
  const r = radiusMeters;
  const a = `(around:${r},${center.lat},${center.lng})`;
  const query =
    `[out:json][timeout:25];` +
    `(` +
    `node${a}[natural=peak];` +
    `node${a}[tourism=viewpoint];` +
    `node${a}[natural=beach];` +
    `way${a}[leisure=park];` +
    `node${a}[tourism=attraction];` +
    `);` +
    `out center ${limit};`;

  let data: { elements?: OverpassEl[] };
  try {
    const res = await fetch(OVERPASS, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        // Overpass returns 406 without a proper User-Agent.
        "User-Agent": "Yalla/1.0 (travel itinerary app)",
        Accept: "application/json",
      },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!res.ok) return [];
    data = (await res.json()) as { elements?: OverpassEl[] };
  } catch {
    return [];
  }

  const out: RawPOI[] = [];
  for (const el of data.elements ?? []) {
    const tags = el.tags ?? {};
    const name = tags.name;
    if (!name) continue;
    const types = typesFor(tags);
    if (!types) continue;
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    out.push({ name, lat, lng: lon, category: types[0], placeTypes: types });
  }
  return out;
}
