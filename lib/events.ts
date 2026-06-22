// Phase 7 — The Pulse: find live, time-bound events by vibe.
// Same retrieval idea as places, plus a time window. Reuses embed() with the
// SAME model/dimension as places so the vibe vector means the same thing.

import { embed } from "./ai/embed";
import { supabaseAdmin } from "./supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

/** An event ranked by vibe, already filtered to a live time window in SQL. */
export interface EventMatch {
  id: string;
  name: string;
  description: string;
  city: string;
  start_time: string; // ISO (UTC)
  end_time: string; // ISO (UTC)
  tags: string[];
  lng: number;
  lat: number;
  similarity: number;
}

/** An event plus its generated "why it fits" line (what /api/pulse returns). */
export interface PulseEvent extends EventMatch {
  whyItFits: string;
}

/**
 * Rank this-window events in a city by how well they fit a vibe.
 * @param withinDays how far ahead counts as "soon" (default 7 = this week)
 */
export async function findEventsByVibe(
  text: string,
  city?: string | null,
  withinDays = 7,
  count = 12,
  client: SupabaseClient = supabaseAdmin(),
): Promise<EventMatch[]> {
  const queryEmbedding = await embed(text, "RETRIEVAL_QUERY");

  const { data, error } = await client.rpc("match_events", {
    query_embedding: queryEmbedding,
    match_count: count,
    filter_city: city ?? null,
    within_days: withinDays,
  });

  if (error) {
    throw new Error(`findEventsByVibe: match_events failed — ${error.message}`);
  }
  return (data ?? []) as EventMatch[];
}
