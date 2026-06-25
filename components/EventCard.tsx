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
      className={`fixed z-20 max-h-[88dvh] overflow-y-auto bg-surface shadow-2xl transition-transform duration-300 ease-out
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
          <div className="mx-auto mb-5 h-1 w-10 shrink-0 rounded-full bg-[#D7CDBA] md:hidden" />
          <div className="mb-5 flex items-start justify-between gap-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-sage-tint px-3 py-1 text-xs font-semibold text-sage-deep">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sage opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-sage" />
              </span>
              Live this week
            </span>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-paper text-muted transition hover:text-ink"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <h2 className="font-display text-2xl tracking-tight text-ink md:text-3xl">{event.name}</h2>
          <p className="mt-1 text-sm text-muted">{event.tags.join(" · ")}</p>

          <p className="mt-4 text-sm font-semibold tabular-nums text-sage-deep">
            {formatEventWhen(event.start_time, event.end_time)}
          </p>

          <div className="mt-5 rounded-2xl border border-sage/30 bg-sage-tint p-4">
            <p className="yalla-eyebrow text-[9.5px] text-sage-deep">Why this fits you</p>
            <p className="mt-1.5 font-display text-[15px] italic leading-relaxed text-sage-deep">
              {event.whyItFits}
            </p>
          </div>

          <p className="mt-5 text-sm leading-relaxed text-ink-soft">
            {event.description}
          </p>
        </div>
      )}
    </div>
  );
}
