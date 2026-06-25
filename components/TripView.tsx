"use client";

// Phase 5/6/7 — The trip experience. Full-screen map + editorial panel + sliding
// card. The Pulse toggle swaps the itinerary (numbered pins + route) for live,
// this-week events in the same city, ranked by the trip's vibe.

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import ItineraryList from "@/components/ItineraryList";
import EventList from "@/components/EventList";
import StopCard from "@/components/StopCard";
import EventCard from "@/components/EventCard";
import type { ItineraryStop } from "@/lib/ai/planDay";
import type { PulseEvent } from "@/lib/events";
import type { MapPoint } from "@/components/Map";

const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-canvas" />,
});

interface TripViewProps {
  itinerary: ItineraryStop[];
  vibe: string;
  city?: string;
  title?: string;
  actions?: React.ReactNode;
  /** Real drive geometry (road-trip mode) drawn instead of straight legs. */
  routeLine?: [number, number][];
}

export default function TripView({
  itinerary,
  vibe,
  city,
  title = "Your day",
  actions,
  routeLine,
}: TripViewProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const [pulseOn, setPulseOn] = useState(false);
  const [events, setEvents] = useState<PulseEvent[] | null>(null);
  const [pulseLoading, setPulseLoading] = useState(false);

  async function togglePulse() {
    const next = !pulseOn;
    setPulseOn(next);
    setSelected(null);
    if (next && events === null && !pulseLoading) {
      setPulseLoading(true);
      try {
        const res = await fetch("/api/pulse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vibe, city: city ?? "", withinDays: 7 }),
        });
        const data = await res.json();
        setEvents(res.ok ? (data.events ?? []) : []);
      } catch {
        setEvents([]);
      } finally {
        setPulseLoading(false);
      }
    }
  }

  const points: MapPoint[] = useMemo(() => {
    if (pulseOn) {
      return (events ?? []).map((e) => ({ lng: e.lng, lat: e.lat }));
    }
    return itinerary.map((s) => ({ lng: s.place.lng, lat: s.place.lat }));
  }, [pulseOn, events, itinerary]);

  const emptyPulse = pulseOn && !pulseLoading && (events?.length ?? 0) === 0;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">
      <div className="absolute inset-0">
        <Map
          points={points}
          selectedIndex={selected}
          onSelectPoint={setSelected}
          showRoute={!pulseOn}
          variant={pulseOn ? "event" : "stop"}
          routeLine={pulseOn ? undefined : routeLine}
        />
      </div>

      {/* Loading / empty overlays for the Pulse. */}
      {pulseOn && pulseLoading && (
        <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center">
          <span className="rounded-full bg-surface/90 px-4 py-2 text-sm text-ink-soft shadow-md backdrop-blur">
            Reading the Pulse…
          </span>
        </div>
      )}
      {emptyPulse && (
        <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center px-6">
          <span className="rounded-2xl bg-surface/90 px-5 py-3 text-center text-sm text-ink-soft shadow-md backdrop-blur">
            Nothing live this week for that vibe{city ? ` in ${city}` : ""}.
          </span>
        </div>
      )}

      {/* Editorial panel — desktop only. */}
      <aside className="absolute inset-y-0 left-0 z-10 hidden w-[400px] flex-col border-r border-hairline bg-surface/95 backdrop-blur md:flex">
        <header className="flex items-baseline justify-between gap-4 px-6 pb-4 pt-6">
          <div className="min-w-0">
            <p
              className={`yalla-eyebrow mb-1.5 flex items-center gap-2 text-[11px] ${
                pulseOn ? "text-sage-deep" : ""
              }`}
            >
              {pulseOn && <span className="h-2 w-2 rounded-full bg-sage animate-pulse-ring" />}
              {pulseOn ? "The Pulse · live this week" : `Your day · ${itinerary.length} stops`}
            </p>
            <h1 className="font-display text-[26px] leading-tight tracking-tight text-ink">
              {pulseOn ? "What's alive here" : title}
            </h1>
            <p className="mt-1 truncate font-display text-sm italic text-muted">
              &ldquo;{vibe}&rdquo;
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        </header>
        <div className="flex-1 overflow-y-auto px-3 pb-6">
          {pulseOn ? (
            <EventList
              events={events ?? []}
              selectedIndex={selected}
              onSelect={setSelected}
            />
          ) : (
            <ItineraryList
              stops={itinerary}
              selectedIndex={selected}
              onSelect={setSelected}
            />
          )}
        </div>
      </aside>

      {/* Mobile top bar. */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 bg-gradient-to-b from-surface/90 to-transparent px-4 pb-8 pt-4 md:hidden">
        <p className="truncate font-display text-sm italic text-ink">&ldquo;{vibe}&rdquo;</p>
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      </div>

      {/* The single Pulse toggle. */}
      <button
        onClick={togglePulse}
        className={`absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2.5 rounded-full px-5 py-2.5 text-sm font-semibold shadow-lg backdrop-blur transition ${
          pulseOn
            ? "bg-sage text-white hover:bg-sage-deep"
            : "border border-hairline bg-surface/95 text-ink hover:bg-paper"
        }`}
      >
        <span className="relative flex h-2.5 w-2.5">
          {pulseOn && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
          )}
          <span
            className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
              pulseOn ? "bg-white" : "bg-sage"
            }`}
          />
        </span>
        {pulseOn ? "Pulse on" : "Pulse"}
      </button>

      {/* Sliding card — event or stop depending on mode. */}
      {pulseOn ? (
        <EventCard
          event={selected != null ? (events?.[selected] ?? null) : null}
          onClose={() => setSelected(null)}
        />
      ) : (
        <StopCard
          stop={selected != null ? itinerary[selected] : null}
          index={selected}
          total={itinerary.length}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
