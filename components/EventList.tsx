"use client";

// Phase 7 — Pulse events as an editorial list (desktop panel). Mirrors
// ItineraryList but for live events: time window instead of arrival time.

import type { PulseEvent } from "@/lib/events";
import { formatEventWhen } from "@/lib/formatTime";

interface EventListProps {
  events: PulseEvent[];
  selectedIndex?: number | null;
  onSelect?: (index: number) => void;
}

export default function EventList({
  events,
  selectedIndex = null,
  onSelect,
}: EventListProps) {
  if (events.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-muted">
        Nothing live this week for that vibe here.
      </p>
    );
  }
  return (
    <ol className="space-y-2">
      {events.map((ev, i) => {
        const selected = i === selectedIndex;
        return (
          <li key={ev.id}>
            <button
              type="button"
              onClick={() => onSelect?.(i)}
              className={`w-full rounded-2xl border border-l-[3px] border-hairline border-l-sage bg-surface px-4 py-3.5 text-left transition ${
                selected ? "bg-sage-tint/60" : "hover:bg-paper/60"
              }`}
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="truncate font-semibold text-ink">{ev.name}</span>
                <span className="shrink-0 text-xs font-semibold text-sage-deep">
                  {formatEventWhen(ev.start_time, ev.end_time)}
                </span>
              </span>
              <span className="mt-1 block font-display text-[13.5px] italic leading-snug text-muted">
                {ev.whyItFits}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
