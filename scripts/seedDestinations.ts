// Phase 12 seed. Run with:  npm run seed:destinations
// A curated global set of real destinations with authored, evocative
// descriptions (incl. signature seasons/events) that get embedded for vibe
// matching. Facts (place, coords, season) are real; the prose sets the vibe.

import { config } from "dotenv";
config({ path: ".env.local" });

import { embed } from "../lib/ai/embed";
import { supabaseAdmin } from "../lib/supabase";

interface SeedDestination {
  name: string;
  country: string;
  lat: number;
  lng: number;
  tags: string[];
  bestMonths: number[];
  description: string;
}

const DESTINATIONS: SeedDestination[] = [
  // --- Hiking / mountains / outdoors ---
  { name: "Chamonix", country: "France", lat: 45.9237, lng: 6.8694, tags: ["hiking", "mountains", "alpine", "outdoors", "scenic"], bestMonths: [6, 7, 8, 9], description: "Alpine hiking capital under Mont Blanc — high trails, glaciers, cable cars to the clouds, and hearty mountain food in summer." },
  { name: "Interlaken", country: "Switzerland", lat: 46.6863, lng: 7.8632, tags: ["hiking", "lakes", "adventure", "outdoors", "scenic"], bestMonths: [6, 7, 8, 9], description: "Between two turquoise lakes, a launchpad for Jungfrau hikes, paragliding and waterfall valleys — pure alpine adventure." },
  { name: "Banff", country: "Canada", lat: 51.1784, lng: -115.5708, tags: ["hiking", "lakes", "wildlife", "outdoors", "scenic"], bestMonths: [6, 7, 8, 9], description: "Rocky Mountain trails to impossibly blue glacial lakes, larch forests and wildlife — a postcard for serious hikers." },
  { name: "Dolomites (Cortina)", country: "Italy", lat: 46.5405, lng: 12.1357, tags: ["hiking", "mountains", "scenic", "outdoors"], bestMonths: [6, 7, 8, 9], description: "Jagged pale peaks, via ferrata routes and meadow huts serving polenta — dramatic Italian alpine hiking." },
  { name: "Queenstown", country: "New Zealand", lat: -45.0312, lng: 168.6626, tags: ["hiking", "adventure", "lakes", "outdoors"], bestMonths: [12, 1, 2, 3], description: "Adventure capital on a glacial lake — alpine tracks, bungee, and Southern Alps scenery, best in the southern summer." },
  { name: "Cinque Terre", country: "Italy", lat: 44.1461, lng: 9.6439, tags: ["coastal", "hiking", "villages", "scenic"], bestMonths: [5, 6, 9], description: "Five cliffside villages linked by coastal trails above the Ligurian sea — pastel houses, pesto and vineyard paths." },
  { name: "Reykjavik & around", country: "Iceland", lat: 64.1466, lng: -21.9426, tags: ["nature", "waterfalls", "hiking", "northern lights"], bestMonths: [6, 7, 8, 10, 11, 2], description: "Base for waterfalls, geysers and lava fields — midnight-sun hikes in summer, northern lights on dark winter nights." },

  // --- Beach / coastal ---
  { name: "Bali", country: "Indonesia", lat: -8.4095, lng: 115.1889, tags: ["beach", "surf", "temples", "wellness"], bestMonths: [5, 6, 7, 8, 9], description: "Surf beaches, rice-terrace mornings, temple sunsets and wellness retreats across a lush Indonesian island." },
  { name: "Tulum", country: "Mexico", lat: 20.2114, lng: -87.4654, tags: ["beach", "cenotes", "ruins", "wellness"], bestMonths: [11, 12, 1, 2, 3], description: "White-sand Caribbean beaches, jungle cenotes and clifftop Mayan ruins — barefoot-chic in the dry winter months." },
  { name: "Amalfi Coast", country: "Italy", lat: 40.6333, lng: 14.6029, tags: ["coastal", "romantic", "scenic", "food"], bestMonths: [5, 6, 9], description: "Lemon groves and pastel towns tumbling to a turquoise sea — romantic drives, seafood and cliffside terraces." },
  { name: "Santorini", country: "Greece", lat: 36.3932, lng: 25.4615, tags: ["romantic", "coastal", "sunsets", "scenic"], bestMonths: [5, 6, 9], description: "Whitewashed cliffs over a caldera, legendary sunsets and quiet blue-domed lanes — peak romance off the beaten crowds." },
  { name: "Cape Town", country: "South Africa", lat: -33.9249, lng: 18.4241, tags: ["hiking", "beach", "wine", "scenic"], bestMonths: [11, 12, 1, 2, 3], description: "Table Mountain hikes above Atlantic beaches, with winelands day-trips and a buzzing food scene in the southern summer." },

  // --- Culture / food / romance ---
  { name: "Paris", country: "France", lat: 48.8566, lng: 2.3522, tags: ["romantic", "art", "food", "culture"], bestMonths: [5, 6, 7, 9], description: "The romance benchmark — café terraces, world-class art and food. In July, Bastille Day brings fireworks over the Seine and street balls." },
  { name: "Rome", country: "Italy", lat: 41.9028, lng: 12.4964, tags: ["history", "food", "culture", "romantic"], bestMonths: [4, 5, 9, 10], description: "Layered ruins, baroque squares and trattoria dinners — an open-air museum best wandered in mild spring and autumn." },
  { name: "Lisbon", country: "Portugal", lat: 38.7223, lng: -9.1393, tags: ["coastal", "food", "music", "culture"], bestMonths: [5, 6, 9, 10], description: "Tiled hills, miradouro views and aching fado nights by the Tagus — sunny, soulful and easy to wander." },
  { name: "Istanbul", country: "Turkey", lat: 41.0082, lng: 28.9784, tags: ["culture", "food", "history", "markets"], bestMonths: [4, 5, 9, 10], description: "Two continents of mosques, bazaars and Bosphorus ferries — deep history and some of the best street food anywhere." },
  { name: "Tokyo", country: "Japan", lat: 35.6762, lng: 139.6503, tags: ["food", "city", "nightlife", "culture"], bestMonths: [3, 4, 10, 11], description: "Neon alleys, sublime food at every price and quiet shrines — cherry blossoms in spring, crisp clear autumns." },
  { name: "Kyoto", country: "Japan", lat: 35.0116, lng: 135.7681, tags: ["culture", "temples", "scenic", "calm"], bestMonths: [3, 4, 11], description: "Temples, bamboo groves and geisha lanes — at its most magical under cherry blossom or fiery autumn maples." },
  { name: "Marrakech", country: "Morocco", lat: 31.6295, lng: -7.9811, tags: ["culture", "markets", "food", "riads"], bestMonths: [3, 4, 10, 11], description: "A sensory medina of souks, spice and hidden riad courtyards — best in the mild shoulder seasons." },
  { name: "Mexico City", country: "Mexico", lat: 19.4326, lng: -99.1332, tags: ["food", "art", "culture", "nightlife"], bestMonths: [10, 11, 3, 4], description: "A food and art powerhouse — markets, murals and mezcal. Late October brings the marigold blaze of Day of the Dead." },
  { name: "Beirut", country: "Lebanon", lat: 33.8938, lng: 35.5018, tags: ["nightlife", "food", "coastal", "culture"], bestMonths: [5, 6, 9, 10], description: "Mediterranean grit and glamour — seaside corniche, legendary mezze and a nightlife that refuses to quit." },

  // --- Nightlife / events ---
  { name: "Berlin", country: "Germany", lat: 52.52, lng: 13.405, tags: ["nightlife", "art", "history", "music"], bestMonths: [5, 6, 7, 8, 9], description: "Techno temples, raw history and a fearless art scene — long warm-weather nights that genuinely never seem to end." },
  { name: "Barcelona", country: "Spain", lat: 41.3851, lng: 2.1734, tags: ["beach", "nightlife", "architecture", "food"], bestMonths: [5, 6, 9], description: "Gaudí curves, tapas crawls and city beaches — sunny days roll straight into late tapas and seaside clubs." },
  { name: "Amsterdam", country: "Netherlands", lat: 52.3676, lng: 4.9041, tags: ["canals", "museums", "cycling", "nightlife"], bestMonths: [4, 5, 6], description: "Canal rings, world-class museums and bike-everywhere ease. King's Day in late April turns the whole city orange." },
  { name: "New Orleans", country: "USA", lat: 29.9511, lng: -90.0715, tags: ["music", "food", "nightlife", "culture"], bestMonths: [2, 3, 10], description: "Jazz spilling from every door, Creole feasts and brass-band streets — peaking in the riotous color of Mardi Gras." },
  { name: "Rio de Janeiro", country: "Brazil", lat: -22.9068, lng: -43.1729, tags: ["beach", "nightlife", "scenic", "music"], bestMonths: [12, 1, 2], description: "Beaches under mountains, samba bars and that view from Sugarloaf — and in February, the world's biggest Carnival." },
  { name: "Munich", country: "Germany", lat: 48.1351, lng: 11.582, tags: ["beer", "food", "festivals", "culture"], bestMonths: [9, 10], description: "Beer halls, alpine day-trips and grand squares — late September to October is Oktoberfest, the original beer festival." },
  { name: "Pamplona", country: "Spain", lat: 42.8125, lng: -1.6458, tags: ["festivals", "culture", "nightlife"], bestMonths: [7], description: "A handsome Navarrese city that erupts each July for San Fermín — the running of the bulls and days of nonstop fiesta." },
  { name: "Edinburgh", country: "Scotland", lat: 55.9533, lng: -3.1883, tags: ["history", "festivals", "culture", "scenic"], bestMonths: [8], description: "A dramatic old town of crags and closes that explodes every August into the Fringe — the planet's largest arts festival." },
  { name: "Vancouver", country: "Canada", lat: 49.2827, lng: -123.1207, tags: ["hiking", "coastal", "nature", "food"], bestMonths: [6, 7, 8, 9], description: "Mountains meet the sea — Sea-to-Sky trails, forest parks and a great food scene, glorious through the dry summer." },
];

async function main() {
  const db = supabaseAdmin();

  console.log("Clearing destinations...");
  const { error: delErr } = await db
    .from("destinations")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (delErr) throw new Error(`Failed to clear: ${delErr.message}`);

  console.log(`Embedding + inserting ${DESTINATIONS.length} destinations...\n`);
  for (const d of DESTINATIONS) {
    const embedding = await embed(`${d.name}, ${d.country}. ${d.description}`, "RETRIEVAL_DOCUMENT");
    const { error } = await db.from("destinations").insert({
      name: d.name,
      country: d.country,
      lat: d.lat,
      lng: d.lng,
      description: d.description,
      tags: d.tags,
      best_months: d.bestMonths,
      embedding,
    });
    if (error) throw new Error(`Failed to insert "${d.name}": ${error.message}`);
    console.log(`  ✓ ${d.name}, ${d.country}`);
  }

  console.log(`\nSeeded ${DESTINATIONS.length} destinations.`);
}

main().catch((err) => {
  console.error("\n✗ seedDestinations failed:\n");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
