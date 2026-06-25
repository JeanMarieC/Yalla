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
          <Link href={`/lobby/${id}`} className="btn-primary px-4 py-1.5 text-sm">
            Open lobby
          </Link>
          <Link href="/trips" className="btn-ghost px-4 py-1.5 text-sm">
            My Trips
          </Link>
        </>
      }
    />
  );
}
