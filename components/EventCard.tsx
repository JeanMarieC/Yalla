"use client";

// Phase 7 — Sliding detail card for a tapped event. Same drawer/sheet behavior
// as StopCard, but event-shaped: name, live time window, why it fits.

import type { PulseEvent } from "@/lib/events";
import { formatEventWhen } from "@/lib/formatTime";

interface EventCardProps {
  event: PulseEvent | null;
  onClose: () => void;
}

export default function EventCard({ event, onClose }: EventCardProps) {
  const open = event != null;

  return (
    <div
      className={`fixed z-20 max-h-[88dvh] overflow-y-auto bg-white shadow-2xl transition-transform duration-300 ease-out
        inset-x-0 bottom-0 rounded-t-3xl
        md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[400px] md:rounded-none md:rounded-l-3xl
        ${
          open
            ? "translate-y-0 md:translate-x-0"
            : "translate-y-full md:translate-y-0 md:translate-x-full"
        }`}
      aria-hidden={!open}
    >
      {event && (
        <div className="flex h-full flex-col p-6 pb-8 md:p-8">
          <div className="mx-auto mb-4 h-1.5 w-10 shrink-0 rounded-full bg-stone-300 md:hidden" />
          <div className="mb-6 flex items-start justify-between gap-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
              </span>
              Live this week
            </span>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight">{event.name}</h2>
          <p className="mt-1 text-sm text-stone-500">{event.tags.join(" · ")}</p>

          <p className="mt-5 text-sm font-medium tabular-nums text-stone-700">
            {formatEventWhen(event.start_time, event.end_time)}
          </p>

          <div className="mt-6 rounded-2xl bg-stone-50 p-5">
            <p className="text-xs uppercase tracking-wide text-stone-400">Why it fits</p>
            <p className="mt-2 leading-relaxed text-stone-700">{event.whyItFits}</p>
          </div>

          <p className="mt-6 text-sm leading-relaxed text-stone-500">
            {event.description}
          </p>
        </div>
      )}
    </div>
  );
}
