// Phase 4 — Itinerary builder.
//
// ARCHITECTURE RULE (CLAUDE.md principle 1):
//   REAL LOGIC  — selecting, ordering, timing, and the self-correction loop are
//                 plain arithmetic over real Mapbox travel times.
//   THE MODEL   — only writes the one-line "why it fits you" notes (language).
// The model never decides what to visit, in what order, or at what time.

import { GoogleGenAI, Type } from "@google/genai";
import type { RankedPlace } from "../places";
import { getTravelMatrix, type LatLng, type TravelProfile } from "../routing";

export interface PlanDayOptions {
  /** The original vibe, so the why-it-fits lines can reference its feeling. */
  vibe: string;
  /** Where the day begins (e.g. a hotel or the city center). */
  start: LatLng & { name?: string };
  /** Start time as "HH:MM" (24h). */
  startTime: string;
  /** Either a budget in hours OR an explicit end time ("HH:MM"). */
  budgetHours?: number;
  endTime?: string;
  /** Travel mode. Defaults to walking (a city day). */
  profile?: TravelProfile;
  /** Hard cap on stops considered before fitting. Defaults to 8. */
  maxStops?: number;
}

/** One stop in the finished, timed day. Plain data — no behavior. */
export interface ItineraryStop {
  place: RankedPlace;
  arrivalTime: string; // "HH:MM"
  durationMinutes: number;
  travelToNextMinutes: number;
  whyItFits: string;
}

// --- Tunables: simple default durations + time-of-day preferences ----------
// Minutes you'd typically spend at each kind of place.
const DURATIONS: Record<string, number> = {
  bakery: 30,
  pastry: 30,
  cafe: 45,
  "wine bar": 75,
  bar: 90,
  "cocktail bar": 90,
  restaurant: 90,
  "local food": 75,
  "food market": 60,
  "record shop": 40,
  vinyl: 40,
  art: 60,
  museum: 90,
  viewpoint: 30,
  promenade: 45,
  coastal: 45,
  park: 45,
  walk: 45,
  "live music": 90,
  neighborhood: 45,
};
const FALLBACK_DURATION = 60;

// Time-of-day fit: 0 = morning ... 4 = night. Coffee early, bars late.
const TIME_PREF: Record<string, number> = {
  bakery: 0,
  pastry: 0,
  cafe: 0.5,
  viewpoint: 1,
  promenade: 1,
  coastal: 1,
  park: 1,
  walk: 1,
  "record shop": 1,
  art: 1,
  museum: 1,
  "food market": 1.5,
  neighborhood: 1.5,
  restaurant: 2,
  "local food": 2,
  "wine bar": 3,
  vinyl: 3,
  bar: 4,
  "cocktail bar": 4,
  "live music": 4,
};
const FALLBACK_PREF = 2;

// ===========================================================================
// Public entry point
// ===========================================================================

/**
 * Build a single-day, hour-by-hour itinerary from ranked places.
 * Location-agnostic: works for any city given a start coordinate.
 */
export async function planDay(
  matchedPlaces: RankedPlace[],
  options: PlanDayOptions,
): Promise<ItineraryStop[]> {
  const profile = options.profile ?? "walking";
  const startMin = parseHM(options.startTime);
  const endMin =
    options.endTime != null
      ? parseHM(options.endTime)
      : startMin + (options.budgetHours ?? 6) * 60;
  const maxStops = options.maxStops ?? 8;

  if (matchedPlaces.length === 0) return [];

  // Candidates: best-ranked first, capped (also keeps us under Matrix's limit).
  const candidates = [...matchedPlaces]
    .sort((a, b) => b.score - a.score)
    .slice(0, maxStops);

  // ONE Mapbox call: real travel times between start + every candidate.
  // points[0] is the start; candidate k is at points[k+1].
  const points: LatLng[] = [
    { lat: options.start.lat, lng: options.start.lng },
    ...candidates.map((p) => ({ lat: p.lat, lng: p.lng })),
  ];
  const matrix = await getTravelMatrix(points, profile);
  const indexOf = new Map<string, number>();
  candidates.forEach((p, k) => indexOf.set(p.id, k + 1)); // +1: start is 0

  // SELF-CORRECTION LOOP (real logic): order + schedule the current set; if it
  // runs past the budget, drop the lowest-ranked stop and try again. This is
  // what keeps the day realistic instead of cramming everything in.
  let working = [...candidates]; // sorted by score desc
  let scheduled: ScheduledStop[] = [];
  while (working.length > 0) {
    const ordered = orderStops(working, matrix, indexOf);
    const result = buildSchedule(ordered, matrix, indexOf, startMin);
    if (result.endMin <= endMin) {
      scheduled = result.stops;
      break;
    }
    working.pop(); // remove lowest-score candidate, recompute
  }

  if (scheduled.length === 0) return [];

  // THE ONLY MODEL STEP: write a short "why it fits you" line per final stop.
  const whyLines = await generateWhyItFits(
    options.vibe,
    scheduled.map((s) => s.place),
  );

  return scheduled.map((s, i) => ({
    place: s.place,
    arrivalTime: formatHM(s.arrivalMin),
    durationMinutes: s.durationMinutes,
    travelToNextMinutes: s.travelToNextMinutes,
    whyItFits: whyLines[i],
  }));
}

