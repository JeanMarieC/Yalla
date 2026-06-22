"use client";

// Phase 8 — Leave / edit / remove your review for a place. On success it calls
// router.refresh() so the server re-fetches reviews AND the freshly recomputed
// AI summary.

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ReviewFormProps {
  placeId: string;
  existing?: { rating: number; body: string | null } | null;
}

export default function ReviewForm({ placeId, existing }: ReviewFormProps) {
  const router = useRouter();
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState(existing?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      setError("Pick a rating.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId, rating, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reviews?placeId=${placeId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not remove.");
      setRating(0);
      setBody("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-stone-200 p-5">
      <p className="text-sm font-medium text-stone-700">
        {existing ? "Your review" : "Leave a review"}
      </p>

      <div className="mt-3 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            className={`text-2xl leading-none transition ${
              n <= (hover || rating) ? "text-amber-400" : "text-stone-300"
            }`}
          >
            ★
          </button>
        ))}
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="What's it really like? (optional)"
        className="mt-3 w-full resize-none rounded-xl border border-stone-200 px-4 py-2.5 outline-none transition focus:border-stone-400"
      />

      <div className="mt-3 flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-stone-900 px-5 py-2 text-sm text-white transition hover:bg-stone-700 disabled:opacity-40"
        >
          {busy ? "Saving…" : existing ? "Update review" : "Post review"}
        </button>
        {existing && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="text-sm text-stone-500 underline transition hover:text-stone-800"
          >
            Remove
          </button>
        )}
        {error && <span className="text-sm text-red-500">{error}</span>}
      </div>
    </form>
  );
}
