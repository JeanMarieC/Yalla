"use client";

// Home: two modes. "City day" (Phases 3–5) and "Road trip" (Phase 10). Both
// produce an itinerary rendered in the shared map TripView. When logged in, a
// city day can be saved.

import { useState } from "react";
import VibePicker, { type VibeFormValues } from "@/components/VibePicker";
import RoadTripForm, { type RoadTripFormValues } from "@/components/RoadTripForm";
import TripView from "@/components/TripView";
import TopNav from "@/components/TopNav";
import SaveTripButton from "@/components/SaveTripButton";
import { useUser } from "@/lib/useUser";
import type { ItineraryStop } from "@/lib/ai/planDay";

type Mode = "city" | "roadtrip";

export default function Home() {
  const { user } = useUser();
  const [mode, setMode] = useState<Mode>("city");
  const [itinerary, setItinerary] = useState<ItineraryStop[] | null>(null);
  const [routeLine, setRouteLine] = useState<[number, number][] | undefined>();
  const [vibe, setVibe] = useState("");
  const [submitted, setSubmitted] = useState<VibeFormValues | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, payload: unknown, onOk: (data: { itinerary: ItineraryStop[]; routeLine?: [number, number][] }) => void) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      onOk(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function planCity(values: VibeFormValues) {
    setSubmitted(values);
    setVibe(values.vibe);
    setRouteLine(undefined);
    call("/api/plan", values, (data) => setItinerary(data.itinerary ?? []));
  }

  function planRoadTrip(values: RoadTripFormValues) {
    setSubmitted(null);
    setVibe(values.vibe);
    call("/api/roadtrip", values, (data) => {
      setItinerary(data.itinerary ?? []);
      setRouteLine(data.routeLine);
    });
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
              onClick={() => setItinerary(null)}
              className="rounded-full border border-zinc-200 bg-white/80 px-3 py-1.5 text-sm transition hover:bg-zinc-50"
            >
              New plan
            </button>
          </>
        }
      />
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <TopNav />
      <main className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-xl">
          <header className="mb-8">
            <h1 className="text-5xl font-semibold tracking-tight">Yalla</h1>
            <p className="mt-3 text-lg leading-relaxed text-zinc-500">
              Describe a vibe. Get a ready-to-go day.
            </p>
          </header>

          <div className="mb-8 inline-flex rounded-full bg-zinc-100 p-1 text-sm">
            <button
              onClick={() => setMode("city")}
              className={`rounded-full px-4 py-1.5 transition ${
                mode === "city" ? "bg-white shadow-sm" : "text-zinc-500"
              }`}
            >
              City day
            </button>
            <button
              onClick={() => setMode("roadtrip")}
              className={`rounded-full px-4 py-1.5 transition ${
                mode === "roadtrip" ? "bg-white shadow-sm" : "text-zinc-500"
              }`}
            >
              Road trip
            </button>
          </div>

          {mode === "city" ? (
            <VibePicker
              onSubmit={planCity}
              loading={loading}
              error={error}
              noResults={itinerary?.length === 0}
            />
          ) : (
            <RoadTripForm onSubmit={planRoadTrip} loading={loading} error={error} />
          )}
        </div>
      </main>
    </div>
  );
}
