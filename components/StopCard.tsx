"use client";

// Phase 5 — Sliding detail card for a tapped stop.
// Bottom sheet on mobile, right-side drawer on desktop. Always mounted so it
// can animate in/out via transform; visibility is driven by `stop`.

import Link from "next/link";
import type { ItineraryStop } from "@/lib/ai/planDay";

interface StopCardProps {
  stop: ItineraryStop | null;
  index: number | null;
  total: number;
  onClose: () => void;
}

export default function StopCard({ stop, index, total, onClose }: StopCardProps) {
  const open = stop != null;

  return (
    <div
      className={`fixed z-20 bg-white shadow-2xl transition-transform duration-300 ease-out
        inset-x-0 bottom-0 rounded-t-3xl
        md:inset-y-0 md:left-auto md:right-0 md:w-[400px] md:rounded-none md:rounded-l-3xl
        ${
          open
            ? "translate-y-0 md:translate-x-0"
            : "translate-y-full md:translate-y-0 md:translate-x-full"
        }`}
      aria-hidden={!open}
    >
      {stop && index != null && (
        <div className="flex h-full flex-col p-6 md:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <span className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white">
                {index + 1}
              </span>
              <span className="text-sm text-zinc-400">
                Stop {index + 1} of {total}
              </span>
            </span>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight">{stop.place.name}</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {stop.place.place_types.join(" · ")}
          </p>

          <dl className="mt-6 flex gap-8">
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-400">Arrive</dt>
              <dd className="mt-1 text-lg font-medium tabular-nums">{stop.arrivalTime}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-zinc-400">Stay</dt>
              <dd className="mt-1 text-lg font-medium tabular-nums">
                {stop.durationMinutes} min
              </dd>
            </div>
            {stop.travelToNextMinutes > 0 && (
              <div>
                <dt className="text-xs uppercase tracking-wide text-zinc-400">To next</dt>
                <dd className="mt-1 text-lg font-medium tabular-nums">
                  {stop.travelToNextMinutes} min
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-6 rounded-2xl bg-zinc-50 p-5">
            <p className="text-xs uppercase tracking-wide text-zinc-400">Why it fits</p>
            <p className="mt-2 leading-relaxed text-zinc-700">{stop.whyItFits}</p>
          </div>

          <p className="mt-6 text-sm leading-relaxed text-zinc-500">
            {stop.place.description}
          </p>

          <Link
            href={`/place/${stop.place.id}`}
            className="mt-6 inline-block text-sm font-medium text-zinc-900 underline"
          >
            Reviews &amp; details →
          </Link>
        </div>
      )}
    </div>
  );
}
