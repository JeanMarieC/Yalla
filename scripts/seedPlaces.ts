// Phase 2 seed. Run with:  npm run seed:places
// Inserts a small multi-city set of real-ish places, embedding each description
// as it goes. Uses the SERVICE ROLE client (server-side only) to bypass RLS.
//
// Re-running is safe: it clears the places table first, then re-inserts.

import { config } from "dotenv";
config({ path: ".env.local" });

import { embed } from "../lib/ai/embed";
import { supabaseAdmin } from "../lib/supabase";

interface SeedPlace {
  name: string;
  description: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  place_types: string[];
}

// A handful per city, deliberately varied in vibe (coastal, bars, bakeries,
// viewpoints) so vibe search has something to discriminate between.
const PLACES: SeedPlace[] = [
  // --- Beirut, Lebanon (coastal Mediterranean city) ---
  {
    name: "Plan Bey",
    description:
      "A tiny art and record shop in Mar Mikhael stacked with vinyl, riso prints and zines. Moody, low-lit, and beloved by crate-diggers.",
    city: "Beirut",
    country: "Lebanon",
    lat: 33.8989,
    lng: 35.5219,
    place_types: ["record shop", "vinyl", "art"],
  },
  {
    name: "Internazionale",
    description:
      "A dim, intimate cocktail bar in Mar Mikhael spinning soul and jazz on a warm sound system. Dark wood, candlelight, a quietly cool crowd.",
    city: "Beirut",
    country: "Lebanon",
    lat: 33.8995,
    lng: 35.5231,
    place_types: ["bar", "cocktail bar", "vinyl"],
  },
  {
    name: "Corniche Beirut",
    description:
      "The seaside promenade along the Mediterranean, best at dusk when the light turns moody over the water and fishermen line the rail.",
    city: "Beirut",
    country: "Lebanon",
    lat: 33.8993,
    lng: 35.4762,
    place_types: ["promenade", "coastal", "viewpoint"],
  },
  {
    name: "Tawlet",
    description:
      "A bright farm-to-table kitchen showcasing home cooks from across Lebanon with a daily changing regional buffet.",
    city: "Beirut",
    country: "Lebanon",
    lat: 33.8978,
    lng: 35.5246,
    place_types: ["restaurant", "local food"],
  },

  // --- Paris, France ---
  {
    name: "La Cave du Paul Bert",
    description:
      "A cramped, characterful natural wine bar off rue Paul Bert pouring low-intervention bottles with charcuterie and small plates.",
    city: "Paris",
    country: "France",
    lat: 48.8523,
    lng: 2.3884,
    place_types: ["wine bar", "bar"],
  },
  {
    name: "Du Pain et des Idees",
    description:
      "A historic bakery near Canal Saint-Martin famous for its pain des amis and flaky pistachio-chocolate escargot pastries.",
    city: "Paris",
    country: "France",
    lat: 48.8716,
    lng: 2.3623,
    place_types: ["bakery", "pastry"],
  },
  {
    name: "Le Syndicat",
    description:
      "A dark, music-forward cocktail bar behind an unmarked poster-plastered door, championing French spirits with a moody backroom feel.",
    city: "Paris",
    country: "France",
    lat: 48.8696,
    lng: 2.3536,
    place_types: ["cocktail bar", "bar"],
  },
  {
    name: "Promenade Plantee",
    description:
      "An elevated garden walkway built on an old railway viaduct, a calm green ribbon above the streets of the 12th.",
    city: "Paris",
    country: "France",
    lat: 48.8492,
    lng: 2.3719,
    place_types: ["park", "walk", "viewpoint"],
  },

  // --- Lisbon, Portugal (Atlantic coastal city) ---
  {
    name: "Damas",
    description:
      "A scruffy, beloved Intendente bar and music venue with vinyl nights, cheap drinks and a moody late crowd spilling onto the street.",
    city: "Lisbon",
    country: "Portugal",
    lat: 38.7236,
    lng: -9.1357,
    place_types: ["bar", "vinyl", "live music"],
  },
  {
    name: "Manteigaria",
    description:
      "A bustling counter turning out warm, caramelized pasteis de nata all day; order one with cinnamon and eat it standing.",
    city: "Lisbon",
    country: "Portugal",
    lat: 38.7102,
    lng: -9.1432,
    place_types: ["bakery", "pastry"],
  },
  {
    name: "Miradouro da Senhora do Monte",
    description:
      "The highest viewpoint in the city, with a wide, moody panorama over the rooftops, the castle and the Tagus toward the coast.",
    city: "Lisbon",
    country: "Portugal",
    lat: 38.7196,
    lng: -9.1316,
    place_types: ["viewpoint", "coastal"],
  },
  {
    name: "A Brasileira",
    description:
      "A grand old Chiado cafe with carved wood and mirrors, an institution for a bica coffee among the morning bustle.",
    city: "Lisbon",
    country: "Portugal",
    lat: 38.7107,
    lng: -9.1426,
    place_types: ["cafe"],
  },
];

async function main() {
  const db = supabaseAdmin();

  console.log(`Clearing existing places...`);
  // Delete all rows (id is never the zero uuid, so this matches everything).
  const { error: delErr } = await db
    .from("places")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (delErr) throw new Error(`Failed to clear places: ${delErr.message}`);

  console.log(`Embedding + inserting ${PLACES.length} places...\n`);
  for (const place of PLACES) {
    const embedding = await embed(place.description, "RETRIEVAL_DOCUMENT");
    const { error } = await db.from("places").insert({
      name: place.name,
      description: place.description,
      city: place.city,
      country: place.country,
      // EWKT — note POINT(lng lat), longitude first.
      location: `SRID=4326;POINT(${place.lng} ${place.lat})`,
      place_types: place.place_types,
      embedding,
    });
    if (error) {
      throw new Error(`Failed to insert "${place.name}": ${error.message}`);
    }
    console.log(`  ✓ ${place.city.padEnd(8)} ${place.name}`);
  }

  console.log(`\nSeeded ${PLACES.length} places across 3 cities.`);
}

main().catch((err) => {
  console.error("\n✗ seedPlaces failed:\n");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
