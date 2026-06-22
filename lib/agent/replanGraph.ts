// Phase 9 (Pass 3) — The re-planning agent, as a LangGraph state machine.
//
// HUMAN-IN-THE-LOOP: the graph does NOT run continuously. Humans vote over time
// (the "pause"), with votes accumulating in the DB. When a stop crosses the
// downvote threshold the graph is invoked once (the "resume"): it reads the
// group's accumulated input and acts. The DB *is* the pause buffer — which keeps
// the agent stateless and safe to run from a serverless route.
//
// MODEL vs REAL LOGIC (CLAUDE.md principle 1):
//   - REAL: picking a replacement (vibe vector match) and re-routing/re-timing
//     (planDay + Mapbox) are deterministic.
//   - MODEL: the Gemini chat model (wired into the graph) only writes the
//     one-line, human-facing "what changed" note.

import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { supabaseAdmin } from "../supabase";
import { matchPlacesToVibe, type RankedPlace } from "../places";
import { planDay, type ItineraryStop } from "./../ai/planDay";

const DOWNVOTE_THRESHOLD = 2;
const MAX_ATTEMPTS = 4;

const ReplanState = Annotation.Root({
  tripId: Annotation<string>(),
  removedStopId: Annotation<string>(),
  vibe: Annotation<string>(),
  city: Annotation<string | null>(),
  startTime: Annotation<string>(),
  budgetHours: Annotation<number>(),
  current: Annotation<ItineraryStop[]>(),
  downvotedIds: Annotation<string[]>(),
  pool: Annotation<RankedPlace[]>(),
  replacement: Annotation<RankedPlace | null>(),
  newItinerary: Annotation<ItineraryStop[]>(),
  note: Annotation<string>(),
  triedIds: Annotation<string[]>({ reducer: (_a, b) => b, default: () => [] }),
  attempts: Annotation<number>({ reducer: (_a, b) => b, default: () => 0 }),
});
type State = typeof ReplanState.State;

function centroid(places: RankedPlace[]): { lat: number; lng: number } {
  const lat = places.reduce((s, p) => s + p.lat, 0) / places.length;
  const lng = places.reduce((s, p) => s + p.lng, 0) / places.length;
  return { lat, lng };
}

// (a) Read the group state: itinerary, vibe, and what's been downvoted out.
async function readNode(state: State): Promise<Partial<State>> {
  const admin = supabaseAdmin();
  const { data: trip } = await admin
    .from("trips")
    .select("vibe, city, itinerary, start_time, budget_hours")
    .eq("id", state.tripId)
    .single();
  const { data: voteRows } = await admin
    .from("votes")
    .select("stop_id, vote")
    .eq("lobby_id", state.tripId);

  const downCounts = new Map<string, number>();
  for (const v of voteRows ?? []) {
    if (v.vote === "down")
      downCounts.set(v.stop_id, (downCounts.get(v.stop_id) ?? 0) + 1);
  }
  const downvotedIds = [...downCounts.entries()]
    .filter(([, n]) => n >= DOWNVOTE_THRESHOLD)
    .map(([id]) => id);

  return {
    vibe: trip?.vibe ?? "",
    city: trip?.city ?? null,
    startTime: trip?.start_time ?? "10:00",
    budgetHours: trip?.budget_hours ?? 8,
    current: (trip?.itinerary as ItineraryStop[]) ?? [],
    downvotedIds,
  };
}

// (b) Pick a replacement via vibe matching, excluding stops already in the day,
//     downvoted stops, and any candidate we've already tried this run.
async function pickNode(state: State): Promise<Partial<State>> {
  const pool =
    state.pool ??
    (await matchPlacesToVibe(state.vibe, { city: state.city ?? undefined }, 50));

  const currentIds = state.current.map((s) => s.place.id);
  const exclude = new Set<string>([
    ...currentIds,
    ...state.downvotedIds,
    state.removedStopId,
    ...state.triedIds,
  ]);
  const replacement = pool.find((p) => !exclude.has(p.id)) ?? null;

  return {
    pool,
    replacement,
    triedIds: replacement ? [...state.triedIds, replacement.id] : state.triedIds,
    attempts: state.attempts + 1,
  };
}

// (c) Re-route + re-time with Phase 4 logic (planDay self-corrects the budget).
async function rescheduleNode(state: State): Promise<Partial<State>> {
  const keptIds = state.current
    .map((s) => s.place.id)
    .filter((id) => id !== state.removedStopId);
  const byId = new Map(state.pool.map((p) => [p.id, p]));

  const finalPlaces: RankedPlace[] = [];
  for (const id of keptIds) {
    const p = byId.get(id);
    if (p) finalPlaces.push(p);
  }
  if (state.replacement) finalPlaces.push(state.replacement);

  if (finalPlaces.length === 0) return { newItinerary: [] };

  const itin = await planDay(finalPlaces, {
    vibe: state.vibe,
    start: centroid(finalPlaces),
    startTime: state.startTime,
    budgetHours: state.budgetHours,
  });
  return { newItinerary: itin };
}

// Loop back if we got a replacement but the day couldn't fit it.
function routeAfterReschedule(state: State): "retry" | "write" {
  if (
    state.newItinerary.length === 0 &&
    state.replacement != null &&
    state.attempts < MAX_ATTEMPTS
  ) {
    return "retry";
  }
  return "write";
}

// (d) Write the updated itinerary + a model-written change note; clear the
//     removed stop's votes. The trips UPDATE syncs to everyone via Realtime.
async function writeNode(state: State): Promise<Partial<State>> {
  const admin = supabaseAdmin();
  const removedName =
    state.current.find((s) => s.place.id === state.removedStopId)?.place.name ??
    "a stop";
  const addedName = state.replacement?.name;

  let note = addedName
    ? `Swapped ${removedName} for ${addedName}.`
    : `Removed ${removedName}.`;
  try {
    const model = new ChatGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY,
      model: "gemini-2.5-flash",
      temperature: 0.6,
    });
    const prompt = addedName
      ? `The group voted out "${removedName}". You swapped in "${addedName}" to fit the vibe "${state.vibe}". Write ONE friendly update line (<=16 words), no quotes.`
      : `The group voted out "${removedName}" and nothing else fit the day for the vibe "${state.vibe}". Write ONE friendly update line (<=16 words), no quotes.`;
    const res = await model.invoke(prompt);
    const c = res.content;
    const text =
      typeof c === "string"
        ? c
        : Array.isArray(c)
          ? c.map((x) => (typeof x === "string" ? x : "")).join(" ")
          : "";
    note = text.trim() || note;
  } catch {
    // keep the deterministic fallback note
  }

  await admin
    .from("trips")
    .update({ itinerary: state.newItinerary, last_change_note: note })
    .eq("id", state.tripId);
  await admin
    .from("votes")
    .delete()
    .eq("lobby_id", state.tripId)
    .eq("stop_id", state.removedStopId);

  return { note };
}

const graph = new StateGraph(ReplanState)
  .addNode("read", readNode)
  .addNode("pick", pickNode)
  .addNode("reschedule", rescheduleNode)
  .addNode("write", writeNode)
  .addEdge(START, "read")
  .addEdge("read", "pick")
  .addEdge("pick", "reschedule")
  .addConditionalEdges("reschedule", routeAfterReschedule, {
    retry: "pick",
    write: "write",
  })
  .addEdge("write", END)
  .compile();

/** Run one re-plan cycle (the "resume" after humans have voted). */
export async function runReplan(tripId: string, removedStopId: string): Promise<void> {
  await graph.invoke({ tripId, removedStopId });
}
