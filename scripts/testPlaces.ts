// Phase 2 smoke test. Run with:  npm run test:places
// Exercises both retrieval paths against real data so you can see them work
// across cities. Makes real Gemini + Supabase calls.

import { config } from "dotenv";
config({ path: ".env.local" });

import { findPlacesByVibe, findPlacesNearby } from "../lib/places";

async function main() {
  // 1. Vibe search, scoped to one city -----------------------------------
  const vibe = "moody coastal, vinyl bars";
  const city = "Lisbon";
  console.log(`\n=== Vibe search: "${vibe}" in ${city} ===`);
  const matches = await findPlacesByVibe(vibe, city, 5);
  for (const m of matches) {
    console.log(
      `  ${m.similarity.toFixed(3)}  ${m.name} (${m.city}) — ${m.place_types.join(", ")}`,
    );
  }

  // Same vibe, no city filter → results from any city, ranked together.
  console.log(`\n=== Same vibe, all cities ===`);
  const global = await findPlacesByVibe(vibe, null, 5);
  for (const m of global) {
    console.log(`  ${m.similarity.toFixed(3)}  ${m.name} (${m.city})`);
  }

  // 2. Proximity search ---------------------------------------------------
  // Around Mar Mikhael, Beirut, within 3km.
  const lat = 33.8992;
  const lng = 35.5225;
  const radius = 3000;
  console.log(`\n=== Nearby: within ${radius}m of (${lat}, ${lng}) [Beirut] ===`);
  const nearby = await findPlacesNearby(lat, lng, radius);
  for (const n of nearby) {
    console.log(
      `  ${Math.round(n.distance_meters).toString().padStart(5)}m  ${n.name} (${n.city})`,
    );
  }

  console.log("");
}

main().catch((err) => {
  console.error("\n✗ testPlaces failed:\n");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
