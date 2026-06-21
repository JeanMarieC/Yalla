"use client";

// Phase 5 — The day as an editorial list. Used on its own in Pass 1 to confirm
// the flow, and as the side panel beside the map in Pass 2. Clicking a row
// selects that stop (so the map can react).

import type { ItineraryStop } from "@/lib/ai/planDay";

interface ItineraryListProps {
  stops: ItineraryStop[];
  selectedIndex?: number | null;
  onSelect?: (index: number) => void;
}

export default function ItineraryList({
  stops,
  selectedIndex = null,
  onSelect,
}: ItineraryListProps) {
  return (
    <ol className="space-y-1">
      {stops.map((stop, i) => {
        const selected = i === selectedIndex;
        return (
          <li key={stop.place.id}>
            <button
              type="button"
              onClick={() => onSelect?.(i)}
              className={`flex w-full gap-4 rounded-2xl px-4 py-4 text-left transition ${
                selected ? "bg-zinc-100" : "hover:bg-zinc-50"
              }`}
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate font-medium text-zinc-900">
                    {stop.place.name}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-zinc-400">
                    {stop.arrivalTime}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-sm text-zinc-500">
                  {stop.place.place_types.join(" · ")}
                </span>
                <span className="mt-1.5 block text-sm leading-relaxed text-zinc-600">
                  {stop.whyItFits}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