// ===========================================================================
// REAL LOGIC — ordering, scheduling, durations (no AI here)
// ===========================================================================

interface ScheduledStop {
  place: RankedPlace;
  arrivalMin: number;
  durationMinutes: number;
  travelToNextMinutes: number;
}

/**
 * Order stops to (a) minimize backtracking and (b) respect time of day.
 * Step 1: greedy nearest-neighbor route from the start (geographic efficiency).
 * Step 2: STABLE sort by time-of-day bucket — this groups morning/day/evening
 *         in order while preserving the geographic order within each bucket.
 */
function orderStops(
  subset: RankedPlace[],
  matrix: number[][],
  indexOf: Map<string, number>,
): RankedPlace[] {
  // Nearest-neighbor from start (matrix index 0).
  const remaining = new Set(subset);
  const route: RankedPlace[] = [];
  let cur = 0;
  while (remaining.size > 0) {
    let best: RankedPlace | null = null;
    let bestSec = Infinity;
    for (const p of remaining) {
      const sec = matrix[cur][indexOf.get(p.id)!];
      if (sec < bestSec) {
        bestSec = sec;
        best = p;
      }
    }
    route.push(best!);
    remaining.delete(best!);
    cur = indexOf.get(best!.id)!;
  }
  // Stable sort by time bucket (Array.prototype.sort is stable).
  return route.sort((a, b) => timeBucket(a) - timeBucket(b));
}

/** Walk the ordered stops, accumulating real travel + visit times. */
function buildSchedule(
  ordered: RankedPlace[],
  matrix: number[][],
  indexOf: Map<string, number>,
  startMin: number,
): { stops: ScheduledStop[]; endMin: number } {
  const stops: ScheduledStop[] = [];
  let t = startMin;
  let prev = 0; // start point

  for (const place of ordered) {
    const idx = indexOf.get(place.id)!;
    const travelFromPrev = Math.round(matrix[prev][idx] / 60);
    t += travelFromPrev; // travel...
    const arrivalMin = t;
    const durationMinutes = durationForPlace(place);
    t += durationMinutes; // ...then visit
    stops.push({ place, arrivalMin, durationMinutes, travelToNextMinutes: 0 });
    prev = idx;
  }

  // Fill travelToNext from each stop to the following one.
  for (let i = 0; i < stops.length - 1; i++) {
    const from = indexOf.get(stops[i].place.id)!;
    const to = indexOf.get(stops[i + 1].place.id)!;
    stops[i].travelToNextMinutes = Math.round(matrix[from][to] / 60);
  }

  const last = stops[stops.length - 1];
  const endMin = last ? last.arrivalMin + last.durationMinutes : startMin;
  return { stops, endMin };
}

function durationForPlace(p: RankedPlace): number {
  let best = 0;
  let found = false;
  for (const t of p.place_types) {
    const d = DURATIONS[t.toLowerCase()];
    if (d != null) {
      best = Math.max(best, d);
      found = true;
    }
  }
  return found ? best : FALLBACK_DURATION;
}

function timePref(p: RankedPlace): number {
  let sum = 0;
  let n = 0;
  for (const t of p.place_types) {
    const v = TIME_PREF[t.toLowerCase()];
    if (v != null) {
      sum += v;
      n++;
    }
  }
  return n > 0 ? sum / n : FALLBACK_PREF;
}

// 0 = morning, 1 = daytime, 2 = evening.
function timeBucket(p: RankedPlace): number {
  const pref = timePref(p);
  return pref < 1 ? 0 : pref < 3 ? 1 : 2;
}

function parseHM(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) {
    throw new Error(`Invalid time "${hm}" — expected "HH:MM".`);
  }
  return h * 60 + m;
}

function formatHM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ===========================================================================
// THE MODEL — language only (the "why it fits you" lines)
// ===========================================================================

/**
 * Ask Gemini for one short note per stop, referencing the vibe. JSON mode with
 * a fixed-length string array keeps it aligned to the stops. If anything goes
 * wrong, we fall back to a plain generated line — the model is never allowed to
 * break the (already-valid) itinerary.
 */
async function generateWhyItFits(
  vibe: string,
  places: RankedPlace[],
): Promise<string[]> {
  const fallback = places.map(
    (p) => `A ${p.place_types[0] ?? "spot"} that fits your "${vibe}" mood.`,
  );

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || places.length === 0) return fallback;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const numbered = places
      .map(
        (p, i) =>
          `${i + 1}. ${p.name} [${p.place_types.join(", ")}] — ${p.description}`,
      )
      .join("\n");

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents:
        `Vibe: "${vibe}"\n\nStops in order:\n${numbered}\n\n` +
        `Write one warm, specific "why this fits you" line per stop, in order.`,
      config: {
        systemInstruction:
          "You write short second-person itinerary notes. Each line <= 20 words, " +
          "references the vibe's feeling, no place name needed, no quotes.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          minItems: String(places.length),
          maxItems: String(places.length),
        },
        temperature: 0.7,
      },
    });

    const text = response.text;
    if (!text) return fallback;
    const lines = JSON.parse(text);
    if (
      Array.isArray(lines) &&
      lines.length === places.length &&
      lines.every((l) => typeof l === "string")
    ) {
      return lines as string[];
    }
    return fallback;
  } catch {
    return fallback;
  }
}
