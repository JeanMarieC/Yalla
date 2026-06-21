// Phase 3 smoke test. Run with:  npm run test:match
// Shows the full pipeline picking sensibly different places per city + per vibe.
// Makes real Gemini + Supabase calls.

import { config } from "dotenv";
config({ path: ".env.local" });

import { interpretVibe } from "../lib/ai/interpretVibe";
import { buildVibeQuery, matchPlacesToVibe } from "../lib/places";

function printRanked(places: Awaited<ReturnType<typeof matchPlacesToVibe>>) {
  if (places.length === 0) {
    console.log("  (no matches)");
    return;
  }
  for (const p of places) {
    const dist =
      typeof p.distanceMeters === "number"
        ? `  ${Math.round(p.distanceMeters)}m`
        : "";
    console.log(
      `  ${p.score.toFixed(3)} (sim ${p.similarity.toFixed(3)})  ` +
        `${p.name} (${p.city}) — ${p.place_types.join(", ")}${dist}`,
    );
  }
}

async function main() {
  // --- Example 1: Paris. Also reveal how the vibe is interpreted + shaped. ---
  const vibe1 = "moody coastal, vinyl bars, hidden bakeries";
  console.log(`\n=== "${vibe1}" in Paris ===`);

  const profile1 = await interpretVibe(vibe1);
  console.log("  interpretVibe ->", JSON.stringify(profile1));
  console.log("  embedded query ->", JSON.stringify(buildVibeQuery(profile1)));
  console.log("  ranked:");
  printRanked(await matchPlacesToVibe(vibe1, { city: "Paris" }, 5));

  // --- Example 2: a different vibe, a different city. ---
  const vibe2 = "lively local food and old cafes, easy daytime wandering";
  console.log(`\n=== "${vibe2}" in Beirut ===`);
  printRanked(await matchPlacesToVibe(vibe2, { city: "Beirut" }, 5));

  console.log("");
}

main().catch((err) => {
  console.error("\n✗ testMatch failed:\n");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
