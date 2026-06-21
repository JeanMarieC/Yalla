// Phase 1 — First AI spark.
// Turn a free-text vibe sentence into clean, structured tags via Gemini.
//
// AI's job here is *understanding and language* only (CLAUDE.md principle 1):
// it reads a fuzzy human phrase and returns structured tags. No facts, no math.
// Server-side only — the API key is read from process.env and never shipped to
// the browser (no NEXT_PUBLIC_ prefix).

import { GoogleGenAI, Type } from "@google/genai";

/**
 * Structured interpretation of a free-text vibe.
 * Exported so later phases (place matching, itinerary building) can import it.
 */
export interface VibeProfile {
  /** Emotional tone words, e.g. "moody", "romantic", "energetic". */
  moods: string[];
  /** Kinds of places implied, e.g. "wine bar", "bakery", "viewpoint". */
  placeTypes: string[];
  /** Free-form descriptors to match against place data later. */
  keywords: string[];
  /** Overall tempo of the day, if the vibe implies one. */
  pace?: "relaxed" | "packed";
}

// Latest free-tier Gemini Flash model. Flash is fast + cheap and covered by the
// free tier — ideal for this lightweight parsing step.
const MODEL = "gemini-2.5-flash";

// The response schema. This is the heart of "JSON mode": we hand Gemini an
// explicit shape and it is constrained to emit JSON that conforms to it —
// so we never have to scrape JSON out of prose or strip ```json fences.
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    moods: { type: Type.ARRAY, items: { type: Type.STRING } },
    placeTypes: { type: Type.ARRAY, items: { type: Type.STRING } },
    keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
    pace: { type: Type.STRING, enum: ["relaxed", "packed"], nullable: true },
  },
  // pace is intentionally omitted from required → it stays optional.
  required: ["moods", "placeTypes", "keywords"],
  propertyOrdering: ["moods", "placeTypes", "keywords", "pace"],
};

const SYSTEM_INSTRUCTION = [
  "You interpret a traveler's vibe phrase into structured tags for matching real places.",
  "Be concise and concrete. Prefer short, lowercase tags.",
  "moods: 2-5 emotional tone words.",
  "placeTypes: kinds of venues implied (e.g. 'wine bar', 'bakery', 'viewpoint').",
  "keywords: distinctive descriptors useful for searching place data.",
  "pace: 'relaxed' or 'packed' only if the phrase clearly implies tempo; otherwise omit it.",
].join(" ");

/**
 * Interpret a free-text vibe into a typed VibeProfile.
 * @throws if the API key is missing, the request fails, or the response
 *         cannot be parsed into the expected shape.
 */
export async function interpretVibe(vibe: string): Promise<VibeProfile> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local (server-side only).",
    );
  }

  const trimmed = vibe.trim();
  if (!trimmed) {
    throw new Error("interpretVibe: `vibe` must be a non-empty string.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: trimmed,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      // The two lines that turn on JSON mode:
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.4,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("interpretVibe: Gemini returned an empty response.");
  }

  // Because of JSON mode, `text` is a raw JSON document — no fences, no prose.
  // We still parse defensively and validate the shape before trusting it.
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(
      `interpretVibe: failed to parse Gemini response as JSON.\n` +
        `Raw response: ${text}\n` +
        `Cause: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return toVibeProfile(parsed, text);
}

// Narrow `unknown` into a VibeProfile, throwing a readable error if a field is
// the wrong type. Keeps bad model output from leaking into the rest of the app.
function toVibeProfile(value: unknown, raw: string): VibeProfile {
  if (typeof value !== "object" || value === null) {
    throw new Error(`interpretVibe: expected a JSON object, got: ${raw}`);
  }
  const obj = value as Record<string, unknown>;

  const moods = asStringArray(obj.moods, "moods", raw);
  const placeTypes = asStringArray(obj.placeTypes, "placeTypes", raw);
  const keywords = asStringArray(obj.keywords, "keywords", raw);

  const profile: VibeProfile = { moods, placeTypes, keywords };

  if (obj.pace === "relaxed" || obj.pace === "packed") {
    profile.pace = obj.pace;
  } else if (obj.pace != null) {
    throw new Error(
      `interpretVibe: "pace" must be "relaxed" or "packed", got: ${JSON.stringify(
        obj.pace,
      )}`,
    );
  }

  return profile;
}

function asStringArray(value: unknown, field: string, raw: string): string[] {
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
    throw new Error(
      `interpretVibe: "${field}" must be an array of strings. Raw response: ${raw}`,
    );
  }
  return value as string[];
}
