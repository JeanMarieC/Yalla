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
    .select("title, vibe, city, itinerary")
    .eq("id", id)
    .maybeSingle();

  if (!trip) notFound();

  const itinerary = trip.itinerary as ItineraryStop[];

  return (
    <TripView
      itinerary={itinerary}
      vibe={trip.vibe}
      city={trip.city ?? undefined}
      title={trip.title}
      actions={
        <>
          <Link
            href={`/lobby/${id}`}
            className="rounded-full bg-stone-900 px-3 py-1.5 text-sm text-white transition hover:bg-stone-700"
          >
            Open lobby
          </Link>
          <Link
            href="/trips"
            className="rounded-full border border-stone-200 bg-white/80 px-3 py-1.5 text-sm transition hover:bg-stone-50"
          >
            My Trips
          </Link>
        </>
      }
    />
  );
}
