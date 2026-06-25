// Phase 6 — My Trips. Server component: requires a session (redirect to /login
// otherwise). RLS means the select only ever returns this user's own trips.

import { redirect } from "next/navigation";
import Link from "next/link";
import TopNav from "@/components/TopNav";
import { createClient } from "@/lib/supabase-server";

export default async function TripsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: trips } = await supabase
    .from("trips")
    .select("id, title, vibe, city, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <TopNav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        <p className="yalla-eyebrow mb-2">Saved days</p>
        <h1 className="font-display text-4xl font-normal tracking-tight text-ink">My Trips</h1>

        {!trips || trips.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-[#D7CDBA] p-10 text-center">
            <p className="font-display text-xl text-ink">No trips yet</p>
            <p className="mt-1 text-sm text-muted">Your saved days will live here.</p>
            <Link href="/" className="btn-primary mt-5 inline-flex px-5 py-2.5 text-sm">
              Plan your first day
            </Link>
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {trips.map((trip) => (
              <li key={trip.id}>
                <Link
                  href={`/trip/${trip.id}`}
                  className="block rounded-2xl border border-hairline bg-surface px-5 py-4 transition hover:bg-paper/60"
                >
                  <p className="font-display text-lg text-ink">{trip.title}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {trip.city ? `${trip.city} · ` : ""}
                    {new Date(trip.created_at).toLocaleDateString()}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
