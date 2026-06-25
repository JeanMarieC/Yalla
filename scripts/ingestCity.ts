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
import { fetchOSMOutdoors, fetchOSMUrban } from "../lib/ingest/osm";
import { describePOIs } from "../lib/ingest/enrich";
import { normalizeTypes } from "../lib/ingest/normalizeTypes";
import { parseOpeningHours } from "../lib/ingest/openingHours";

// Dedupe across sources. OSM-identity wins first, then name (so a Mapbox row
// for a place OSM already gave us — richer, with hours — is dropped). Pass the
// rich OSM lists BEFORE Mapbox so the kept copy is the detailed one.
function dedupe(pois: RawPOI[]): RawPOI[] {
  const seenName = new Set<string>();
  const seenOsm = new Set<string>();
  const out: RawPOI[] = [];
  for (const p of pois) {
    const nameKey = p.name.trim().toLowerCase();
    if (!nameKey) continue;
    const osmKey = p.osmType && p.osmId != null ? `${p.osmType}/${p.osmId}` : null;
    if (osmKey && seenOsm.has(osmKey)) continue;
    if (seenName.has(nameKey)) continue;
    seenName.add(nameKey);
    if (osmKey) seenOsm.add(osmKey);
    out.push(p);
  }
  return out;
}

async function main() {
  const city = process.argv[2];
  const cap = Number(process.argv[3] ?? 60);
  if (!city) {
    console.error('Usage: npm run ingest -- "City Name" [maxPlaces]');
    process.exit(1);
  }

  console.log(`Geocoding ${city}…`);
  const geo = await geocodeCity(city);
  if (!geo) throw new Error(`Could not geocode "${city}".`);
  console.log(`  -> ${geo.center.lat.toFixed(3)}, ${geo.center.lng.toFixed(3)} (${geo.country})`);

  console.log("Fetching venues (OSM + Mapbox) + outdoors (OSM)…");
  const [osmUrban, mapboxUrban, outdoors] = await Promise.all([
    fetchOSMUrban(geo.center, 150), // rich + multi-point sampled (hours/address/prominence)
    fetchMapboxPOIs(geo.center, 6), // supplement (no hours)
    fetchOSMOutdoors(geo.center, 15000, 30),
  ]);
  // OSM first so its richer copy wins dedupe over a Mapbox duplicate.
  const urbanAll = dedupe([...osmUrban, ...mapboxUrban]);
  const outdoorAll = dedupe(outdoors);
  // Interleave so the (scarcer) outdoor layer always makes the cut.
  const mixed: RawPOI[] = [];
  for (let i = 0; i < Math.max(urbanAll.length, outdoorAll.length); i++) {
    if (urbanAll[i]) mixed.push(urbanAll[i]);
    if (outdoorAll[i]) mixed.push(outdoorAll[i]);
  }
  const pois = dedupe(mixed).slice(0, cap);
  const withHours = pois.filter((p) => p.rawHours).length;
  console.log(
    `  -> ${osmUrban.length} osm + ${mapboxUrban.length} mapbox + ${outdoors.length} outdoor` +
      ` -> ${pois.length} kept (${withHours} with hours)`,
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
      // Canonical schedulable types first (so planDay gets right durations /
      // time-of-day), then descriptive tags for matching. Phase 14.1.
      place_types: normalizeTypes([...p.placeTypes, ...e.tags]),
      embedding,
      source: "api",
      // Phase 14.2 — rich location facts (null where the source lacked them).
      address: p.address ?? null,
      neighborhood: p.neighborhood ?? null,
      raw_opening_hours: p.rawHours ?? null,
      opening_hours: parseOpeningHours(p.rawHours), // jsonb; null = unknown
      prominence: p.prominence ?? 0,
      osm_type: p.osmType ?? null,
      osm_id: p.osmId ?? null,
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
