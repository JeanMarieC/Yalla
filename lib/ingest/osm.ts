// Phase 13/14 — OpenStreetMap source (Overpass API): free, no key, global.
//   fetchOSMOutdoors — peaks, viewpoints, beaches, parks (the hiking layer).
//   fetchOSMUrban    — cafés, bars, restaurants, bakeries, museums… WITH their
//                      opening_hours, address and prominence signals (Phase 14.2).
// Facts come from OSM tags; the AI only adds vibe later.

import type { LatLng } from "../routing";
import type { RawPOI } from "./mapbox";

const OVERPASS = "https://overpass-api.de/api/interpreter";

interface OverpassEl {
  type: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

async function runOverpass(query: string): Promise<OverpassEl[]> {
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
    const data = (await res.json()) as { elements?: OverpassEl[] };
    return data.elements ?? [];
  } catch {
    return [];
  }
}

// --- Shared tag readers (Phase 14.2) ---------------------------------------

// A free 0..1 quality proxy: landmarks worth trusting tend to be richly tagged
// and linked to Wikidata/Wikipedia. No paid ratings API involved.
export function prominenceFromTags(tags: Record<string, string>): number {
  let s = 0;
  if (tags.wikidata) s += 0.45;
  if (tags.wikipedia) s += 0.25;
  if (tags.tourism) s += 0.15;
  if (tags.website || tags["contact:website"]) s += 0.08;
  if (tags.phone || tags["contact:phone"]) s += 0.04;
  if (tags.stars) s += 0.1;
  return Math.min(1, Number(s.toFixed(3)));
}

// Build a human address from addr:* tags (best-effort).
function addressFromTags(tags: Record<string, string>): string | undefined {
  const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  const parts = [street, tags["addr:city"]].filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

function neighborhoodFromTags(tags: Record<string, string>): string | undefined {
  return (
    tags["addr:suburb"] ||
    tags["addr:neighbourhood"] ||
    tags["addr:district"] ||
    tags["addr:quarter"] ||
    undefined
  );
}

function osmTypeOf(el: OverpassEl): "node" | "way" | "relation" | undefined {
  return el.type === "node" || el.type === "way" || el.type === "relation"
    ? el.type
    : undefined;
}

// Turn an Overpass element into a rich RawPOI (or null if unusable).
function toRichPOI(el: OverpassEl, types: string[]): RawPOI | null {
  const tags = el.tags ?? {};
  const name = tags.name;
  if (!name) return null;
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat == null || lng == null) return null;
  return {
    name,
    lat,
    lng,
    category: types[0],
    placeTypes: types,
    osmType: osmTypeOf(el),
    osmId: el.id,
    rawHours: tags.opening_hours,
    address: addressFromTags(tags),
    neighborhood: neighborhoodFromTags(tags),
    prominence: prominenceFromTags(tags),
  };
}

// --- Outdoor layer (Phase 13) ----------------------------------------------

function outdoorTypesFor(tags: Record<string, string>): string[] | null {
  if (tags.natural === "peak") return ["viewpoint", "outdoors", "walk"];
  if (tags.tourism === "viewpoint") return ["viewpoint", "outdoors"];
  if (tags.natural === "beach") return ["coastal", "outdoors"];
  if (tags.leisure === "park") return ["park", "outdoors", "walk"];
  if (tags.tourism === "attraction") return ["attraction", "outdoors"];
  return null;
}

export async function fetchOSMOutdoors(
  center: LatLng,
  radiusMeters = 15000,
  limit = 30,
): Promise<RawPOI[]> {
  const a = `(around:${radiusMeters},${center.lat},${center.lng})`;
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

  const out: RawPOI[] = [];
  for (const el of await runOverpass(query)) {
    const types = outdoorTypesFor(el.tags ?? {});
    if (!types) continue;
    const poi = toRichPOI(el, types);
    if (poi) out.push(poi);
  }
  return out;
}

// --- Urban layer (Phase 14.2) ----------------------------------------------

// Map an urban element's tags to our place_types (normalized later in ingest).
function urbanTypesFor(tags: Record<string, string>): string[] | null {
  if (tags.amenity === "cafe") return ["cafe"];
  if (tags.amenity === "restaurant") return ["restaurant"];
  if (tags.amenity === "bar") return ["bar"];
  if (tags.amenity === "pub") return ["bar", "pub"];
  if (tags.amenity === "biergarten") return ["bar"];
  if (tags.amenity === "nightclub") return ["cocktail bar", "nightlife"];
  if (tags.amenity === "ice_cream") return ["dessert", "cafe"];
  if (tags.amenity === "marketplace") return ["food market"];
  if (tags.shop === "bakery") return ["bakery", "pastry"];
  if (tags.shop === "pastry") return ["pastry"];
  if (tags.shop === "music") return ["record shop", "vinyl"];
  if (tags.shop === "art") return ["art", "gallery"];
  if (tags.tourism === "museum") return ["museum"];
  if (tags.tourism === "gallery") return ["art", "gallery"];
  return null;
}

// Sample the center plus a ring of points around it, so coverage spreads across
// neighborhoods instead of clustering downtown. Returns [center, N, E, S, W…].
export function samplePoints(center: LatLng, ringMeters: number, ringCount = 4): LatLng[] {
  const pts: LatLng[] = [{ ...center }];
  const dLat = ringMeters / 111_320;
  const dLng = ringMeters / (111_320 * Math.cos((center.lat * Math.PI) / 180));
  for (let i = 0; i < ringCount; i++) {
    const angle = (2 * Math.PI * i) / ringCount;
    pts.push({
      lat: center.lat + dLat * Math.sin(angle),
      lng: center.lng + dLng * Math.cos(angle),
    });
  }
  return pts;
}

const URBAN_SELECTORS = [
  "[amenity=cafe][name]",
  "[amenity=restaurant][name]",
  "[amenity=bar][name]",
  "[amenity=pub][name]",
  "[amenity=nightclub][name]",
  "[amenity=marketplace][name]",
  "[shop=bakery][name]",
  "[shop=music][name]",
  "[shop=art][name]",
  "[tourism=museum][name]",
  "[tourism=gallery][name]",
];

/**
 * Urban venues across a city, WITH hours/address/prominence where OSM has them.
 * Samples several points (center + a ring) so the catalog isn't downtown-only;
 * all points are unioned into ONE Overpass call to stay within rate limits.
 */
export async function fetchOSMUrban(
  center: LatLng,
  limit = 150,
  ringMeters = 3000,
  perPointRadius = 2500,
): Promise<RawPOI[]> {
  const points = samplePoints(center, ringMeters);
  const selectors: string[] = [];
  for (const p of points) {
    const a = `(around:${perPointRadius},${p.lat},${p.lng})`;
    for (const sel of URBAN_SELECTORS) selectors.push(`node${a}${sel}`);
  }
  const query = `[out:json][timeout:30];(${selectors.join(";")};);out body ${limit};`;

  const out: RawPOI[] = [];
  for (const el of await runOverpass(query)) {
    const types = urbanTypesFor(el.tags ?? {});
    if (!types) continue;
    const poi = toRichPOI(el, types);
    if (poi) out.push(poi);
  }
  return out;
}
