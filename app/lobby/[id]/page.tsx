// Phase 9 — Lobby page. Requires login. JOINS first (insert participant), which
// is what unlocks the participant RLS policy so we can then read the shared trip.
// The trip's UUID is the share token.

import { redirect, notFound } from "next/navigation";
import LobbyRoom from "@/components/LobbyRoom";
import { createClient } from "@/lib/supabase-server";
import type { ItineraryStop } from "@/lib/ai/planDay";

export default async function LobbyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/lobby/${id}`);

  // Join the lobby (idempotent). This must happen BEFORE the read, because the
  // participant policy is what grants read access to the shared trip.
  await supabase
    .from("lobby_participants")
    .upsert(
      { trip_id: id, user_id: user.id },
      { onConflict: "trip_id,user_id", ignoreDuplicates: true },
    );

  const { data: trip } = await supabase
    .from("trips")
    .select("id, title, vibe, itinerary, last_change_note")
    .eq("id", id)
    .maybeSingle();
  if (!trip) notFound();

  return (
    <LobbyRoom
      tripId={trip.id}
      title={trip.title}
      vibe={trip.vibe}
      initialItinerary={trip.itinerary as ItineraryStop[]}
      initialNote={trip.last_change_note}
      me={{ id: user.id, email: user.email ?? "" }}
    />
  );
}
