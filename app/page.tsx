"use client";

// Phase 11 home. Prompt-first: you type one brief, Yalla interprets it and
// routes (plan here / road trip / find a destination) with an editable summary
// you can steer. The manual modes stay, behind a toggle.

import { useState } from "react";
import VibePicker, { type VibeFormValues } from "@/components/VibePicker";
import RoadTripForm, { type RoadTripFormValues } from "@/components/RoadTripForm";
import TripView from "@/components/TripView";
import TopNav from "@/components/TopNav";
import SaveTripButton from "@/components/SaveTripButton";
import DestinationFinder from "@/components/DestinationFinder";
import { useUser } from "@/lib/useUser";
import type { ItineraryStop } from "@/lib/ai/planDay";
import type { TripBrief, Occasion } from "@/lib/ai/interpretBrief";

const OCCASIONS: Occasion[] = ["date", "solo", "family", "friends", "impress", "general"];

export default function Home() {
  const { user } = useUser();

  // Result
  const [itinerary, setItinerary] = useState<ItineraryStop[] | null>(null);
  const [routeLine, setRouteLine] = useState<[number, number][] | undefined>();
  const [vibe, setVibe] = useState("");
  const [submitted, setSubmitted] = useState<VibeFormValues | null>(null);

  // Smart box
  const [text, setText] = useState("");
  const [brief, setBrief] = useState<TripBrief | null>(null);
  const [interpreting, setInterpreting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable "understood" fields
  const [place, setPlace] = useState("");
  const [occasion, setOccasion] = useState<Occasion>("general");
  const [startTime, setStartTime] = useState("10:00");
  const [hours, setHours] = useState(8);

  // Manual fallback
  const [manualOpen, setManualOpen] = useState(false);
  const [manualMode, setManualMode] = useState<"city" | "roadtrip">("city");
  const [planning, setPlanning] = useState(false);

  async function interpret(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || interpreting) return;
    setInterpreting(true);
    setError(null);
    setBrief(null);
    try {
      const res = await fetch("/api/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: text.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't read that.");
      const b: TripBrief = data.brief;
      setBrief(b);
      setPlace(b.place ?? "");
      setOccasion(b.occasion);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that.");
    } finally {
      setInterpreting(false);
    }
  }

  async function planCity(values: VibeFormValues) {
    setPlanning(true);
    setError(null);
    setVibe(values.vibe);
    setSubmitted(values);
    setRouteLine(undefined);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      if (!data.itinerary?.length) {
        setError(`Nothing matched in ${values.city || "that area"} yet.`);
      } else {
        setItinerary(data.itinerary);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPlanning(false);
    }
  }

  async function planRoadTrip(values: RoadTripFormValues) {
    setPlanning(true);
    setError(null);
    setVibe(values.vibe);
    setSubmitted(null);
    try {
      const res = await fetch("/api/roadtrip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setItinerary(data.itinerary ?? []);
      setRouteLine(data.routeLine);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPlanning(false);
    }
  }

  // Plan-here from the understood panel (uses the original brief as the vibe).
  function planFromBrief() {
    if (!brief || !place.trim()) return;
    planCity({ vibe: brief.raw, city: place.trim(), startTime, timeBudget: hours });
  }

  if (itinerary && itinerary.length > 0) {
    return (
      <TripView
        itinerary={itinerary}
        vibe={vibe}
        city={submitted?.city}
        routeLine={routeLine}
        actions={
          <>
            {user && submitted && (
              <SaveTripButton
                vibe={submitted.vibe}
                city={submitted.city}
                itinerary={itinerary}
                startTime={submitted.startTime}
                timeBudget={submitted.timeBudget}
              />
            )}
            <button
              onClick={() => {
                setItinerary(null);
                setBrief(null);
                setText("");
              }}
              className="rounded-full border border-stone-200 bg-white/80 px-3 py-1.5 text-sm transition hover:bg-stone-50"
            >
              New plan
            </button>
          </>
        }
      />
    );
  }

  const input =
    "w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 outline-none transition focus:border-stone-400";

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <TopNav />
      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-xl">
          <header className="mb-8">
            <h1 className="text-5xl font-semibold tracking-tight">Yalla</h1>
            <p className="mt-3 text-lg leading-relaxed text-stone-500">
              Tell Yalla what you&apos;re after. It figures out the rest.
            </p>
          </header>

          {/* The smart box */}
          <form onSubmit={interpret} className="space-y-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              autoFocus
              placeholder="a chill date night in Beirut · good hiking somewhere · what's on in Lisbon this weekend · a road trip to a concert in Byblos friday"
              className="w-full resize-none rounded-2xl border border-stone-200 bg-white px-5 py-4 text-lg leading-relaxed shadow-sm outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
            />
            <button
              type="submit"
              disabled={interpreting || !text.trim()}
              className="w-full rounded-full bg-stone-900 px-6 py-4 text-base font-medium text-white transition hover:bg-stone-700 disabled:opacity-40"
            >
              {interpreting ? "Reading your brief…" : "Plan"}
            </button>
          </form>

          {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

          {/* What Yalla understood — editable + routed */}
          {brief && (
            <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-5">
              <p className="text-xs uppercase tracking-wide text-stone-400">
                Yalla understood
              </p>

              {/* Chips */}
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                <span className="rounded-full bg-stone-100 px-3 py-1">
                  {labelForIntent(brief.intent)}
                </span>
                {brief.timeframe.label && (
                  <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">
                    {brief.timeframe.label}
                  </span>
                )}
                {brief.activities.map((a) => (
                  <span key={a} className="rounded-full bg-stone-100 px-3 py-1">
                    {a}
                  </span>
                ))}
              </div>

              {/* plan_here / find_destination both resolve to "plan in a place" once a place is set */}
              {brief.intent !== "road_trip" ? (
                brief.intent === "find_destination" ? (
                  <DestinationFinder
                    brief={brief}
                    onPick={(name) =>
                      planCity({ vibe: brief.raw, city: name, startTime, timeBudget: hours })
                    }
                  />
                ) : (
                <div className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1 block text-sm text-stone-600">Place</span>
                      <input
                        value={place}
                        onChange={(e) => setPlace(e.target.value)}
                        placeholder="Beirut"
                        className={input}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm text-stone-600">For</span>
                      <select
                        value={occasion}
                        onChange={(e) => setOccasion(e.target.value as Occasion)}
                        className={input}
                      >
                        {OCCASIONS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm text-stone-600">Start</span>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className={input}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-sm text-stone-600">Hours</span>
                      <select
                        value={hours}
                        onChange={(e) => setHours(Number(e.target.value))}
                        className={input}
                      >
                        {[4, 6, 8, 10].map((h) => (
                          <option key={h} value={h}>
                            {h} hours
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <button
                    onClick={planFromBrief}
                    disabled={planning || !place.trim()}
                    className="w-full rounded-full bg-stone-900 px-6 py-3 font-medium text-white transition hover:bg-stone-700 disabled:opacity-40"
                  >
                    {planning ? "Planning your day…" : "Plan my day"}
                  </button>
                </div>
                )
              ) : (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-stone-500">
                    That&apos;s a road trip{brief.place ? ` to ${brief.place}` : ""}.
                    Open the road-trip setup to add start + event coordinates.
                  </p>
                  <button
                    onClick={() => {
                      setManualOpen(true);
                      setManualMode("roadtrip");
                    }}
                    className="w-full rounded-full bg-stone-900 px-6 py-3 font-medium text-white transition hover:bg-stone-700"
                  >
                    Set up the road trip
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Manual fallback — both modes stay available */}
          <div className="mt-8">
            <button
              onClick={() => setManualOpen((v) => !v)}
              className="text-sm text-stone-500 underline transition hover:text-stone-800"
            >
              {manualOpen ? "Hide manual setup" : "Prefer to set it up yourself?"}
            </button>

            {manualOpen && (
              <div className="mt-5">
                <div className="mb-6 inline-flex rounded-full bg-stone-100 p-1 text-sm">
                  <button
                    onClick={() => setManualMode("city")}
                    className={`rounded-full px-4 py-1.5 transition ${
                      manualMode === "city" ? "bg-white shadow-sm" : "text-stone-500"
                    }`}
                  >
                    Plan in a place
                  </button>
                  <button
                    onClick={() => setManualMode("roadtrip")}
                    className={`rounded-full px-4 py-1.5 transition ${
                      manualMode === "roadtrip" ? "bg-white shadow-sm" : "text-stone-500"
                    }`}
                  >
                    Road trip
                  </button>
                </div>
                {manualMode === "city" ? (
                  <VibePicker onSubmit={planCity} loading={planning} error={null} />
                ) : (
                  <RoadTripForm onSubmit={planRoadTrip} loading={planning} error={null} />
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function labelForIntent(intent: TripBrief["intent"]): string {
  if (intent === "road_trip") return "Road trip";
  if (intent === "find_destination") return "Find a destination";
  return "Plan in a place";
}
