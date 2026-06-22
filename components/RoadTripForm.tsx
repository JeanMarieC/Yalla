"use client";

// Phase 10 (Part 1) — Road-trip inputs: where you start + the event you're
// driving to (the fixed anchor). Coordinates as lat/lng for v1.

import { useState } from "react";

export interface RoadTripFormValues {
  vibe: string;
  start: { lat: number; lng: number };
  event: { name: string; lat: number; lng: number; time: string };
  budgetHours: number;
}

interface RoadTripFormProps {
  onSubmit: (values: RoadTripFormValues) => void;
  loading?: boolean;
  error?: string | null;
}

const BUDGETS = [4, 6, 8, 10, 12];

export default function RoadTripForm({ onSubmit, loading, error }: RoadTripFormProps) {
  const [vibe, setVibe] = useState("");
  const [startLat, setStartLat] = useState("");
  const [startLng, setStartLng] = useState("");
  const [eventName, setEventName] = useState("");
  const [eventLat, setEventLat] = useState("");
  const [eventLng, setEventLng] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [budgetHours, setBudgetHours] = useState(8);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    onSubmit({
      vibe: vibe.trim(),
      start: { lat: Number(startLat), lng: Number(startLng) },
      event: {
        name: eventName.trim(),
        lat: Number(eventLat),
        lng: Number(eventLng),
        time: eventTime ? new Date(eventTime).toISOString() : "",
      },
      budgetHours,
    });
  }

  const input =
    "w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 outline-none transition focus:border-stone-400";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-2 block text-sm font-medium text-stone-600">The vibe of the drive</label>
        <textarea
          value={vibe}
          onChange={(e) => setVibe(e.target.value)}
          rows={2}
          required
          placeholder="scenic coast, vinyl stops, hidden bakeries on the way…"
          className={`${input} resize-none text-lg`}
        />
      </div>

      <fieldset className="rounded-2xl border border-stone-200 p-4">
        <legend className="px-2 text-sm font-medium text-stone-600">Start from</legend>
        <div className="grid grid-cols-2 gap-3">
          <input required type="number" step="any" placeholder="Latitude" value={startLat} onChange={(e) => setStartLat(e.target.value)} className={input} />
          <input required type="number" step="any" placeholder="Longitude" value={startLng} onChange={(e) => setStartLng(e.target.value)} className={input} />
        </div>
      </fieldset>

      <fieldset className="rounded-2xl border border-stone-200 p-4">
        <legend className="px-2 text-sm font-medium text-stone-600">The event (your anchor)</legend>
        <input required placeholder="Event name" value={eventName} onChange={(e) => setEventName(e.target.value)} className={`${input} mb-3`} />
        <div className="grid grid-cols-2 gap-3">
          <input required type="number" step="any" placeholder="Latitude" value={eventLat} onChange={(e) => setEventLat(e.target.value)} className={input} />
          <input required type="number" step="any" placeholder="Longitude" value={eventLng} onChange={(e) => setEventLng(e.target.value)} className={input} />
        </div>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm text-stone-600">Arrive by</span>
          <input required type="datetime-local" value={eventTime} onChange={(e) => setEventTime(e.target.value)} className={input} />
        </label>
      </fieldset>

      <label className="block">
        <span className="mb-1 block text-sm text-stone-600">Max trip length</span>
        <select value={budgetHours} onChange={(e) => setBudgetHours(Number(e.target.value))} className={input}>
          {BUDGETS.map((h) => (
            <option key={h} value={h}>{h} hours</option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-full bg-stone-900 px-6 py-4 text-base font-medium text-white transition hover:bg-stone-700 disabled:opacity-40"
      >
        {loading ? "Planning the drive…" : "Plan the road trip"}
      </button>
      {error && <p className="text-center text-sm text-red-500">{error}</p>}
    </form>
  );
}
