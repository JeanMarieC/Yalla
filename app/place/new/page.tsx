"use client";

// Phase 8 — Submit a community place. Requires login. The description is
// embedded server-side (same model) so the place immediately enters matching.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TopNav from "@/components/TopNav";
import { useUser } from "@/lib/useUser";

export default function NewPlacePage() {
  const { user, loading } = useUser();
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    description: "",
    city: "",
    lat: "",
    lng: "",
    types: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          city: form.city,
          lat: Number(form.lat),
          lng: Number(form.lng),
          place_types: form.types.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save.");
      router.push(`/place/${data.id}`); // straight to its detail page
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 outline-none transition focus:border-stone-400";

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <TopNav />
      <main className="mx-auto w-full max-w-xl flex-1 px-6 py-8">
        <h1 className="text-3xl font-semibold tracking-tight">Add a place</h1>
        <p className="mt-2 text-stone-500">
          Know a spot worth visiting? Add it to the catalog.
        </p>

        {!loading && !user ? (
          <p className="mt-8 text-stone-600">
            Please{" "}
            <Link href="/login" className="font-medium text-stone-900 underline">
              log in
            </Link>{" "}
            to add a place.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <input
              required
              placeholder="Place name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className={input}
            />
            <textarea
              required
              rows={3}
              placeholder="Describe its character and vibe…"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className={`${input} resize-none`}
            />
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="mb-1 block text-sm text-stone-600">City</span>
                <input
                  required
                  placeholder="Beirut"
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                  className={input}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-stone-600">Types (comma-sep)</span>
                <input
                  placeholder="wine bar, bar"
                  value={form.types}
                  onChange={(e) => set("types", e.target.value)}
                  className={input}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-stone-600">Latitude</span>
                <input
                  required
                  type="number"
                  step="any"
                  placeholder="33.8989"
                  value={form.lat}
                  onChange={(e) => set("lat", e.target.value)}
                  className={input}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm text-stone-600">Longitude</span>
                <input
                  required
                  type="number"
                  step="any"
                  placeholder="35.5219"
                  value={form.lng}
                  onChange={(e) => set("lng", e.target.value)}
                  className={input}
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-full bg-stone-900 px-6 py-3 font-medium text-white transition hover:bg-stone-700 disabled:opacity-40"
            >
              {busy ? "Saving…" : "Add place"}
            </button>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </form>
        )}
      </main>
    </div>
  );
}
