"use client";

// Supabase client for the BROWSER (client components). Uses the publishable
// (anon) key and stores the session in cookies via @supabase/ssr, so the same
// session is visible to server components and route handlers. RLS-bound.

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

let client: SupabaseClient | undefined;

export function createClient(): SupabaseClient {
  // Reuse one instance per tab so auth state stays consistent.
  if (!client) client = createBrowserClient(URL, KEY);
  return client;
}
