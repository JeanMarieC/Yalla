"use client";

// Phase 6 — Save the current itinerary. Shown only when logged in (the parent
// gates on auth). POSTs to /api/trips, then goes to the trip's permanent URL.

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ItineraryStop } from "@/lib/ai/planDay";

interface SaveTripButtonProps {
  vibe: string;
  city: string;
  itinerary: ItineraryStop[];
  startTime: string;
  timeBudget: number;
}

export default function SaveTripButton({
  vibe,
  city,
  itinerary,
  startTime,
  timeBudget,
}: SaveTripButtonProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const title = city ? `${vibe} · ${city}` : vibe;
      const res = await fetch("/api/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, vibe, city, itinerary, startTime, timeBudget }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save.");
      router.push(`/trip/${data.id}`); // permanent id
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      setSaving(false);
    }
  }

  return (
    <button
      onClick={save}
      disabled={saving}
      title={error ?? undefined}
      className="btn-primary px-4 py-1.5 text-sm"
    >
      {saving ? "Saving…" : error ? "Retry save" : "Save trip"}
    </button>
  );
}
