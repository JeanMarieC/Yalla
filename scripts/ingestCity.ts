// Phase 13 — Ingest real places (+ outdoor activities) for any city.
//   npm run ingest -- "Vancouver"            (default radius/caps)
//   npm run ingest -- "Vancouver" 30         (cap total places)
//
// geocode -> Mapbox venues + OSM outdoors -> dedupe -> AI vibe -> embed -> insert
// (source 'api'). Re-running a city replaces its seeded/api rows (idempotent).

import { config } from "dotenv";
config({ path: ".env.local" });

import { embed } from "../lib/ai/embed";
import { supabaseAdmin } from "../lib/supabase";
import { geocodeCity, fetchMapboxPOIs, type RawPOI } from "../lib/ingest/mapbox";
import { fetchOSMOutdoors } from "../lib/ingest/osm";
import { describePOIs } from "../lib/ingest/enrich";

function dedupe(pois: RawPOI[]): RawPOI[] {
  const seen = new Set<string>();
  const out: RawPOI[] = [];
  for (const p of pois) {
    const key = p.name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function uniq(arr: string[]): string[] {
  return [...new Set(arr.map((s) => s.toLowerCase()))];
}

async function main() {
  const city = process.argv[2];
  const cap = Number(process.argv[3] ?? 40);
  if (!city) {
    console.error('Usage: npm run ingest -- "City Name" [maxPlaces]');
    process.exit(1);
  }

  console.log(`Geocoding ${city}…`);
  const geo = await geocodeCity(city);
  if (!geo) throw new Error(`Could not geocode "${city}".`);
  console.log(`  -> ${geo.center.lat.toFixed(3)}, ${geo.center.lng.toFixed(3)} (${geo.country})`);

  console.log("Fetching venues (Mapbox) + outdoors (OSM)…");
  const [urban, outdoors] = await Promise.all([
    fetchMapboxPOIs(geo.center, 6),
    fetchOSMOutdoors(geo.center, 15000, 30),
  ]);
  // Interleave so the (scarcer) outdoor layer always makes the cut, not just
  // the first N urban venues.
  const u = dedupe(urban);
  const o = dedupe(outdoors);
  const mixed: RawPOI[] = [];
  for (let i = 0; i < Math.max(u.length, o.length); i++) {
    if (u[i]) mixed.push(u[i]);
    if (o[i]) mixed.push(o[i]);
  }
  const pois = dedupe(mixed).slice(0, cap);
  const outdoorCount = pois.filter((p) => p.placeTypes.includes("outdoors")).length;
  console.log(
    `  -> ${urban.length} urban + ${outdoors.length} outdoor -> ${pois.length} kept (${outdoorCount} outdoor)`,
  );
  if (pois.length === 0) throw new Error("No POIs found for this city.");

  console.log("Writing vibe descriptions (AI)…");
  const enriched = await describePOIs(city, geo.country, pois);

  const db = supabaseAdmin();
  console.log(`Replacing existing seeded/api places for ${city}…`);
  await db.from("places").delete().eq("city", city).in("source", ["seeded", "api"]);

  console.log("Embedding + inserting…\n");
  let inserted = 0;
  for (let i = 0; i < pois.length; i++) {
    const p = pois[i];
    const e = enriched[i];
    const embedding = await embed(e.description, "RETRIEVAL_DOCUMENT");
    const { error } = await db.from("places").insert({
      name: p.name,
      description: e.description,
      city,
      country: geo.country || city,
      location: `SRID=4326;POINT(${p.lng} ${p.lat})`,
      place_types: uniq([...p.placeTypes, ...e.tags]),
      embedding,
      source: "api",
    });
    if (error) {
      console.warn(`  ! skip ${p.name}: ${error.message}`);
      continue;
    }
    inserted++;
    if (inserted % 5 === 0) console.log(`  …${inserted}`);
  }

  console.log(`\nIngested ${inserted} places for ${city}.`);
}

main().catch((err) => {
  console.error("\n✗ ingestCity failed:\n");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
