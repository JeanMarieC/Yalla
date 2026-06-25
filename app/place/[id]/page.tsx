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
    <span className="text-terracotta" aria-label={`${rating} of 5`}>
      {"★".repeat(rating)}
      <span className="text-[#D7CDBA]">{"★".repeat(5 - rating)}</span>
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
        <h1 className="font-display text-4xl font-normal tracking-tight text-ink">{place.name}</h1>
        <p className="mt-1 text-muted">
          {place.place_types.join(" · ")} · {place.city}
        </p>

        {place.review_summary && (
          <div className="mt-6 rounded-2xl border border-terracotta-tint-border bg-terracotta-tint p-5">
            <p className="yalla-eyebrow text-[9.5px]">What people say</p>
            <p className="mt-1.5 font-display text-[15px] italic leading-relaxed text-[#7A4632]">
              {place.review_summary}
            </p>
          </div>
        )}

        <p className="mt-6 leading-relaxed text-ink-soft">{place.description}</p>

        <section className="mt-10">
          <h2 className="font-display text-2xl text-ink">
            Reviews{reviews?.length ? ` (${reviews.length})` : ""}
          </h2>

          <div className="mt-4">
            {user ? (
              <ReviewForm placeId={place.id} existing={myReview} />
            ) : (
              <p className="text-sm text-muted">
                <Link href="/login" className="font-semibold text-terracotta-deep">
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
                <li key={r.id} className="rounded-2xl border border-hairline bg-surface p-4">
                  <Stars rating={r.rating} />
                  {r.body && (
                    <p className="mt-2 leading-relaxed text-ink-soft">{r.body}</p>
                  )}
                  <p className="mt-2 text-xs text-faint">
                    {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </li>
              ))}
            {(reviews?.length ?? 0) === 0 && (
              <li className="text-sm text-muted">
                No reviews yet — be the first.
              </li>
            )}
          </ul>
        </section>

        <Link
          href="/"
          className="mt-10 inline-block text-sm text-muted underline transition hover:text-ink"
        >
          ← Back home
        </Link>
      </main>
    </div>
  );
}
