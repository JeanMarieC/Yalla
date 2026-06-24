// Phase 11 — Interpret a free-text brief into a routed TripBrief. Server-side
// (Gemini key stays here). The client uses the result to pick + prefill a mode.

import { NextResponse } from "next/server";
import { interpretBrief } from "@/lib/ai/interpretBrief";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const brief = String(body.brief ?? "").trim();
    if (!brief) {
      return NextResponse.json({ error: "Tell Yalla what you're after." }, { status: 400 });
    }
    const result = await interpretBrief(brief);
    return NextResponse.json({ brief: result });
  } catch (err) {
    console.error("/api/interpret failed:", err);
    return NextResponse.json({ error: "Couldn't read that. Try rephrasing." }, { status: 500 });
  }
}
