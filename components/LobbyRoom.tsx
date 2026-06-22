"use client";

// Phase 9 — The lobby room. Combines all three passes:
//  Pass 1: Realtime PRESENCE -> avatars of who's here now.
//  Pass 2: shared VOTES synced via Realtime postgres_changes -> live tallies +
//          each voter's avatar floating by the stop they voted on.
//  Pass 3: when a stop crosses the downvote threshold, ask the server agent to
//          re-plan; the new itinerary arrives via Realtime on the trips row.

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { identityFor } from "@/lib/identity";
import type { ItineraryStop } from "@/lib/ai/planDay";

const DOWNVOTE_THRESHOLD = 2; // downvotes that trigger a re-plan

interface Vote {
  stop_id: string;
  user_id: string;
  vote: "up" | "down";
}
interface Present {
  user_id: string;
  email: string;
}
interface LobbyRoomProps {
  tripId: string;
  title: string;
  vibe: string;
  initialItinerary: ItineraryStop[];
  initialNote: string | null;
  me: { id: string; email: string };
}

function Avatar({
  userId,
  email,
  size = 28,
  ring,
}: {
  userId: string;
  email?: string | null;
  size?: number;
  ring?: string;
}) {
  const { initial, color } = identityFor(userId, email);
  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        background: color,
        fontSize: size * 0.42,
        boxShadow: ring ? `0 0 0 2px ${ring}` : undefined,
      }}
      title={email ?? userId}
    >
      {initial}
    </span>
  );
}

export default function LobbyRoom({
  tripId,
  title,
  vibe,
  initialItinerary,
  initialNote,
  me,
}: LobbyRoomProps) {
  const [itinerary, setItinerary] = useState(initialItinerary);
  const [note, setNote] = useState(initialNote);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [present, setPresent] = useState<Present[]>([]);
  const [replanning, setReplanning] = useState(false);
  const [copied, setCopied] = useState(false);

  const refetchVotes = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("votes")
      .select("stop_id, user_id, vote")
      .eq("lobby_id", tripId);
    setVotes((data as Vote[]) ?? []);
  }, [tripId]);

  // Presence (Pass 1) + DB changes for votes & itinerary (Pass 2/3).
  useEffect(() => {
    const supabase = createClient();
    refetchVotes();

    const presence = supabase.channel(`presence:${tripId}`, {
      config: { presence: { key: me.id } },
    });
    presence
      .on("presence", { event: "sync" }, () => {
        const state = presence.presenceState<{ user_id: string; email: string }>();
        const people = Object.values(state)
          .flat()
          .map((p) => ({ user_id: p.user_id, email: p.email }));
        // de-dupe by user_id (multiple tabs)
        const seen = new Map(people.map((p) => [p.user_id, p]));
        setPresent([...seen.values()]);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presence.track({ user_id: me.id, email: me.email });
        }
      });

    const db = supabase
      .channel(`db:${tripId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes", filter: `lobby_id=eq.${tripId}` },
        () => refetchVotes(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "trips", filter: `id=eq.${tripId}` },
        (payload) => {
          const row = payload.new as { itinerary: ItineraryStop[]; last_change_note: string | null };
          setItinerary(row.itinerary);
          setNote(row.last_change_note);
          setReplanning(false);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(presence);
      supabase.removeChannel(db);
    };
  }, [tripId, me.id, me.email, refetchVotes]);

  async function castVote(stopId: string, dir: "up" | "down") {
    const supabase = createClient();
    // Optimistic local update.
    setVotes((prev) => {
      const rest = prev.filter((v) => !(v.stop_id === stopId && v.user_id === me.id));
      return [...rest, { stop_id: stopId, user_id: me.id, vote: dir }];
    });
    await supabase
      .from("votes")
      .upsert(
        { lobby_id: tripId, stop_id: stopId, user_id: me.id, vote: dir },
        { onConflict: "lobby_id,user_id,stop_id" },
      );

    // Threshold check (server re-counts authoritatively before acting).
    const downs =
      votes.filter((v) => v.stop_id === stopId && v.vote === "down" && v.user_id !== me.id).length +
      (dir === "down" ? 1 : 0);
    if (downs >= DOWNVOTE_THRESHOLD) {
      setReplanning(true);
      try {
        await fetch("/api/replan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tripId, stopId }),
        });
      } catch {
        setReplanning(false);
      }
    }
  }

  const myVote = (stopId: string) =>
    votes.find((v) => v.stop_id === stopId && v.user_id === me.id)?.vote ?? null;
  const tally = (stopId: string, dir: "up" | "down") =>
    votes.filter((v) => v.stop_id === stopId && v.vote === dir).length;
  const votersFor = (stopId: string) =>
    votes.filter((v) => v.stop_id === stopId);

  const emailById = new Map(present.map((p) => [p.user_id, p.email]));

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-stone-500">&ldquo;{vibe}&rdquo;</p>
        </div>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(window.location.href);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 rounded-full border border-stone-200 px-4 py-2 text-sm transition hover:bg-stone-50"
        >
          {copied ? "Link copied" : "Share"}
        </button>
      </div>

      {/* Presence (Pass 1) */}
      <div className="mt-4 flex items-center gap-2">
        <span className="text-sm text-stone-400">Here now</span>
        <div className="flex -space-x-2">
          {present.map((p) => (
            <Avatar key={p.user_id} userId={p.user_id} email={p.email} ring="#fff" />
          ))}
        </div>
      </div>

      {/* Re-plan status / change note (Pass 3) */}
      {replanning && (
        <div className="mt-6 rounded-2xl bg-amber-50 px-5 py-3 text-sm text-amber-700">
          A stop was voted out — reshaping the day…
        </div>
      )}
      {note && !replanning && (
        <div className="mt-6 rounded-2xl bg-stone-100 px-5 py-3 text-sm text-stone-700">
          {note}
        </div>
      )}

      {/* Shared itinerary with live voting (Pass 2) */}
      <ol className="mt-6 space-y-3">
        {itinerary.map((stop, i) => {
          const id = stop.place.id;
          const mine = myVote(id);
          return (
            <li key={id} className="rounded-2xl border border-stone-200 p-4">
              <div className="flex gap-4">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-semibold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-medium">{stop.place.name}</span>
                    <span className="shrink-0 text-sm tabular-nums text-stone-400">
                      {stop.arrivalTime}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-stone-500">
                    {stop.place.place_types.join(" · ")}
                  </p>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => castVote(id, "up")}
                      className={`rounded-full border px-3 py-1 text-sm transition ${
                        mine === "up"
                          ? "border-green-500 bg-green-50 text-green-700"
                          : "border-stone-200 hover:bg-stone-50"
                      }`}
                    >
                      ▲ {tally(id, "up")}
                    </button>
                    <button
                      onClick={() => castVote(id, "down")}
                      className={`rounded-full border px-3 py-1 text-sm transition ${
                        mine === "down"
                          ? "border-red-500 bg-red-50 text-red-700"
                          : "border-stone-200 hover:bg-stone-50"
                      }`}
                    >
                      ▼ {tally(id, "down")}
                    </button>

                    {/* Floating voter avatars (Pass 2) */}
                    <div className="ml-2 flex -space-x-1.5">
                      {votersFor(id).map((v) => (
                        <Avatar
                          key={v.user_id}
                          userId={v.user_id}
                          email={emailById.get(v.user_id)}
                          size={22}
                          ring={v.vote === "up" ? "#22c55e" : "#ef4444"}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </main>
  );
}
