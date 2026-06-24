// Phase 4/7 — THE MODEL writing language (the only AI step in planning/pulse).
// One short "why this fits you" line per item, referencing the vibe. JSON mode
// with a fixed-length string array keeps lines aligned to items. Any failure
// falls back to a plain generated line — the model never breaks valid data.

import { GoogleGenAI, Type } from "@google/genai";
import { withGeminiRetry } from "./gemini";

export interface WhyItFitsItem {
  name: string;
  tags: string[];
  description: string;
}

export async function generateWhyItFits(
  vibe: string,
  items: WhyItFitsItem[],
): Promise<string[]> {
  const fallback = items.map(
    (it) => `A ${it.tags[0] ?? "spot"} that fits your "${vibe}" mood.`,
  );

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || items.length === 0) return fallback;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const numbered = items
      .map(
        (it, i) =>
          `${i + 1}. ${it.name} [${it.tags.join(", ")}] — ${it.description}`,
      )
      .join("\n");

    const response = await withGeminiRetry(() =>
      ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents:
          `Vibe: "${vibe}"\n\nItems in order:\n${numbered}\n\n` +
          `Write one warm, specific "why this fits you" line per item, in order.`,
        config: {
          systemInstruction:
            "You write short second-person notes. Each line <= 20 words, " +
            "references the vibe's feeling, no name needed, no quotes.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            minItems: String(items.length),
            maxItems: String(items.length),
          },
          temperature: 0.7,
        },
      }),
    );

    const text = response.text;
    if (!text) return fallback;
    const lines = JSON.parse(text);
    if (
      Array.isArray(lines) &&
      lines.length === items.length &&
      lines.every((l) => typeof l === "string")
    ) {
      return lines as string[];
    }
    return fallback;
  } catch {
    return fallback;
  }
}
