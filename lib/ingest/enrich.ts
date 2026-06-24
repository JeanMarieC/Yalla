// Phase 13 — AI enrichment. The model adds VIBE only: a 1-line description and
// vibe tags per real POI. Batched + rate-limit-resilient; falls back to a plain
// line if the model is unavailable, so ingestion never hard-fails on AI.

import { GoogleGenAI, Type } from "@google/genai";
import { withGeminiRetry } from "../ai/gemini";
import type { RawPOI } from "./mapbox";

export interface Enriched {
  description: string;
  tags: string[];
}

const BATCH = 12;

export async function describePOIs(
  city: string,
  country: string,
  pois: RawPOI[],
): Promise<Enriched[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  const fallback = (p: RawPOI): Enriched => ({
    description: `${p.name} — a ${p.placeTypes[0] ?? "spot"} in ${city}.`,
    tags: p.placeTypes,
  });
  if (!apiKey) return pois.map(fallback);

  const ai = new GoogleGenAI({ apiKey });
  const results: Enriched[] = [];

  for (let i = 0; i < pois.length; i += BATCH) {
    const batch = pois.slice(i, i + BATCH);
    const list = batch.map((p, j) => `${j + 1}. ${p.name} [${p.category}]`).join("\n");
    try {
      const res = await withGeminiRetry(() =>
        ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents:
            `City: ${city}, ${country}.\nPlaces:\n${list}\n\n` +
            `For each, in order, write a vivid one-sentence vibe description and ` +
            `2–4 short lowercase vibe tags.`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ["description", "tags"],
              },
              minItems: String(batch.length),
              maxItems: String(batch.length),
            },
            temperature: 0.6,
          },
        }),
      );
      const arr = JSON.parse(res.text ?? "[]");
      batch.forEach((p, k) => {
        const e = arr[k];
        results.push(
          e && typeof e.description === "string"
            ? { description: e.description, tags: Array.isArray(e.tags) ? e.tags : p.placeTypes }
            : fallback(p),
        );
      });
    } catch {
      batch.forEach((p) => results.push(fallback(p)));
    }
  }
  return results;
}
