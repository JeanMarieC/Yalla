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
      <p className="px-4 py-6 text-sm text-zinc-500">
        Nothing live this week for that vibe here.
      </p>
    );
  }
  return (
    <ol className="space-y-1">
      {events.map((ev, i) => {
        const selected = i === selectedIndex;
        return (
          <li key={ev.id}>
            <button
              type="button"
              onClick={() => onSelect?.(i)}
              className={`flex w-full gap-4 rounded-2xl px-4 py-4 text-left transition ${
                selected ? "bg-rose-50" : "hover:bg-zinc-50"
              }`}
            >
              <span className="mt-1.5 flex h-3 w-3 shrink-0 rounded-full bg-rose-500 ring-2 ring-rose-200" />
              <span className="min-w-0 flex-1">
                <span className="truncate font-medium text-zinc-900">{ev.name}</span>
                <span className="mt-0.5 block text-sm text-zinc-500">
                  {formatEventWhen(ev.start_time, ev.end_time)}
                </span>
                <span className="mt-1.5 block text-sm leading-relaxed text-zinc-600">
                  {ev.whyItFits}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
