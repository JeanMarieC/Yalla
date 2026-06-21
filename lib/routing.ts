// Phase 4 — Travel times and routing (REAL systems, not the LLM).
// Per CLAUDE.md principle 1: facts and math come from Mapbox + arithmetic,
// never from the model. This module only talks to the Mapbox Matrix API.

export type TravelProfile = "walking" | "cycling" | "driving";

export interface LatLng {
  lat: number;
  lng: number;
}

function mapboxToken(): string {
  const token =
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? process.env.MAPBOX_TOKEN;
  if (!token) {
    throw new Error(
      "Mapbox token is not set. Add NEXT_PUBLIC_MAPBOX_TOKEN to .env.local.",
    );
  }
  return token;
}

/**
 * Real travel-time matrix between points, in SECONDS. durations[i][j] is the
 * time to go from points[i] to points[j]. One Mapbox Matrix call covers all
 * pairs (used for both ordering and per-leg timing in planDay).
 *
 * Any leg Mapbox can't route (null) falls back to a straight-line estimate so
 * the schedule never breaks.
 */
export async function getTravelMatrix(
  points: LatLng[],
  profile: TravelProfile = "walking",
): Promise<number[][]> {
  if (points.length === 0) return [];
  if (points.length === 1) return [[0]];
  if (points.length > 25) {
    // Mapbox Matrix caps at 25 coordinates per request.
    throw new Error(
      `getTravelMatrix: ${points.length} points exceeds the Mapbox Matrix limit of 25.`,
    );
  }

  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url =
    `https://api.mapbox.com/directions-matrix/v1/mapbox/${profile}/${coords}` +
    `?annotations=duration&access_token=${mapboxToken()}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mapbox Matrix API ${res.status}: ${body}`);
  }
  const data = (await res.json()) as {
    code: string;
    durations?: (number | null)[][];
    message?: string;
  };
  if (data.code !== "Ok" || !data.durations) {
    throw new Error(`Mapbox Matrix API error: ${data.message ?? data.code}`);
  }

  // Replace any null (unroutable) legs with a straight-line estimate.
  return data.durations.map((row, i) =>
    row.map((d, j) => (d == null ? estimateSeconds(points[i], points[j], profile) : d)),
  );
}

/**
 * Convenience: travel times (in MINUTES) for the consecutive legs of an ordered
 * route. Length is points.length - 1. Returns [] for fewer than 2 points.
 */
export async function getLegDurations(
  orderedPoints: LatLng[],
  profile: TravelProfile = "walking",
): Promise<number[]> {
  if (orderedPoints.length < 2) return [];
  const matrix = await getTravelMatrix(orderedPoints, profile);
  const legs: number[] = [];
  for (let i = 0; i < orderedPoints.length - 1; i++) {
    legs.push(Math.round(matrix[i][i + 1] / 60));
  }
  return legs;
}

// --- Straight-line fallback (only used when Mapbox returns null) -----------

const SPEED_MPS: Record<TravelProfile, number> = {
  walking: 1.4, // ~5 km/h
  cycling: 4.2, // ~15 km/h
  driving: 11, // ~40 km/h city
};

function estimateSeconds(a: LatLng, b: LatLng, profile: TravelProfile): number {
  return haversineMeters(a, b) / SPEED_MPS[profile];
}

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
