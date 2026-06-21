// Phase 4 smoke test. Run with:  npm run test:plan
// vibe + city -> matchPlacesToVibe (Phase 3) -> planDay (Phase 4) -> timed day.
// Makes real Gemini + Supabase + Mapbox calls.

import { config } from "dotenv";
config({ path: ".env.local" });

import { matchPlacesToVibe } from "../lib/places";
import { planDay, type PlanDayOptions } from "../lib/ai/planDay";

interface Example {
  vibe: string;
  city: string;
  start: PlanDayOptions["start"];
  startTime: string;
  budgetHours: number;
}

const EXAMPLES: Example[] = [
  {
    vibe: "moody evening — vinyl bars, a sea view, late local bites",
    city: "Beirut",
    start: { name: "Mar Mikhael", lat: 33.8992, lng: 35.5225 },
    startTime: "16:00",
    budgetHours: 7,
  },
  {
    vibe: "easy day — hidden bakeries, a quiet walk, a glass of wine",
    city: "Paris",
    start: { name: "Canal Saint-Martin", lat: 48.8709, lng: 2.3674 },
    startTime: "10:00",
    budgetHours: 8,
  },
];

async function run({ vibe, city, start, startTime, budgetHours }: Example) {
  console.log(`\n========================================================`);
  console.log(`"${vibe}"`);
  console.log(`${city} · start ${startTime} at ${start.name} · ${budgetHours}h budget`);
  console.log(`========================================================`);

  const matched = await matchPlacesToVibe(vibe, { city }, 10);
  const itinerary = await planDay(matched, {
    vibe,
    start,
    startTime,
    budgetHours,
  });

  if (itinerary.length === 0) {
    console.log("  (no itinerary fit the budget)");
    return;
  }

  for (const stop of itinerary) {
    console.log(
      `\n  ${stop.arrivalTime}  ${stop.place.name}  ` +
        `(${stop.place.place_types.join(", ")})`,
    );
    console.log(`         stay ${stop.durationMinutes}min · why: ${stop.whyItFits}`);
    if (stop.travelToNextMinutes > 0) {
      console.log(`         ↓ ${stop.travelToNextMinutes}min to next`);
    }
  }
  console.log("");
}

async function main() {
  for (const ex of EXAMPLES) {
    await run(ex);
  }
}

main().catch((err) => {
  console.error("\n✗ testPlan failed:\n");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
