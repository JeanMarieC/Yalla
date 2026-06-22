// Phase 10 (Part 1) — Event-anchored road trip planner.
//
// Differs from planDay (a city cluster) in two ways:
//   - stops are ordered by PROGRESS along the driving route (start -> event),
//   - the EVENT is a fixed final anchor: we time backward so you arrive on
//     schedule, and self-correct by dropping the lowest-ranked stop if the
//     drive + visits won't fit the budget.
// REAL LOGIC: ordering, driving times (Mapbox), timing, self-correction.
// THE MODEL: only the per-stop "why it fits" lines.

import type { RankedPlace } from "../places";
import { getTravelMatrix, type LatLng } from "../routing";
import { durationForPlace, type ItineraryStop } from "./planDay";
import { generateWhyItFits } from "./whyItFits";

export interface RoadTripEvent {
  name: string;
  lat: number;
  lng: number;
  time: string; // ISO datetime the user must arrive by
}

export interface RoadTripOptions {
  vibe: string;
  start: LatLng;
  event: RoadTripEvent;
  budgetHours?: number; // max total trip duration (drive + visits). Default 8.
  maxStops?: number; // default 6
}

/** Candidate places already scored + with route progress (0..1). */
export type RouteCandidate = RankedPlace & { progress: number };

function fmt(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Build the pseudo-"place" for the event so it renders as the final pin/stop.
function eventStop(event: RoadTripEvent): RankedPlace {
  return {
    id: "event",
    name: event.name,
    description: "Your anchor event.",
    city: "",
    country: "",
    place_types: ["event"],
    lng: event.lng,
    lat: event.lat,
    similarity: 1,
    score: 1,
  };
}

export async function planRoadTrip(
  candidates: RouteCandidate[],
  options: RoadTripOptions,
): Promise<ItineraryStop[]> {
  const budgetMin = (options.budgetHours ?? 8) * 60;
  const maxStops = options.maxStops ?? 6;
  const eventDate = new Date(options.event.time);

  // Best-ranked first; we drop from the tail (lowest score) when over budget.
  const working = [...candidates]
    .sort((a, b) => b.score - a.score)
    .slice(0, maxStops);

  // Self-correction loop: order by progress, time it, drop if it overflows.
  let chosen: RouteCandidate[] = [];
  let legs: number[] = []; // minutes; legs[i] = drive into points[i+1]
  while (true) {
    const ordered = [...working].sort((a, b) => a.progress - b.progress);
    const points: LatLng[] = [
      options.start,
      ...ordered.map((p) => ({ lat: p.lat, lng: p.lng })),
      { lat: options.event.lat, lng: options.event.lng },
    ];
    const matrix = await getTravelMatrix(points, "driving");
    const legMins: number[] = [];
    for (let i = 0; i < points.length - 1; i++) {
      legMins.push(Math.round(matrix[i][i + 1] / 60));
    }
    const driveTotal = legMins.reduce((s, m) => s + m, 0);
    const stopsTotal = ordered.reduce((s, p) => s + durationForPlace(p), 0);

    if (driveTotal + stopsTotal <= budgetMin || ordered.length === 0) {
      chosen = ordered;
      legs = legMins;
      break;
    }
    working.pop(); // drop lowest-ranked, recompute
  }

  // Time backward from the fixed event arrival.
  const total =
    legs.reduce((s, m) => s + m, 0) +
    chosen.reduce((s, p) => s + durationForPlace(p), 0);
  const departure = new Date(eventDate.getTime() - total * 60_000);

  // Language step (only the model).
  const whyLines = await generateWhyItFits(
    options.vibe,
    chosen.map((p) => ({ name: p.name, tags: p.place_types, description: p.description })),
  );

  const stops: ItineraryStop[] = [];
  let t = departure.getTime();
  chosen.forEach((place, i) => {
    t += legs[i] * 60_000; // drive from previous point
    const arrival = new Date(t);
    const duration = durationForPlace(place);
    t += duration * 60_000; // visit
    stops.push({
      place,
      arrivalTime: fmt(arrival),
      durationMinutes: duration,
      travelToNextMinutes: legs[i + 1] ?? 0,
      whyItFits: whyLines[i],
    });
  });

  // The anchor: arrival == the event time by construction.
  stops.push({
    place: eventStop(options.event),
    arrivalTime: fmt(eventDate),
    durationMinutes: 0,
    travelToNextMinutes: 0,
    whyItFits: "Your anchor — timed so you arrive right on schedule.",
  });

  return stops;
}
