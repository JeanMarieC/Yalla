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
  loading: () => <div className="h-full w-full bg-stone-100" />,
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
    return <p className="mt-4 text-sm text-stone-500">Finding where to go…</p>;
  }
  if (error) {
    return <p className="mt-4 text-sm text-red-500">{error}</p>;
  }
  if (!destinations || destinations.length === 0) {
    return <p className="mt-4 text-sm text-stone-500">No destinations matched.</p>;
  }

  return (
    <div className="mt-4">
      <div className="h-56 overflow-hidden rounded-2xl border border-stone-200">
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
              i === selected ? "border-stone-400 bg-stone-50" : "border-stone-200"
            }`}
            onMouseEnter={() => setSelected(i)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">
                  <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-stone-900 text-xs text-white">
                    {i + 1}
                  </span>
                  {d.name}
                  <span className="text-stone-400"> · {d.country}</span>
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
                  {d.description}
                </p>
                <p className="mt-1.5 text-xs text-stone-400">{d.tags.join(" · ")}</p>
              </div>
              {d.in_season && (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                  in season
                </span>
              )}
            </div>
            <button
              onClick={() => onPick(d.name)}
              className="mt-3 rounded-full bg-stone-900 px-4 py-1.5 text-sm text-white transition hover:bg-stone-700"
            >
              Plan days here →
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
