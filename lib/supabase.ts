// Supabase clients.
//
// Two distinct clients, by trust level:
//   - supabaseAnon():  uses the PUBLISHABLE key (sb_publishable_...). Safe in the
//                      browser; subject to Row Level Security (RLS). Read-only.
//   - supabaseAdmin(): uses the SECRET key (sb_secret_...). Bypasses RLS.
//                      SERVER ONLY — must never be imported into client
//                      components or shipped to the browser. Used by scripts.
//
// These are Supabase's current API keys; the older anon / service_role JWT keys
// work too, so we read the new env names first and fall back to the old ones.
// The URL is the same for both; only the key differs.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function requireUrl(): string {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      "Supabase URL is not set. Add SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) to .env.local.",
    );
  }
  return url;
}

/** Browser-safe, RLS-bound client. Uses the publishable key. */
export function supabaseAnon(): SupabaseClient {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "Publishable key is not set. Add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (sb_publishable_...) to .env.local.",
    );
  }
  return createClient(requireUrl(), key, {
    auth: { persistSession: false },
  });
}

/**
 * Privileged client that bypasses RLS. SERVER-SIDE ONLY.
 * Throws loudly if it would ever run in a browser.
 */
export function supabaseAdmin(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error(
      "supabaseAdmin() must never run in the browser — it uses the secret key.",
    );
  }
  const key =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Secret key is not set. Add SUPABASE_SECRET_KEY (sb_secret_...) to .env.local (server-side only).",
    );
  }
  return createClient(requireUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
