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
              className="btn-ghost px-4 py-1.5 text-sm"
            >
              New plan
            </button>
          </>
        }
      />
    );
  }

  const input = "yalla-input";

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <TopNav />
      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-2xl animate-fade-up text-center">
          <header className="mb-8">
            <p className="yalla-eyebrow mb-5">Where to today?</p>
            <h1 className="font-display text-5xl font-normal leading-[1.04] tracking-tight text-ink sm:text-6xl">
              Tell Yalla what you&apos;re after.
            </h1>
          </header>

          {/* The smart box */}
          <form onSubmit={interpret} className="yalla-card p-5 text-left shadow-md sm:p-6">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              autoFocus
              placeholder="A chill date night in Beirut, somewhere walkable with golden-hour wine…"
              className="w-full resize-none border-none bg-transparent font-display text-xl leading-relaxed text-ink outline-none placeholder:text-muted/80 placeholder:italic"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-hairline-soft pt-4">
              <div className="hidden flex-wrap gap-2 sm:flex">
                {["a chill date night", "good hiking somewhere", "what's on in Lisbon"].map(
                  (ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setText(ex)}
                      className="rounded-full bg-paper px-3 py-1.5 text-[13px] text-muted transition hover:text-ink"
                    >
                      {ex}
                    </button>
                  ),
                )}
              </div>
              <button
                type="submit"
                disabled={interpreting || !text.trim()}
                className="btn-primary ml-auto px-6 py-3 text-[15px]"
              >
                {interpreting ? "Reading your brief…" : "Plan my day →"}
              </button>
            </div>
          </form>

          <p className="mt-5 text-[13.5px] text-muted">
            Don&apos;t know where? Just say the vibe —{" "}
            <span className="text-ink">we&apos;ll find the place.</span>
          </p>

          {error && <p className="mt-4 text-sm text-terracotta-deep">{error}</p>}

          {/* What Yalla understood — editable + routed */}
          {brief && (
            <div className="mt-6 animate-fade-up text-left">
              <div className="mb-4 flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sage text-sm text-white">
                  ✓
                </span>
                <span className="font-display text-2xl tracking-tight text-ink">
                  Yalla understood —
                </span>
              </div>
              <div className="yalla-card p-6 shadow-md">
                <p className="mb-5 font-display text-lg italic text-ink-soft">
                  &ldquo;{brief.raw}&rdquo;
                </p>

                {/* Chips */}
                <div className="flex flex-wrap gap-2.5">
                  <span className="yalla-chip">
                    <span className="yalla-chip-key">intent</span>
                    {labelForIntent(brief.intent)}
                  </span>
                  {brief.place && (
                    <span className="yalla-chip yalla-chip-accent">
                      <span className="yalla-chip-key opacity-70">place</span>
                      {brief.place}
                    </span>
                  )}
                  {brief.timeframe.label && (
                    <span className="yalla-chip">
                      <span className="yalla-chip-key">when</span>
                      {brief.timeframe.label}
                    </span>
                  )}
                  {brief.activities.map((a) => (
                    <span key={a} className="yalla-chip">
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
                <div className="mt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1.5 block text-sm text-ink-soft">Place</span>
                      <input
                        value={place}
                        onChange={(e) => setPlace(e.target.value)}
                        placeholder="Beirut"
                        className={input}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm text-ink-soft">For</span>
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
                      <span className="mb-1.5 block text-sm text-ink-soft">Start</span>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className={input}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm text-ink-soft">Hours</span>
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
                    className="btn-primary w-full px-6 py-3.5 text-base"
                  >
                    {planning ? "Planning your day…" : "Plan my day →"}
                  </button>
                </div>
                )
              ) : (
                <div className="mt-6 space-y-3">
                  <p className="text-sm text-ink-soft">
                    That&apos;s a road trip{brief.place ? ` to ${brief.place}` : ""}.
                    Open the road-trip setup to add start + event coordinates.
                  </p>
                  <button
                    onClick={() => {
                      setManualOpen(true);
                      setManualMode("roadtrip");
                    }}
                    className="btn-primary w-full px-6 py-3.5 text-base"
                  >
                    Set up the road trip
                  </button>
                </div>
              )}
              </div>
            </div>
          )}

          {/* Manual fallback — both modes stay available */}
          <div className="mt-8 text-left">
            <button
              onClick={() => setManualOpen((v) => !v)}
              className="text-sm font-medium text-terracotta-deep underline underline-offset-[3px] transition hover:text-terracotta"
            >
              {manualOpen ? "Hide manual setup" : "Prefer to set it up yourself?"}
            </button>

            {manualOpen && (
              <div className="mt-5 animate-fade-up">
                <div className="mb-6 inline-flex rounded-full bg-paper p-1 text-sm">
                  <button
                    onClick={() => setManualMode("city")}
                    className={`rounded-full px-4 py-1.5 transition ${
                      manualMode === "city"
                        ? "bg-surface text-ink shadow-sm"
                        : "text-muted"
                    }`}
                  >
                    Plan in a place
                  </button>
                  <button
                    onClick={() => setManualMode("roadtrip")}
                    className={`rounded-full px-4 py-1.5 transition ${
                      manualMode === "roadtrip"
                        ? "bg-surface text-ink shadow-sm"
                        : "text-muted"
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
