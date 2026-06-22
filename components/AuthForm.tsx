"use client";

// Phase 6 — Email/password auth form, shared by /login and /signup.
// Uses the browser Supabase client; on success the session lands in cookies and
// the middleware/server clients pick it up.

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignup = mode === "signup";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    const supabase = createClient();

    if (isSignup) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      // If email confirmation is OFF, we get a session immediately.
      if (data.session) {
        router.push(next);
        router.refresh();
        return;
      }
      setNotice("Check your email to confirm your account, then log in.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-semibold tracking-tight">
          {isSignup ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-2 text-zinc-500">
          {isSignup ? "Save and revisit your days." : "Log in to find your saved trips."}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-zinc-400"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 6 chars)"
            autoComplete={isSignup ? "new-password" : "current-password"}
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-zinc-400"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-zinc-900 px-6 py-3 font-medium text-white transition hover:bg-zinc-700 disabled:opacity-40"
          >
            {loading ? "…" : isSignup ? "Sign up" : "Log in"}
          </button>
        </form>

        {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
        {notice && <p className="mt-4 text-sm text-zinc-600">{notice}</p>}

        <p className="mt-8 text-sm text-zinc-500">
          {isSignup ? (
            <>
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-zinc-900 underline">
                Log in
              </Link>
            </>
          ) : (
            <>
              New here?{" "}
              <Link href="/signup" className="font-medium text-zinc-900 underline">
                Sign up
              </Link>
            </>
          )}
        </p>
      </div>
    </main>
  );
}
