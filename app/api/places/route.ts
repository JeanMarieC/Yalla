// Phase 8 — User place submission. Requires login. Embeds the description with
// the same model as the rest of the catalog, then inserts via the session
// client so RLS applies (source='user', submitted_by=auth.uid()).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { embed } from "@/lib/ai/embed";
import { normalizeTypes } from "@/lib/ingest/normalizeTypes";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in to add a place." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const description = String(body.description ?? "").trim();
  const city = String(body.city ?? "").trim();
  const country = String(body.country ?? "").trim() || city;
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const placeTypes = normalizeTypes(
    Array.isArray(body.place_types)
      ? body.place_types.map((t: unknown) => String(t).trim()).filter(Boolean)
      : [],
  );

  if (!name || !description || !city) {
    return NextResponse.json({ error: "Name, description and city are required." }, { status: 400 });
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Valid coordinates are required." }, { status: 400 });
  }

  const embedding = await embed(description, "RETRIEVAL_DOCUMENT");

  const { data, error } = await supabase
    .from("places")
    .insert({
      name,
      description,
      city,
      country,
      location: `SRID=4326;POINT(${lng} ${lat})`,
      place_types: placeTypes,
      embedding,
      source: "user",
      submitted_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    console.error("create place failed:", error);
    return NextResponse.json({ error: "Could not save the place." }, { status: 500 });
  }

  return NextResponse.json({ id: data.id });
}
