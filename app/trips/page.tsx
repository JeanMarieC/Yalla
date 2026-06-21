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
        <h1 className="text-3xl font-semibold tracking-tight">My Trips</h1>

        {!trips || trips.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-zinc-200 p-10 text-center">
            <p className="text-zinc-500">No saved trips yet.</p>
            <Link
              href="/"
              className="mt-4 inline-block rounded-full bg-zinc-900 px-5 py-2.5 text-sm text-white transition hover:bg-zinc-700"
            >
              Plan a day
            </Link>
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {trips.map((trip) => (
              <li key={trip.id}>
                <Link
                  href={`/trip/${trip.id}`}
                  className="block rounded-2xl border border-zinc-200 px-5 py-4 transition hover:bg-zinc-50"
                >
                  <p className="font-medium text-zinc-900">{trip.title}</p>
                  <p className="mt-1 text-sm text-zinc-500">
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
