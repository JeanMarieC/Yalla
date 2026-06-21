// Phase 6 — Save a trip for the logged-in user.
// The server client reads the session from cookies, so auth.uid() is known and
// the "insert own trips" RLS policy applies. We set user_id explicitly to the
// authenticated user (which equals auth.uid(), satisfying the policy's CHECK).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const title = String(body.title ?? "").trim();
  const vibe = String(body.vibe ?? "").trim();
  const city = body.city ? String(body.city).trim() : null;
  const itinerary = body.itinerary;

  if (!vibe || !Array.isArray(itinerary) || itinerary.length === 0) {
    return NextResponse.json({ error: "Nothing to save." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("trips")
    .insert({
      user_id: user.id,
      title: title || vibe,
      vibe,
      city,
      itinerary,
    })
    .select("id")
    .single();

  if (error) {
    console.error("save trip failed:", error);
    return NextResponse.json({ error: "Could not save trip." }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
