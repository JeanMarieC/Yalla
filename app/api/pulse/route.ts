// Phase 7 — Pulse feed. POST { vibe, city, withinDays } -> this-window events
// ranked by the vibe, each with a "why it fits" line. Public data (events are
// publicly readable), so it uses the engine's default admin read client.

import { NextResponse } from "next/server";
import { findEventsByVibe } from "@/lib/events";
import { generateWhyItFits } from "@/lib/ai/whyItFits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const vibe = String(body.vibe ?? "").trim();
    const city = body.city ? String(body.city).trim() : "";
    const withinDays = Number(body.withinDays ?? 7);

    if (!vibe) {
      return NextResponse.json({ error: "Missing vibe." }, { status: 400 });
    }

    const events = await findEventsByVibe(
      vibe,
      city || undefined,
      Number.isFinite(withinDays) ? withinDays : 7,
      12,
    );

    const whyLines = await generateWhyItFits(
      vibe,
      events.map((e) => ({
        name: e.name,
        tags: e.tags,
        description: e.description,
      })),
    );

    const withWhy = events.map((e, i) => ({ ...e, whyItFits: whyLines[i] }));
    return NextResponse.json({ events: withWhy });
  } catch (err) {
    console.error("/api/pulse failed:", err);
    return NextResponse.json({ error: "Failed to load the Pulse." }, { status: 500 });
  }
}
