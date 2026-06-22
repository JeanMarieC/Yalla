"use client";

// Phase 7 — Submit a community event. Requires login. The description is
// embedded server-side (same model as places) so it ranks in the Pulse.

import { useState } from "react";
import Link from "next/link";
import TopNav from "@/components/TopNav";
import { useUser } from "@/lib/useUser";

const CITIES = ["Beirut", "Paris", "Lisbon"];

export default function NewEventPage() {
  const { user, loading } = useUser();
  const [form, setForm] = useState({
    name: "",
    description: "",
    city: "Beirut",
    lat: "",
    lng: "",
    start: "",
    end: "",
    tags: "",
  });
  const [status, setStatus] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("saving");
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          city: form.city,
          lat: Number(form.lat),
          lng: Number(form.lng),
          // datetime-local is local time; toISOString stores UTC.
          startTime: form.start ? new Date(form.start).toISOString() : "",
          endTime: form.end ? new Date(form.end).toISOString() : "",
          tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save.");
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      setStatus("idle");
    }
  }

  const input =
    "w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 outline-none transition focus:border-zinc-400";

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <TopNav />
      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-8">
        <h1 className="text-3xl font-semibold tracking-tight">Add an event</h1>
        <p className="mt-2 text-zinc-500">
          Share something happening this week. It&apos;ll show up in the Pulse.
        </p>

        {!loading && !user ? (
          <p className="mt-8 text-zinc-600">
            Please{" "}
            <Link href="/login" className="font-medium text-zinc-900 underline">
              log in
            </Link>{" "}
            to add an event.
          </p>
        ) : status === "done" ? (
          <div className="mt-8 rounded-2xl border border-zinc-200 p-6">
            <p className="text-zinc-700">Event added — flip on the Pulse to see it.</p>
            <Link
              href="/"
              className="mt-4 inline-block rounded-full bg-zinc-900 px-5 py-2.5 text-sm text-white transition hover:bg-zinc-700"
            >
              Back home
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <input
              required
              placeholder="Event name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className={input}
            />
            <textarea
              required
              rows={3}
              placeholder="Describe the vibe of the event…"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className={`${input} resize-none`}
            />
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="mb-1 block text-sm text-zinc-600">City</span>
                <select
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                  className={input}
                >
                  {CITIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-zinc-600">Tags (comma-sep)</span>
                <input
                  placeholder="music, bar, night"
                  value={form.tags}
                  onChange={(e) => set("tags", e.target.value)}
                  className={input}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-zinc-600">Latitude</span>
                <input
                  required
                  type="number"
                  step="any"
                  placeholder="33.8995"
                  value={form.lat}
                  onChange={(e) => set("lat", e.target.value)}
                  className={input}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-zinc-600">Longitude</span>
                <input
                  required
                  type="number"
                  step="any"
                  placeholder="35.5231"
                  value={form.lng}
                  onChange={(e) => set("lng", e.target.value)}
                  className={input}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-zinc-600">Starts</span>
                <input
                  required
                  type="datetime-local"
                  value={form.start}
                  onChange={(e) => set("start", e.target.value)}
                  className={input}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-zinc-600">Ends</span>
                <input
                  required
                  type="datetime-local"
                  value={form.end}
                  onChange={(e) => set("end", e.target.value)}
                  className={input}
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={status === "saving"}
              className="w-full rounded-full bg-zinc-900 px-6 py-3 font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40"
            >
              {status === "saving" ? "Saving…" : "Add event"}
            </button>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </form>
        )}
      </main>
    </div>
  );
}
