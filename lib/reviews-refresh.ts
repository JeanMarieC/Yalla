// Phase 8 — The feedback loop, run ONLY when a place's reviews change (never on
// page load). It:
//   1. recomputes the cached one-line AI summary, and
//   2. re-embeds the place using description + summary as the "effective
//      description" — so review-driven character actually shapes vibe matching.
// Uses the service-role admin client: this is a system write, not a user action.

import { supabaseAdmin } from "./supabase";
import { embed } from "./ai/embed";
import { summarizeReviews } from "./ai/summarizeReviews";

export async function refreshPlaceSummary(placeId: string): Promise<void> {
  const admin = supabaseAdmin();

  const { data: place } = await admin
    .from("places")
    .select("description")
    .eq("id", placeId)
    .single();
  if (!place) return;

  const { data: reviews } = await admin
    .from("reviews")
    .select("rating, body")
    .eq("place_id", placeId);

  const summary =
    reviews && reviews.length > 0 ? await summarizeReviews(reviews) : null;

  // Fold the summary into the text we embed (same model as everything else).
  const effective = summary
    ? `${place.description} Review consensus: ${summary}`
    : place.description;
  const embedding = await embed(effective, "RETRIEVAL_DOCUMENT");

  await admin
    .from("places")
    .update({
      review_summary: summary,
      summary_updated_at: new Date().toISOString(),
      embedding,
    })
    .eq("id", placeId);
}
