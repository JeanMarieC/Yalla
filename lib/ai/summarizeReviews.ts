// Phase 8 — THE MODEL writing language: one honest consensus line from reviews.
// Falls back to a plain computed line if the model is unavailable, so the data
// loop never depends on a successful AI call.

import { GoogleGenAI } from "@google/genai";

export interface ReviewLite {
  rating: number;
  body: string | null;
}

export async function summarizeReviews(reviews: ReviewLite[]): Promise<string> {
  const avg = (
    reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
  ).toFixed(1);
  const fallback = `Rated ${avg}/5 by ${reviews.length} ${
    reviews.length === 1 ? "visitor" : "visitors"
  }.`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallback;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const text = reviews
      .map((r, i) => `${i + 1}. (${r.rating}/5) ${r.body ?? ""}`.trim())
      .join("\n");

    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents:
        `Reviews:\n${text}\n\n` +
        `Write ONE honest consensus sentence (<= 18 words). Name a real positive ` +
        `and any recurring caveat (e.g. "gets loud after 9pm") if present.`,
      config: {
        systemInstruction:
          "You distill reviews into one balanced, specific line. No rating numbers, no quotes.",
        temperature: 0.5,
      },
    });

    return res.text?.trim() || fallback;
  } catch {
    return fallback;
  }
}
