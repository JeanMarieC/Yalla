// Phase 2 — Embeddings.
// Turn text into a vector so we can do semantic ("vibe") search in Postgres.
// Server-side only: reads GEMINI_API_KEY from env, never exposed to the client.

import { GoogleGenAI } from "@google/genai";
import { withGeminiRetry } from "./gemini";

// Current Gemini embedding model (free tier).
const MODEL = "gemini-embedding-001";

// Single source of truth for the vector size.
// The model's NATIVE output is 3072 dims, but pgvector's HNSW/IVFFlat indexes
// cap at 2000 dims — so we request a Matryoshka-truncated 768. This number MUST
// equal the vector(N) column size in the migration. Keep them in lockstep.
export const EMBEDDING_DIMENSION = 768;

// Asymmetric retrieval: embed stored docs and search queries with different
// task types for better matching. Defaults to document embedding.
export type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

/**
 * Embed a single piece of text into a fixed-length, L2-normalized vector.
 * @throws if the key is missing, the call fails, or the dimension is wrong.
 */
export async function embed(
  text: string,
  taskType: EmbeddingTaskType = "RETRIEVAL_DOCUMENT",
): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local (server-side only).",
    );
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("embed: `text` must be a non-empty string.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const response = await withGeminiRetry(() =>
    ai.models.embedContent({
      model: MODEL,
      contents: trimmed,
      config: {
        taskType,
        outputDimensionality: EMBEDDING_DIMENSION,
      },
    }),
  );

  const values = response.embeddings?.[0]?.values;
  if (!values || values.length === 0) {
    throw new Error("embed: Gemini returned no embedding values.");
  }
  if (values.length !== EMBEDDING_DIMENSION) {
    throw new Error(
      `embed: expected ${EMBEDDING_DIMENSION} dims but got ${values.length}. ` +
        "Update EMBEDDING_DIMENSION and the vector(N) column to match.",
    );
  }

  // Google recommends re-normalizing when outputDimensionality < 3072, since
  // only the full-size output is normalized. Cosine search is scale-invariant,
  // but normalizing keeps vectors clean for any future dot-product use.
  return normalize(values);
}

function normalize(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (magnitude === 0) return vector;
  return vector.map((v) => v / magnitude);
}
