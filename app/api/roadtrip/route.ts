// Phase 10 (Part 1) — Plan an event-anchored road trip.
// driving route (Mapbox) -> places in the corridor (PostGIS) -> vibe rank ->
// sequence by progress + time to arrive at the event. All keys server-side.

import { NextResponse } from "next/server";
import { getDrivingRoute } from "@/lib/routing";
import { findPlacesAlongRoute } from "@/lib/places";
import { planRoadTrip, type RouteCandidate } from "@/lib/ai/planRoadTrip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const vibe = String(body.vibe ?? "").trim();
    const start = body.start;
    const event = body.event;
    const budgetHours = Number(body.budgetHours ?? 8);
    const corridorMeters = Number(body.corridorKm ?? 3) * 1000;

    if (!vibe) return NextResponse.json({ error: "Describe a vibe." }, { status: 400 });
    if (
      !start ||
      !Number.isFinite(Number(start.lat)) ||
      !Number.isFinite(Number(start.lng))
    ) {
      return NextResponse.json({ error: "Valid start coordinates required." }, { status: 400 });
    }
    if (
      !event ||
      !event.name ||
      !Number.isFinite(Number(event.lat)) ||
      !Number.isFinite(Number(event.lng)) ||
      !event.time
    ) {
      return NextResponse.json({ error: "Event name, coordinates and time required." }, { status: 400 });
    }

    const startPt = { lat: Number(start.lat), lng: Number(start.lng) };
    const eventPt = { lat: Number(event.lat), lng: Number(event.lng) };

    // 1. Driving route (geometry + duration).
    const route = await getDrivingRoute(startPt, eventPt);
    const routeGeoJSON = JSON.stringify({
      type: "LineString",
      coordinates: route.coordinates,
    });

    // 2. Vibe-matched places within the corridor, with route progress.
    const matches = await findPlacesAlongRoute(vibe, routeGeoJSON, corridorMeters, 30);
    const candidates: RouteCandidate[] = matches.map((m) => ({
      ...m,
      score: m.similarity,
    }));

    // 3. Sequence + time to the fixed event anchor.
    const itinerary = await planRoadTrip(candidates, {
      vibe,
      start: startPt,
      event: {
        name: String(event.name),
        lat: eventPt.lat,
        lng: eventPt.lng,
        time: String(event.time),
      },
      budgetHours: Number.isFinite(budgetHours) ? budgetHours : 8,
    });

    return NextResponse.json({ itinerary, routeLine: route.coordinates });
  } catch (err) {
    console.error("/api/roadtrip failed:", err);
    return NextResponse.json({ error: "Failed to plan the road trip." }, { status: 500 });
  }
}
