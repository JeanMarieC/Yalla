// Phase 7 — User event submission. Requires login. Embeds the description with
// the SAME model as places (so it ranks consistently), then inserts via the
// session client so RLS applies and submitted_by = auth.uid().

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { embed } from "@/lib/ai/embed";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in to add an event." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const description = String(body.description ?? "").trim();
  const city = String(body.city ?? "").trim();
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const startTime = String(body.startTime ?? "");
  const endTime = String(body.endTime ?? "");
  const tags = Array.isArray(body.tags)
    ? body.tags.map((t: unknown) => String(t).trim()).filter(Boolean)
    : [];

  if (!name || !description || !city) {
    return NextResponse.json({ error: "Name, description and city are required." }, { status: 400 });
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Valid coordinates are required." }, { status: 400 });
  }
  if (!startTime || !endTime || new Date(endTime) <= new Date(startTime)) {
    return NextResponse.json({ error: "End time must be after start time." }, { status: 400 });
  }

  const embedding = await embed(description, "RETRIEVAL_DOCUMENT");

  const { data, error } = await supabase
    .from("events")
    .insert({
      name,
      description,
      city,
      location: `SRID=4326;POINT(${lng} ${lat})`,
      start_time: startTime, // ISO UTC from the client
      end_time: endTime,
      tags,
      embedding,
      source: "user",
      submitted_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    console.error("create event failed:", error);
    return NextResponse.json({ error: "Could not save the event." }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
