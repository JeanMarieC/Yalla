// Phase 5 — Server endpoint that runs the whole engine.
// POST { vibe, city, startTime, timeBudget } -> { itinerary }.
// All secrets (Gemini, Supabase service role, Mapbox) stay on the server here;
// the browser only ever sees the resulting itinerary JSON.

import { NextResponse } from "next/server";
import { matchPlacesToVibe, type RankedPlace } from "@/lib/places";
import { planDay } from "@/lib/ai/planDay";
import type { DayKey } from "@/lib/ingest/openingHours";

const DAY_KEYS: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

// Resolve the day of week the plan is for. Accepts an ISO date in the request;
// falls back to today so the open-hours filter is always meaningful.
function resolveDay(dateInput: unknown): DayKey {
  const d = typeof dateInput === "string" && dateInput ? new Date(dateInput) : new Date();
  const idx = Number.isNaN(d.getTime()) ? new Date().getDay() : d.getDay();
  return DAY_KEYS[idx];
}

// Force the Node runtime (not Edge) — we use the Supabase + Gemini SDKs.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const vibe = String(body.vibe ?? "").trim();
    const city = body.city ? String(body.city).trim() : "";
    const startTime = body.startTime ? String(body.startTime) : "10:00";
    const timeBudget = Number(body.timeBudget ?? 6);

    if (!vibe) {
      return NextResponse.json({ error: "Please describe a vibe." }, { status: 400 });
    }
    if (!Number.isFinite(timeBudget) || timeBudget <= 0) {
      return NextResponse.json({ error: "Invalid time budget." }, { status: 400 });
    }

    // Phase 3: vibe -> ranked real places (city filter optional).
    const matched = await matchPlacesToVibe(vibe, { city: city || undefined }, 10);
    if (matched.length === 0) {
      return NextResponse.json({ itinerary: [], message: "No places matched that vibe yet." });
    }

    // Phase 4: ranked places -> timed day. Start from the centroid of the
    // matches (location-agnostic; no hardcoded city coordinates).
    const start = centroid(matched);
    const itinerary = await planDay(matched, {
      vibe,
      start,
      startTime,
      budgetHours: timeBudget,
      day: resolveDay(body.date), // drop places closed that day
    });

    return NextResponse.json({ itinerary });
  } catch (err) {
    console.error("/api/plan failed:", err);
    return NextResponse.json({ error: "Failed to plan your day." }, { status: 500 });
  }
}

function centroid(places: RankedPlace[]): { lat: number; lng: number } {
  const lat = places.reduce((s, p) => s + p.lat, 0) / places.length;
  const lng = places.reduce((s, p) => s + p.lng, 0) / places.length;
  return { lat, lng };
}
