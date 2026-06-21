// Phase 6 — A saved trip on the map. Server component: it loads the trip with
// the session-aware client, so RLS only returns it if the logged-in user owns
// it (otherwise no row -> notFound). Reuses the Phase 5 map via TripView.

import { notFound } from "next/navigation";
import Link from "next/link";
import TripView from "@/components/TripView";
import { createClient } from "@/lib/supabase-server";
import type { ItineraryStop } from "@/lib/ai/planDay";

export default async function TripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: trip } = await supabase
    .from("trips")
    .select("title, vibe, itinerary")
    .eq("id", id)
    .maybeSingle();

  if (!trip) notFound();

  const itinerary = trip.itinerary as ItineraryStop[];

  return (
    <TripView
      itinerary={itinerary}
      vibe={trip.vibe}
      title={trip.title}
      actions={
        <Link
          href="/trips"
          className="rounded-full border border-zinc-200 bg-white/80 px-3 py-1.5 text-sm transition hover:bg-zinc-50"
        >
          My Trips
        </Link>
      }
    />
  );
}
