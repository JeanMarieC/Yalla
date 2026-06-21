// Manual smoke test for Phase 1. Run with:  npm run test:vibe
// Loads secrets from .env.local, calls interpretVibe, and pretty-prints.
//
// This is a script, not a unit test — it makes a real Gemini API call so you
// can see actual tags come back.

import { config } from "dotenv";
import { interpretVibe } from "../lib/ai/interpretVibe";

// Load .env.local (tsx does not auto-load env files).
config({ path: ".env.local" });

const VIBE = "moody coastal, vinyl bars, hidden bakeries";

async function main() {
  console.log(`Interpreting vibe: "${VIBE}"\n`);
  const profile = await interpretVibe(VIBE);
  console.log(JSON.stringify(profile, null, 2));
}

main().catch((err) => {
  console.error("\n✗ interpretVibe failed:\n");
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
