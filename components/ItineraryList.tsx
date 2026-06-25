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
        const last = i === stops.length - 1;
        return (
          <li key={stop.place.id}>
            <button
              type="button"
              onClick={() => onSelect?.(i)}
              className={`flex w-full gap-4 px-3 py-4 text-left transition ${
                last ? "" : "border-b border-hairline-soft"
              } ${
                selected
                  ? "-mx-1 rounded-xl border-transparent bg-terracotta-tint px-4"
                  : "hover:bg-paper/60"
              }`}
            >
              <span className="w-14 shrink-0 text-right">
                <span
                  className={`block text-sm font-bold tabular-nums ${
                    selected ? "text-terracotta-deep" : "text-ink"
                  }`}
                >
                  {stop.arrivalTime}
                </span>
                <span className="block text-[11px] text-faint">
                  {formatDuration(stop.durationMinutes)}
                </span>
              </span>
              <span
                className="flex h-7 w-7 shrink-0 -rotate-45 items-center justify-center rounded-[999px_999px_999px_3px] text-white"
                style={{ background: selected ? "#C0603C" : "#211C15" }}
              >
                <span className="rotate-45 text-xs font-bold text-paper">{i + 1}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">
                  {stop.place.name}
                </span>
                <span className="mt-1 block font-display text-[13.5px] italic leading-snug text-muted">
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

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h${m}`;
  if (h) return `${h}h`;
  return `${m}m`;
}
