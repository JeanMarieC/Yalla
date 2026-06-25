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
      {stop && index != null && (
        <div className="flex h-full flex-col p-6 pb-8 md:p-8">
          <div className="mx-auto mb-5 h-1 w-10 shrink-0 rounded-full bg-[#D7CDBA] md:hidden" />
          <div className="mb-4 flex items-start justify-between gap-4">
            <span className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 -rotate-45 items-center justify-center rounded-[999px_999px_999px_3px] bg-terracotta">
                <span className="rotate-45 text-[11px] font-bold text-white">{index + 1}</span>
              </span>
              <span className="yalla-eyebrow">
                Stop {index + 1} of {total}
              </span>
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

          <h2 className="font-display text-2xl tracking-tight text-ink md:text-3xl">
            {stop.place.name}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {stop.place.place_types.join(" · ")}
          </p>

          <div className="mt-5 flex gap-2.5">
            <Stat label="Arrive" value={stop.arrivalTime} />
            <Stat label="Stay" value={`${stop.durationMinutes} min`} />
            {stop.travelToNextMinutes > 0 && (
              <Stat label="To next" value={`${stop.travelToNextMinutes} min`} />
            )}
          </div>

          <div className="mt-5 rounded-2xl border border-terracotta-tint-border bg-terracotta-tint p-4">
            <p className="yalla-eyebrow text-[9.5px]">Why this fits you</p>
            <p className="mt-1.5 font-display text-[15px] italic leading-relaxed text-[#7A4632]">
              {stop.whyItFits}
            </p>
          </div>

          <p className="mt-5 text-sm leading-relaxed text-ink-soft">
            {stop.place.description}
          </p>

          <Link
            href={`/place/${stop.place.id}`}
            className="mt-6 inline-block text-sm font-semibold text-terracotta-deep underline underline-offset-[3px]"
          >
            Reviews &amp; details →
          </Link>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-xl border border-hairline bg-white px-3 py-2.5">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="mt-0.5 text-[15px] font-bold tabular-nums text-ink">{value}</div>
    </div>
  );
}
