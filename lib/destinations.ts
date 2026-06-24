// Phase 12 — Destination finder query layer. Embeds the brief and ranks the
// destinations catalog by vibe (+ a seasonal boost for the given month).

import { embed } from "./ai/embed";
import { supabaseAdmin } from "./supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface DestinationMatch {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  description: string;
  tags: string[];
  best_months: number[];
  similarity: number;
  in_season: boolean;
}

export async function findDestinations(
  text: string,
  month?: number | null,
  count = 8,
  client: SupabaseClient = supabaseAdmin(),
): Promise<DestinationMatch[]> {
  const queryEmbedding = await embed(text, "RETRIEVAL_QUERY");
  const { data, error } = await client.rpc("match_destinations", {
    query_embedding: queryEmbedding,
    match_count: count,
    filter_month: month ?? null,
  });
  if (error) {
    throw new Error(`findDestinations: match_destinations failed — ${error.message}`);
  }
  return (data ?? []) as DestinationMatch[];
}
