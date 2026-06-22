// Phase 9 (Pass 3) — Trigger the re-planning agent. The lobby calls this when a
// stop appears to cross the downvote threshold; the server re-verifies
// authoritatively (so a client can't force a re-plan) before running the graph.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { runReplan } from "@/lib/agent/replanGraph";
import type { ItineraryStop } from "@/lib/ai/planDay";

export const runtime = "nodejs";
export const maxDuration = 60;

const DOWNVOTE_THRESHOLD = 2;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const tripId = String(body.tripId ?? "");
  const stopId = String(body.stopId ?? "");
  if (!tripId || !stopId) {
    return NextResponse.json({ error: "Missing tripId/stopId." }, { status: 400 });
  }

  // Caller must be a participant of this lobby.
  const { data: part } = await supabase
    .from("lobby_participants")
    .select("id")
    .eq("trip_id", tripId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!part) {
    return NextResponse.json({ error: "Not a participant." }, { status: 403 });
  }

  // Authoritative checks via admin: stop still present AND truly over threshold.
  const admin = supabaseAdmin();
  const { data: trip } = await admin
    .from("trips")
    .select("itinerary")
    .eq("id", tripId)
    .single();
  if (!trip) {
    return NextResponse.json({ error: "Trip not found." }, { status: 404 });
  }
  const present = (trip.itinerary as ItineraryStop[]).some(
    (s) => s.place.id === stopId,
  );
  if (!present) {
    return NextResponse.json({ skipped: "already replaced" });
  }

  const { data: votes } = await admin
    .from("votes")
    .select("vote")
    .eq("lobby_id", tripId)
    .eq("stop_id", stopId);
  const downs = (votes ?? []).filter((v) => v.vote === "down").length;
  if (downs < DOWNVOTE_THRESHOLD) {
    return NextResponse.json({ skipped: "below threshold" });
  }

  await runReplan(tripId, stopId);
  return NextResponse.json({ ok: true });
}
