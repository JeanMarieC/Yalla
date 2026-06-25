"use client";

// Phase 12 — "Where do I go?" Given a brief, fetches ranked destinations and
// shows them as a world map of pins + cards. Pick one to plan days there.

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { TripBrief } from "@/lib/ai/interpretBrief";
import type { DestinationMatch } from "@/lib/destinations";
import type { MapPoint } from "@/components/Map";

const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-canvas" />,
});

interface DestinationFinderProps {
  brief: TripBrief;
  onPick: (name: string) => void;
}

export default function DestinationFinder({ brief, onPick }: DestinationFinderProps) {
  const [destinations, setDestinations] = useState<DestinationMatch[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const month = brief.timeframe.start
    ? new Date(brief.timeframe.start).getMonth() + 1
    : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/destinations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brief: brief.raw, month }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Couldn't find destinations.");
        if (!cancelled) setDestinations(data.destinations ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't find destinations.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [brief.raw, month]);

  const points: MapPoint[] = useMemo(
    () => (destinations ?? []).map((d) => ({ lng: d.lng, lat: d.lat })),
    [destinations],
  );

  if (loading) {
    return <p className="mt-4 text-sm text-muted">Finding where to go…</p>;
  }
  if (error) {
    return <p className="mt-4 text-sm text-terracotta-deep">{error}</p>;
  }
  if (!destinations || destinations.length === 0) {
    return <p className="mt-4 text-sm text-muted">No destinations matched.</p>;
  }

  return (
    <div className="mt-5">
      <div className="mb-1.5 yalla-eyebrow">Where we&apos;d send you</div>
      <div className="h-56 overflow-hidden rounded-2xl border border-hairline">
        <Map
          points={points}
          selectedIndex={selected}
          onSelectPoint={setSelected}
          showRoute={false}
          variant="stop"
        />
      </div>

      <ul className="mt-4 space-y-3">
        {destinations.map((d, i) => (
          <li
            key={d.id}
            className={`rounded-2xl border p-4 transition ${
              i === selected
                ? "border-terracotta-tint-border bg-terracotta-tint/50"
                : "border-hairline bg-surface"
            }`}
            onMouseEnter={() => setSelected(i)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 -rotate-45 items-center justify-center rounded-[999px_999px_999px_3px] bg-ink">
                    <span className="rotate-45 text-[11px] font-bold text-paper">{i + 1}</span>
                  </span>
                  <span className="font-display text-xl text-ink">{d.name}</span>
                  <span className="text-sm text-muted">· {d.country}</span>
                </p>
                <p className="mt-1.5 font-display text-[14.5px] italic leading-relaxed text-ink-soft">
                  {d.description}
                </p>
                <p className="mt-2 flex flex-wrap gap-1.5">
                  {d.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-paper px-2.5 py-1 text-[11.5px] text-ink-soft"
                    >
                      {t}
                    </span>
                  ))}
                </p>
              </div>
              {d.in_season && (
                <span className="shrink-0 rounded-full bg-sage-tint px-2 py-1 text-[10.5px] font-bold uppercase tracking-wide text-sage-deep">
                  In season
                </span>
              )}
            </div>
            <button
              onClick={() => onPick(d.name)}
              className="btn-primary mt-3 px-4 py-1.5 text-sm"
            >
              Plan days here →
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
