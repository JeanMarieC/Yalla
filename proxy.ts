// Next 16 "proxy" convention (formerly middleware.ts).
// Runs on every (non-static) request to keep the Supabase auth session fresh.
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase-middleware";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Everything except Next internals and static asset files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
