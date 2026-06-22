// Phase 8 — Place detail. Server component: shows the place, its CACHED AI
// review summary (never regenerated here), and the reviews. Logged-in users get
// a review form. Public read via RLS.

import { notFound } from "next/navigation";
import Link from "next/link";
import TopNav from "@/components/TopNav";
import ReviewForm from "@/components/ReviewForm";
import { createClient } from "@/lib/supabase-server";

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-amber-400" aria-label={`${rating} of 5`}>
      {"★".repeat(rating)}
      <span className="text-zinc-300">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export default async function PlaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: place } = await supabase
    .from("places")
    .select("id, name, description, city, country, place_types, review_summary")
    .eq("id", id)
    .maybeSingle();
  if (!place) notFound();

  const { data: reviews } = await supabase
    .from("reviews")
    .select("id, rating, body, created_at, user_id")
    .eq("place_id", id)
    .order("created_at", { ascending: false });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const myReview = user
    ? reviews?.find((r) => r.user_id === user.id) ?? null
    : null;

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <TopNav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8">
        <h1 className="text-3xl font-semibold tracking-tight">{place.name}</h1>
        <p className="mt-1 text-zinc-500">
          {place.place_types.join(" · ")} · {place.city}
        </p>

        {place.review_summary && (
          <div className="mt-6 rounded-2xl bg-amber-50 p-5">
            <p className="text-xs uppercase tracking-wide text-amber-600">
              What people say
            </p>
            <p className="mt-1 leading-relaxed text-zinc-800">
              {place.review_summary}
            </p>
          </div>
        )}

        <p className="mt-6 leading-relaxed text-zinc-600">{place.description}</p>

        <section className="mt-10">
          <h2 className="text-lg font-semibold">
            Reviews{reviews?.length ? ` (${reviews.length})` : ""}
          </h2>

          <div className="mt-4">
            {user ? (
              <ReviewForm placeId={place.id} existing={myReview} />
            ) : (
              <p className="text-sm text-zinc-500">
                <Link href="/login" className="font-medium text-zinc-900 underline">
                  Log in
                </Link>{" "}
                to leave a review.
              </p>
            )}
          </div>

          <ul className="mt-6 space-y-4">
            {(reviews ?? [])
              .filter((r) => r.id !== myReview?.id)
              .map((r) => (
                <li key={r.id} className="rounded-2xl border border-zinc-100 p-4">
                  <Stars rating={r.rating} />
                  {r.body && (
                    <p className="mt-2 leading-relaxed text-zinc-700">{r.body}</p>
                  )}
                  <p className="mt-2 text-xs text-zinc-400">
                    {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </li>
              ))}
            {(reviews?.length ?? 0) === 0 && (
              <li className="text-sm text-zinc-500">
                No reviews yet — be the first.
              </li>
            )}
          </ul>
        </section>

        <Link
          href="/"
          className="mt-10 inline-block text-sm text-zinc-500 underline transition hover:text-zinc-800"
        >
          ← Back home
        </Link>
      </main>
    </div>
  );
}
