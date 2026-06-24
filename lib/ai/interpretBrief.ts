// Phase 11 — The router's brain. Reads ONE free-text brief and decides what the
// user actually wants: plan in a place, a road trip, or "find me a destination".
// Also extracts place, occasion, activities, vibe tags, and a timeframe phrase.
// THE MODEL understands; real logic (the router + timeframe resolver) acts.

import { GoogleGenAI, Type } from "@google/genai";
import { withGeminiRetry } from "./gemini";
import { resolveTimeframe, type RawTimeframe, type ResolvedTimeframe } from "../timeframe";

export type Intent = "plan_here" | "road_trip" | "find_destination";
export type Occasion = "date" | "solo" | "family" | "friends" | "impress" | "general";

export interface TripBrief {
  intent: Intent;
  /** A place the user named to go TO (city/region), or null if they want ideas. */
  place: string | null;
  occasion: Occasion;
  activities: string[]; // e.g. ["hiking", "nightlife"]
  moods: string[];
  placeTypes: string[];
  keywords: string[];
  pace?: "relaxed" | "packed";
  timeframe: ResolvedTimeframe;
  raw: string; // the original brief, kept for downstream matching
}

const MODEL = "gemini-2.5-flash";

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    intent: { type: Type.STRING, enum: ["plan_here", "road_trip", "find_destination"] },
    place: { type: Type.STRING, nullable: true },
    occasion: {
      type: Type.STRING,
      enum: ["date", "solo", "family", "friends", "impress", "general"],
    },
    activities: { type: Type.ARRAY, items: { type: Type.STRING } },
    moods: { type: Type.ARRAY, items: { type: Type.STRING } },
    placeTypes: { type: Type.ARRAY, items: { type: Type.STRING } },
    keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
    pace: { type: Type.STRING, enum: ["relaxed", "packed"], nullable: true },
    timeframe: {
      type: Type.OBJECT,
      properties: {
        kind: {
          type: Type.STRING,
          enum: ["none", "now", "today", "weekend", "month", "date_range", "relative"],
        },
        text: { type: Type.STRING },
        month: { type: Type.STRING, nullable: true },
        startDate: { type: Type.STRING, nullable: true },
        endDate: { type: Type.STRING, nullable: true },
      },
      required: ["kind", "text"],
    },
  },
  required: ["intent", "occasion", "activities", "moods", "placeTypes", "keywords", "timeframe"],
};

const SYSTEM = [
  "You route a traveler's free-text brief. Decide intent:",
  "- plan_here: they named a place to spend time in (a city/region/neighborhood).",
  "- road_trip: they want to drive from somewhere to an event/place (a journey with an anchor).",
  "- find_destination: they have NO place in mind and want suggestions for WHERE to go.",
  "place = the place they named to go to, or null if they want destination ideas.",
  "occasion = who/what it's for: date, solo, family, friends, impress (visitors/parents), or general.",
  "activities = concrete things (hiking, beach, nightlife, museums, food).",
  "moods/placeTypes/keywords = vibe tags for matching. Keep tags short, lowercase.",
  "timeframe = classify any time hint. kind 'month' -> set month (e.g. 'July'); explicit dates -> kind 'date_range' with ISO startDate/endDate; 'now'/'today'/'weekend' as named; else 'none'. Put the phrase in text.",
].join(" ");

export async function interpretBrief(brief: string): Promise<TripBrief> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");
  const trimmed = brief.trim();
  if (!trimmed) throw new Error("interpretBrief: empty brief.");

  const ai = new GoogleGenAI({ apiKey });
  const today = new Date().toISOString().slice(0, 10);

  const response = await withGeminiRetry(() =>
    ai.models.generateContent({
      model: MODEL,
      contents: `Today is ${today}.\n\nBrief: "${trimmed}"`,
      config: {
        systemInstruction: SYSTEM,
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        temperature: 0.3,
      },
    }),
  );

  const text = response.text;
  if (!text) throw new Error("interpretBrief: empty response.");

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`interpretBrief: bad JSON: ${text}`);
  }

  const tf = parsed.timeframe as RawTimeframe | undefined;
  return {
    intent: (parsed.intent as Intent) ?? "plan_here",
    place: (parsed.place as string | null) ?? null,
    occasion: (parsed.occasion as Occasion) ?? "general",
    activities: asStrings(parsed.activities),
    moods: asStrings(parsed.moods),
    placeTypes: asStrings(parsed.placeTypes),
    keywords: asStrings(parsed.keywords),
    pace: parsed.pace === "relaxed" || parsed.pace === "packed" ? parsed.pace : undefined,
    timeframe: resolveTimeframe(tf),
    raw: trimmed,
  };
}

function asStrings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}
