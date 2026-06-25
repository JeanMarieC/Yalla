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
    <main className="flex min-h-[100dvh] flex-1 overflow-hidden bg-surface md:items-stretch">
      {/* Brand panel — desktop only. The warm welcome. */}
      <div className="relative hidden w-[46%] max-w-[560px] flex-col justify-between overflow-hidden bg-ink p-11 md:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            backgroundImage:
              "repeating-linear-gradient(135deg, rgba(192,96,60,.10) 0 2px, transparent 2px 22px)",
          }}
        />
        <div
          className="pointer-events-none absolute -right-28 -top-20 h-[420px] w-[420px] rounded-full"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, rgba(192,96,60,.55), rgba(192,96,60,0) 62%)",
          }}
        />
        <Link href="/" className="relative flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-paper font-display text-xl text-ink">
            y
          </span>
          <span className="font-display text-xl text-paper">Yalla</span>
        </Link>
        <div className="relative">
          <p className="yalla-eyebrow mb-5 text-terracotta">Trust us — just go</p>
          <h2 className="font-display text-4xl font-normal leading-[1.08] tracking-tight text-[#F6F1E8]">
            Tell us the vibe.
            <br />
            We&apos;ll find the day worth showing up for.
          </h2>
        </div>
        <p className="relative text-sm text-[#A89E8C]">
          No itineraries to build. No tabs to open. Just one good day.
        </p>
      </div>

      {/* Form */}
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm animate-fade-up">
          <h1 className="font-display text-3xl font-normal tracking-tight text-ink">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1.5 text-muted">
            {isSignup
              ? "Save and revisit your days."
              : "Pick up where wanderlust left off."}
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="yalla-input"
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 6 chars)"
              autoComplete={isSignup ? "new-password" : "current-password"}
              className="yalla-input"
            />
            <button
              type="submit"
              disabled={loading}
              className="btn-primary mt-1 w-full px-6 py-3.5 text-base"
            >
              {loading ? "…" : isSignup ? "Sign up" : "Continue"}
            </button>
          </form>

          {error && <p className="mt-4 text-sm text-terracotta-deep">{error}</p>}
          {notice && <p className="mt-4 text-sm text-ink-soft">{notice}</p>}

          <p className="mt-8 text-sm text-muted">
            {isSignup ? (
              <>
                Already have an account?{" "}
                <Link href="/login" className="font-semibold text-terracotta-deep">
                  Log in
                </Link>
              </>
            ) : (
              <>
                New here?{" "}
                <Link href="/signup" className="font-semibold text-terracotta-deep">
                  Create an account
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </main>
  );
}
