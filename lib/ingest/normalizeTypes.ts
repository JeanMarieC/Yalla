// Phase 14.1 — place_types normalizer.
//
// Every source speaks a different dialect: Mapbox emits "coffee", OSM emits
// "peak", the AI invents free-form tags. The planner ([planDay.ts]) only knows
// a fixed vocabulary for visit DURATIONS and time-of-day ordering, so a place
// tagged only "coffee" or "beach" gets the wrong duration / slot.
//
// This maps any raw tag set to canonical types the planner understands, while
// preserving the original tags as extra descriptors (they still help vibe
// matching). Canonical types come first so the type-overlap boost sees them.

// The schedulable vocabulary — MUST stay in sync with DURATIONS / TIME_PREF
// in lib/ai/planDay.ts. If you add a key there, add it here.
export const CANONICAL_TYPES = [
  "bakery",
  "pastry",
  "cafe",
  "wine bar",
  "bar",
  "cocktail bar",
  "restaurant",
  "local food",
  "food market",
  "record shop",
  "vinyl",
  "art",
  "museum",
  "viewpoint",
  "promenade",
  "coastal",
  "park",
  "walk",
  "live music",
  "neighborhood",
] as const;

export type CanonicalType = (typeof CANONICAL_TYPES)[number];

const CANON_SET = new Set<string>(CANONICAL_TYPES);

// Synonym → canonical. Keys are lowercased raw tags from any source.
const SYNONYMS: Record<string, CanonicalType> = {
  // cafés / coffee
  coffee: "cafe",
  coffeehouse: "cafe",
  "coffee shop": "cafe",
  espresso: "cafe",
  // bakeries / pastry
  boulangerie: "bakery",
  patisserie: "pastry",
  pâtisserie: "pastry",
  "pastry shop": "pastry",
  // bars / nightlife
  pub: "bar",
  beer: "bar",
  brewery: "bar",
  taproom: "bar",
  nightlife: "bar",
  nightclub: "cocktail bar",
  club: "bar",
  cocktails: "cocktail bar",
  cocktail: "cocktail bar",
  speakeasy: "cocktail bar",
  wine: "wine bar",
  winery: "wine bar",
  enoteca: "wine bar",
  // food
  bistro: "restaurant",
  eatery: "restaurant",
  diner: "restaurant",
  trattoria: "restaurant",
  food: "local food",
  "street food": "local food",
  market: "food market",
  "farmers market": "food market",
  // music / records
  records: "record shop",
  "record store": "record shop",
  vinyls: "vinyl",
  concert: "live music",
  gig: "live music",
  "music venue": "live music",
  jazz: "live music",
  // art
  gallery: "art",
  "art gallery": "art",
  exhibition: "art",
  // outdoors / scenic
  peak: "viewpoint",
  summit: "viewpoint",
  scenic: "viewpoint",
  lookout: "viewpoint",
  overlook: "viewpoint",
  beach: "coastal",
  seaside: "coastal",
  waterfront: "promenade",
  boardwalk: "promenade",
  garden: "park",
  gardens: "park",
  hiking: "walk",
  hike: "walk",
  trail: "walk",
  trailhead: "walk",
  // areas
  district: "neighborhood",
  quarter: "neighborhood",
};

/**
 * Normalize a raw tag set into [canonical types…, …other descriptors].
 * - Canonical types (mapped or already-canonical) are deduped and placed first.
 * - Remaining tags are kept (lowercased, deduped) as descriptors for matching.
 * Order matters: the type-overlap boost and planner read the leading types.
 */
export function normalizeTypes(raw: string[]): string[] {
  const canonical: string[] = [];
  const extras: string[] = [];
  const seen = new Set<string>();

  for (const t of raw) {
    const tag = t.trim().toLowerCase();
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);

    const canon = CANON_SET.has(tag) ? (tag as CanonicalType) : SYNONYMS[tag];
    if (canon) {
      if (!canonical.includes(canon)) canonical.push(canon);
    } else {
      extras.push(tag);
    }
  }

  return [...canonical, ...extras];
}

/** True if a tag set resolves to at least one schedulable canonical type. */
export function hasCanonicalType(types: string[]): boolean {
  return types.some((t) => CANON_SET.has(t.toLowerCase()));
}
