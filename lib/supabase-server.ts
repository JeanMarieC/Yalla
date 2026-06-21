// Supabase client for the SERVER (server components, route handlers).
// Reads/writes the session from the request cookies via @supabase/ssr, so
// auth.uid() is known to Postgres and RLS applies to the logged-in user.
// Still the publishable (anon) key — NOT the service role.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";

export async function createClient(): Promise<SupabaseClient> {
  // cookies() is async in the App Router (Next 15+).
  const cookieStore = await cookies();

  return createServerClient(URL, KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // In Server Components writing cookies throws; that's fine because the
        // middleware refreshes the session. Swallow it there.
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — ignored (middleware handles refresh).
        }
      },
    },
  });
}
