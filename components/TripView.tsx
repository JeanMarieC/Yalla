"use client";

// Phase 5/6 — The trip experience. Full-screen map with a calm editorial list
// panel (desktop) and a sliding StopCard. Owns the shared selection state.
// Header `actions` are supplied by the parent (home: Save + New; saved trip:
// My Trips link), so this component stays reusable.

import { useState } from "react";
import dynamic from "next/dynamic";
import ItineraryList from "@/components/ItineraryList";
import StopCard from "@/components/StopCard";
import type { ItineraryStop } from "@/lib/ai/planDay";

// Mapbox GL touches `window`, so load it client-only.
const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-zinc-100" />,
});

interface TripViewProps {
  itinerary: ItineraryStop[];
  vibe: string;
  title?: string;
  actions?: React.ReactNode;
}

export default function TripView({
  itinerary,
  vibe,
  title = "Your day",
  actions,
}: TripViewProps) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">
      {/* Map fills everything behind. */}
      <div className="absolute inset-0">
        <Map
          stops={itinerary}
          selectedIndex={selected}
          onSelectStop={setSelected}
        />
      </div>

      {/* Editorial panel — desktop only. */}
      <aside className="absolute inset-y-0 left-0 z-10 hidden w-[380px] flex-col bg-white/95 backdrop-blur md:flex">
        <header className="flex items-baseline justify-between gap-4 px-6 pb-4 pt-6">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1 truncate text-sm text-zinc-500">&ldquo;{vibe}&rdquo;</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        </header>
        <div className="flex-1 overflow-y-auto px-3 pb-6">
          <ItineraryList
            stops={itinerary}
            selectedIndex={selected}
            onSelect={setSelected}
          />
        </div>
      </aside>

      {/* Mobile top bar — compact. */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 bg-gradient-to-b from-white/90 to-transparent px-4 pb-8 pt-4 md:hidden">
        <p className="truncate text-sm font-medium">&ldquo;{vibe}&rdquo;</p>
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      </div>

      {/* Sliding detail card for the selected stop. */}
      <StopCard
        stop={selected != null ? itinerary[selected] : null}
        index={selected}
        total={itinerary.length}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
