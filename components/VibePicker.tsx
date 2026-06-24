"use client";

// Phase 5 — Home input. Mood-first: the vibe is the hero, the rest is quiet.
// Pure UI; it just collects values and hands them up via onSubmit.

import { useState } from "react";

export interface VibeFormValues {
  vibe: string;
  city: string; // "" = anywhere
  startTime: string; // "HH:MM"
  timeBudget: number; // hours
}

interface VibePickerProps {
  onSubmit: (values: VibeFormValues) => void;
  loading?: boolean;
  error?: string | null;
  noResults?: boolean;
}

const CITIES = ["Beirut", "Paris", "Lisbon"];
const BUDGETS = [4, 6, 8, 10];

export default function VibePicker({
  onSubmit,
  loading = false,
  error,
  noResults = false,
}: VibePickerProps) {
  const [vibe, setVibe] = useState("");
  const [city, setCity] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [timeBudget, setTimeBudget] = useState(8);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vibe.trim() || loading) return;
    onSubmit({ vibe: vibe.trim(), city, startTime, timeBudget });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="vibe"
              className="mb-2 block text-sm font-medium text-stone-600"
            >
              What&apos;s the mood?
            </label>
            <textarea
              id="vibe"
              value={vibe}
              onChange={(e) => setVibe(e.target.value)}
              rows={3}
              autoFocus
              placeholder="moody coastal, vinyl bars, hidden bakeries…"
              className="w-full resize-none rounded-2xl border border-stone-200 bg-white px-5 py-4 text-lg leading-relaxed shadow-sm outline-none transition focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="City">
              <input
                list="yalla-cities"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Anywhere"
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 outline-none transition focus:border-stone-400"
              />
              <datalist id="yalla-cities">
                {CITIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>

            <Field label="Start">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 outline-none transition focus:border-stone-400"
              />
            </Field>

            <Field label="Hours">
              <select
                value={timeBudget}
                onChange={(e) => setTimeBudget(Number(e.target.value))}
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 outline-none transition focus:border-stone-400"
              >
                {BUDGETS.map((h) => (
                  <option key={h} value={h}>
                    {h} hours
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <button
            type="submit"
            disabled={loading || !vibe.trim()}
            className="w-full rounded-full bg-stone-900 px-6 py-4 text-base font-medium text-white transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Planning your day…" : "Plan my day"}
          </button>

          {error && <p className="text-center text-sm text-red-500">{error}</p>}
          {noResults && !error && (
            <p className="text-center text-sm text-stone-500">
              Nothing matched that vibe yet — try another mood or city.
            </p>
          )}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-stone-600">{label}</span>
      {children}
    </label>
  );
}
