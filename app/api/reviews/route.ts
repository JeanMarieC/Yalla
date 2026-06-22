// Phase 8 — Reviews. One per user per place (upsert). After any change we
// recompute the cached summary + re-embed the place — this is the ONLY place
// that work happens, so reads stay cheap.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { refreshPlaceSummary } from "@/lib/reviews-refresh";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in to review." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const placeId = String(body.placeId ?? "");
  const rating = Number(body.rating);
  const text = body.body != null ? String(body.body).trim() : null;

  if (!placeId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "A rating of 1–5 is required." }, { status: 400 });
  }

  const { error } = await supabase
    .from("reviews")
    .upsert(
      { place_id: placeId, user_id: user.id, rating, body: text },
      { onConflict: "place_id,user_id" },
    );

  if (error) {
    console.error("save review failed:", error);
    return NextResponse.json({ error: "Could not save your review." }, { status: 500 });
  }

  // Reviews changed -> recompute summary + re-embed (cached on the place).
  await refreshPlaceSummary(placeId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const placeId = new URL(request.url).searchParams.get("placeId");
  if (!placeId) {
    return NextResponse.json({ error: "Missing placeId." }, { status: 400 });
  }

  const { error } = await supabase
    .from("reviews")
    .delete()
    .eq("place_id", placeId)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: "Could not remove your review." }, { status: 500 });
  }

  await refreshPlaceSummary(placeId);
  return NextResponse.json({ ok: true });
}
