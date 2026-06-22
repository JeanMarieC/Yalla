// Phase 7 seed. Run with:  npm run seed:events
// Inserts this-week events across the three cities, embedding each description.
// Times are computed relative to NOW, so seeded events are always "live" within
// the Pulse window whenever you run this. Re-running replaces seeded events
// (user-submitted events are left untouched).

import { config } from "dotenv";
config({ path: ".env.local" });

import { embed } from "../lib/ai/embed";
import { supabaseAdmin } from "../lib/supabase";

const HOUR = 3600_000;
const hoursFromNow = (h: number) => new Date(Date.now() + h * HOUR).toISOString();

interface SeedEvent {
  name: string;
  description: string;
  city: string;
  lat: number;
  lng: number;
  tags: string[];
  startInHours: number;
  durationHours: number;
}

const EVENTS: SeedEvent[] = [
  // --- Beirut ---
  {
    name: "Mar Mikhael Vinyl Night",
    description:
      "A late, moody listening session spinning soul, dub and rare grooves on a warm sound system in a dim Mar Mikhael bar.",
    city: "Beirut",
    lat: 33.8995,
    lng: 35.5231,
    tags: ["live music", "vinyl", "bar", "night"],
    startInHours: 48,
    durationHours: 5,
  },
  {
    name: "Beirut Artisan Market",
    description:
      "An open-air weekend market of local makers — ceramics, prints, slow food — along a sunny stretch near the sea.",
    city: "Beirut",
    lat: 33.8965,
    lng: 35.5012,
    tags: ["market", "design", "local", "daytime"],
    startInHours: -18, // already running
    durationHours: 96,
  },
  {
    name: "Corniche Sunset Run",
    description:
      "A relaxed group run along the coastal promenade timed to catch the light dropping over the Mediterranean.",
    city: "Beirut",
    lat: 33.8993,
    lng: 35.4762,
    tags: ["outdoor", "run", "coastal", "sunset"],
    startInHours: 72,
    durationHours: 2,
  },

  // --- Paris ---
  {
    name: "Canal Saint-Martin Open-Air Cinema",
    description:
      "A canalside evening screening with deck chairs and quiet crowds, a gentle warm-weather night out by the water.",
    city: "Paris",
    lat: 48.8709,
    lng: 2.3674,
    tags: ["cinema", "outdoor", "night", "calm"],
    startInHours: 26,
    durationHours: 3,
  },
  {
    name: "Belleville Natural Wine Fair",
    description:
      "A multi-day fair of low-intervention growers pouring in a buzzy Belleville courtyard, all small glasses and good chatter.",
    city: "Paris",
    lat: 48.8721,
    lng: 2.3771,
    tags: ["wine", "market", "tasting"],
    startInHours: 96,
    durationHours: 48,
  },
  {
    name: "Le Syndicat Late Jazz Set",
    description:
      "A dark backroom jazz set, French spirits and a moody hush, hidden behind an unmarked poster-plastered door.",
    city: "Paris",
    lat: 48.8696,
    lng: 2.3536,
    tags: ["jazz", "bar", "music", "moody"],
    startInHours: 50,
    durationHours: 4,
  },

  // --- Lisbon ---
  {
    name: "Alfama Fado Night",
    description:
      "An intimate, candlelit fado evening in a tiny Alfama room — aching vocals, guitarra, and very few seats.",
    city: "Lisbon",
    lat: 38.7128,
    lng: -9.1295,
    tags: ["fado", "music", "intimate", "night"],
    startInHours: 30,
    durationHours: 3,
  },
  {
    name: "Time Out Market Tasting Week",
    description:
      "A week of tasting menus from Lisbon's best stalls under one roof — lively, casual, all-day grazing.",
    city: "Lisbon",
    lat: 38.7077,
    lng: -9.1459,
    tags: ["food", "market", "tasting", "daytime"],
    startInHours: -12,
    durationHours: 120,
  },
  {
    name: "Miradouro Sunset Sessions",
    description:
      "Mellow DJ sets at a hilltop viewpoint as the light turns gold over the rooftops toward the river and coast.",
    city: "Lisbon",
    lat: 38.7196,
    lng: -9.1316,
    tags: ["music", "viewpoint", "coastal", "sunset"],
    startInHours: 70,
    durationHours: 4,
  },
];

async function main() {
  const db = supabaseAdmin();

  console.log("Clearing seeded events...");
  const { error: delErr } = await db
    .from("events")
    .delete()
    .eq("source", "seeded");
  if (delErr) throw new Error(`Failed to clear events: ${delErr.message}`);

  console.log(`Embedding + inserting ${EVENTS.length} events...\n`);
  for (const ev of EVENTS) {
    const embedding = await embed(ev.description, "RETRIEVAL_DOCUMENT");
    const { error } = await db.from("events").insert({
      name: ev.name,
      description: ev.description,
      city: ev.city,
      location: `SRID=4326;POINT(${ev.lng} ${ev.lat})`,
      start_time: hoursFromNow(ev.startInHours),
      end_time: hoursFromNow(ev.startInHours + ev.durationHours),
      tags: ev.tags,
      embedding,
      source: "seeded",
      submitted_by: null,
    });
    if (error) throw new Error(`Failed to insert "${ev.name}": ${error.message}`);
    console.log(`  ✓ ${ev.city.padEnd(8)} ${ev.name}`);
  }

  console.log(`\nSeeded ${EVENTS.length} events across 3 cities (this week).`);
}

main().catch((err) => {
  console.error("\n✗ seedEvents failed:\n");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
