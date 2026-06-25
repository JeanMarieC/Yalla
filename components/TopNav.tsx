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

  const linkCls =
    "rounded-full px-4 py-2 text-ink-soft transition hover:bg-paper hover:text-ink";

  return (
    <nav className="flex flex-wrap items-center gap-x-1 gap-y-2 px-4 py-4 text-sm sm:px-6">
      {/* Brand mark */}
      <Link href="/" className="mr-auto flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-ink font-display text-xl leading-none text-paper">
          y
        </span>
        <span className="font-display text-xl tracking-tight text-ink">Yalla</span>
      </Link>

      {loading ? null : user ? (
        <>
          <Link href="/place/new" className={linkCls}>
            Add place
          </Link>
          <Link href="/events/new" className={linkCls}>
            Add event
          </Link>
          <Link href="/trips" className={linkCls}>
            My Trips
          </Link>
          <button onClick={logout} className={linkCls}>
            Log out
          </button>
        </>
      ) : (
        <>
          <Link href="/login" className={linkCls}>
            Log in
          </Link>
          <Link href="/signup" className="btn-primary px-4 py-2 text-sm">
            Sign up
          </Link>
        </>
      )}
    </nav>
  );
}
