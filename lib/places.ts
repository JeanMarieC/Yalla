// Phase 2/3 — Find places.
// Logic only, no UI. Retrieval paths:
//   - findPlacesByVibe:   semantic search (embed text -> cosine match in DB)
//   - findPlacesNearby:   geospatial search (PostGIS distance)
//   - matchPlacesToVibe:  Phase 3 pipeline — interpretVibe -> build query ->
//                         embed -> match (city or radius) -> place-type boost
// Everything is location-agnostic — pass any city, or any lat/lng on Earth.

import { embed } from "./ai/embed";
import { interpretVibe, type VibeProfile } from "./ai/interpretVibe";
import { supabaseAdmin } from "./supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

/** A place ranked by how well it matches a vibe (1 = perfect, ~0 = unrelated). */
export interface VibeMatch {
  id: string;
  name: string;
  description: string;
  city: string;
  country: string;
  place_types: string[];
  lng: number;
  lat: number;
  similarity: number;
}

/** A place ranked by distance from a point, in meters. */
export interface NearbyMatch {
  id: string;
  name: string;
  description: string;
  city: string;
  country: string;
  place_types: string[];
  distance_meters: number;
}

/**
 * Find places whose description best matches a free-text vibe.
 * @param text  the vibe phrase (or tags joined into a phrase)
 * @param city  optional city filter (null/undefined = search every city)
 * @param count how many results to return
 */
export async function findPlacesByVibe(
  text: string,
  city?: string | null,
  count = 5,
  client: SupabaseClient = supabaseAdmin(),
): Promise<VibeMatch[]> {
  // Embed the QUERY with the matching task type (asymmetric retrieval).
  const queryEmbedding = await embed(text, "RETRIEVAL_QUERY");

  const { data, error } = await client.rpc("match_places", {
    query_embedding: queryEmbedding,
    match_count: count,
    filter_city: city ?? null,
  });

  if (error) {
    throw new Error(`findPlacesByVibe: match_places failed — ${error.message}`);
  }
  return (data ?? []) as VibeMatch[];
}

/**
 * Find places within a radius of a coordinate, nearest first.
 * @param lat          latitude  (-90..90)
 * @param lng          longitude (-180..180)
 * @param radiusMeters search radius in meters
 * @param count        max results
 */
export async function findPlacesNearby(
  lat: number,
  lng: number,
  radiusMeters = 2000,
  count = 20,
  client: SupabaseClient = supabaseAdmin(),
): Promise<NearbyMatch[]> {
  const { data, error } = await client.rpc("nearby_places", {
    lat,
    lng,
    radius_meters: radiusMeters,
    match_count: count,
  });

  if (error) {
    throw new Error(`findPlacesNearby: nearby_places failed — ${error.message}`);
  }
  return (data ?? []) as NearbyMatch[];
}

// ===========================================================================
// Phase 3 — Vibe matching pipeline
// ===========================================================================

/** Where to search: a city name, OR a point + radius. Omit both for global. */
export interface MatchLocation {
  city?: string;
  lat?: number;
  lng?: number;
  /** Used only when lat/lng are given. Defaults to 5km. */
  radiusMeters?: number;
}

/** A place ranked by the full pipeline. */
export interface RankedPlace {
  id: string;
  name: string;
  description: string;
  city: string;
  country: string;
  place_types: string[];
  lng: number;
  lat: number;
  /** Raw cosine similarity to the vibe (0..1). */
  similarity: number;
  /** Final rank after the gentle place-type boost (>= similarity). */
  score: number;
  /** Present only when searching by lat/lng radius. */
  distanceMeters?: number;
}

/**
 * Turn a VibeProfile into a rich, description-like query string.
 *
 * Why not just embed the raw vibe? The stored embeddings are PLACE DESCRIPTIONS,
 * so the query embeds best when it also reads like a description of an ideal
 * place. interpretVibe has already cleaned the messy input into moods /
 * placeTypes / keywords; restating them as structured prose concentrates the
 * signal (and drops filler words), so the query vector lands closer to the
 * right places than the original off-the-cuff phrase would.
 */
