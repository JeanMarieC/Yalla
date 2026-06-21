"use client";

// Phase 5/6 home. form -> /api/plan -> map TripView. When logged in, the trip
// view offers "Save trip"; the nav links to auth + My Trips.

import { useState } from "react";
import VibePicker, { type VibeFormValues } from "@/components/VibePicker";
import TripView from "@/components/TripView";
import TopNav from "@/components/TopNav";
import SaveTripButton from "@/components/SaveTripButton";
import { useUser } from "@/lib/useUser";
import type { ItineraryStop } from "@/lib/ai/planDay";

export default function Home() {
  const { user } = useUser();
  const [itinerary, setItinerary] = useState<ItineraryStop[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<VibeFormValues | null>(null);

  async function handleSubmit(values: VibeFormValues) {
    setLoading(true);
    setError(null);
    setSubmitted(values);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setItinerary(data.itinerary ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (itinerary && itinerary.length > 0 && submitted) {
    return (
      <TripView
        itinerary={itinerary}
        vibe={submitted.vibe}
        actions={
          <>
            {user && (
              <SaveTripButton
                vibe={submitted.vibe}
                city={submitted.city}
                itinerary={itinerary}
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
      <VibePicker
        onSubmit={handleSubmit}
        loading={loading}
        error={error}
        noResults={itinerary?.length === 0}
      />
    </div>
  );
}
