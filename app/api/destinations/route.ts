// Phase 12 — Rank destinations for a brief (+ optional month for seasonal boost).

import { NextResponse } from "next/server";
import { findDestinations } from "@/lib/destinations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const brief = String(body.brief ?? "").trim();
    const month = body.month != null ? Number(body.month) : null;
    if (!brief) {
      return NextResponse.json({ error: "Describe the kind of trip." }, { status: 400 });
    }
    const destinations = await findDestinations(
      brief,
      month && month >= 1 && month <= 12 ? month : null,
      8,
    );
    return NextResponse.json({ destinations });
  } catch (err) {
    console.error("/api/destinations failed:", err);
    return NextResponse.json({ error: "Couldn't find destinations." }, { status: 500 });
  }
}
