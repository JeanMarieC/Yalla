"use client";

// Phase 6 — Minimal top-right auth nav. Logged in: My Trips + Log out.
// Logged out: Log in + Sign up. Used on the home form view and list pages
// (not on the full-screen map, which has its own controls).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import { useUser } from "@/lib/useUser";

export default function TopNav() {
  const { user, loading } = useUser();
  const router = useRouter();

  async function logout() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="flex flex-wrap items-center justify-end gap-x-1 gap-y-2 px-4 py-4 text-sm sm:px-6">
      {loading ? null : user ? (
        <>
          <Link
            href="/place/new"
            className="rounded-full px-4 py-2 transition hover:bg-stone-100"
          >
            Add place
          </Link>
          <Link
            href="/events/new"
            className="rounded-full px-4 py-2 transition hover:bg-stone-100"
          >
            Add event
          </Link>
          <Link
            href="/trips"
            className="rounded-full px-4 py-2 transition hover:bg-stone-100"
          >
            My Trips
          </Link>
          <button
            onClick={logout}
            className="rounded-full px-4 py-2 transition hover:bg-stone-100"
          >
            Log out
          </button>
        </>
      ) : (
        <>
          <Link
            href="/login"
            className="rounded-full px-4 py-2 transition hover:bg-stone-100"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-stone-900 px-4 py-2 text-white transition hover:bg-stone-700"
          >
            Sign up
          </Link>
        </>
      )}
    </nav>
  );
}