export function buildVibeQuery(profile: VibeProfile): string {
  const parts: string[] = [];
  if (profile.moods.length) parts.push(`Mood: ${profile.moods.join(", ")}.`);
  if (profile.placeTypes.length)
    parts.push(`Kinds of places: ${profile.placeTypes.join(", ")}.`);
  if (profile.keywords.length)
    parts.push(`Details: ${profile.keywords.join(", ")}.`);
  if (profile.pace) parts.push(`Pace: ${profile.pace}.`);
  return parts.join(" ");
}

/**
 * Full Phase 3 pipeline: vibe sentence -> ranked real places.
 *
 * @param vibe     free-text vibe (e.g. "moody coastal, vinyl bars")
 * @param location { city } to scope to a city, or { lat, lng, radiusMeters }
 *                 for a geo radius, or {} to search the whole catalog
 * @param count    how many ranked places to return
 */
export async function matchPlacesToVibe(
  vibe: string,
  location: MatchLocation = {},
  count = 10,
  client: SupabaseClient = supabaseAdmin(),
): Promise<RankedPlace[]> {
  // 1. Understand the vibe (Phase 1).
  const profile = await interpretVibe(vibe);

  // 2. Restate it as a description-like query and embed that (Phase 2).
  const queryText = buildVibeQuery(profile);
  const queryEmbedding = await embed(queryText, "RETRIEVAL_QUERY");

  // Over-fetch so the place-type boost has room to reorder before we slice.
  const fetchCount = Math.min(Math.max(count * 3, count + 5), 50);
  const hasGeo =
    typeof location.lat === "number" && typeof location.lng === "number";

  // 3. Retrieve nearest-by-vibe, scoped to a radius or a city.
  type Row = VibeMatch & { distance_meters?: number };
  let rows: Row[];
  if (hasGeo) {
    const { data, error } = await client.rpc("match_places_near", {
      query_embedding: queryEmbedding,
      center_lat: location.lat,
      center_lng: location.lng,
      radius_meters: location.radiusMeters ?? 5000,
      match_count: fetchCount,
    });
    if (error) {
      throw new Error(
        `matchPlacesToVibe: match_places_near failed — ${error.message}`,
      );
    }
    rows = (data ?? []) as Row[];
  } else {
    const { data, error } = await client.rpc("match_places", {
      query_embedding: queryEmbedding,
      match_count: fetchCount,
      filter_city: location.city ?? null,
    });
    if (error) {
      throw new Error(
        `matchPlacesToVibe: match_places failed — ${error.message}`,
      );
    }
    rows = (data ?? []) as Row[];
  }

  // 4. Gently boost places whose categories match the requested placeTypes,
  //    then sort by the boosted score. The boost is small so it only breaks
  //    near-ties — semantic similarity stays in charge.
  const ranked: RankedPlace[] = rows.map((r) => {
    const overlap = countTypeOverlap(profile.placeTypes, r.place_types);
    const score = r.similarity + Math.min(overlap, 3) * 0.02;
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      city: r.city,
      country: r.country,
      place_types: r.place_types,
      lng: r.lng,
      lat: r.lat,
      similarity: r.similarity,
      score,
      ...(typeof r.distance_meters === "number"
        ? { distanceMeters: r.distance_meters }
        : {}),
    };
  });

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, count);
}

// Count how many requested place types overlap a place's categories.
// Loose match: equal, or one string contained in the other (so "bar" matches
// "cocktail bar" and "bakery" matches "bakery, pastry").
function countTypeOverlap(wanted: string[], have: string[]): number {
  const haveLower = have.map((h) => h.toLowerCase());
  let n = 0;
  for (const w of wanted) {
    const wl = w.toLowerCase();
    if (haveLower.some((h) => h === wl || h.includes(wl) || wl.includes(h))) {
      n++;
    }
  }
  return n;
}
