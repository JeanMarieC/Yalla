# Yalla

Turn a vibe and a free weekend into a ready-to-go itinerary — no planning, no FOMO.

## What this is

Yalla is an inspiration engine for travel. Instead of searching for a destination you
already have to know, you describe a *vibe* — e.g. "moody coastal, vinyl bars, hidden
bakeries" — plus a time budget, and the app returns a complete, hour-by-hour itinerary on
a clean interactive map. It works for a spontaneous weekend escape, a scenic road trip
built around an event, or discovering what's alive in your own city right now. Plans are
shareable, so friends can join, vote, and the route reshapes around the group live.

The product's job is **confident curation**, not search. The enemy is decision fatigue.
Every design choice should protect the feeling of "trust me, just go."

## Tech stack (locked)

- **Frontend:** Next.js (App Router) + TypeScript
- **Data + backend:** Supabase — Postgres with the PostGIS and pgvector extensions, plus
  Supabase Auth, Realtime, and Storage
- **Map:** Mapbox GL (custom styling, sparse pins, route lines)
- **AI:** direct LLM API calls for now; LangGraph only when we reach the agentic phase
- **Styling:** Tailwind CSS
- **Deploy:** Vercel (app) + Supabase (hosted database)

## Architecture principles

1. **AI handles understanding, curation, and language. Real systems handle facts and math.**
   - The LLM parses vibes, picks/sequences places, writes the "why it fits you" lines, and
     summarizes reviews.
   - Travel times and routing come from Mapbox Directions — never from the LLM.
   - Place and event data come from APIs and user submissions — never invented by the LLM.
2. **Keep the AI small and contained.** All AI logic lives in `lib/ai/`. It is a few files,
   not the center of the app.
3. **Layered structure:** `app/` is what users see, `components/` are reusable UI pieces,
   `lib/` is logic with no UI.

## Project structure

```
yalla/
├── app/                      # Screens
│   ├── page.tsx              # Home — enter vibe + time budget
│   ├── trip/[id]/page.tsx    # Map + itinerary view
│   └── lobby/[id]/page.tsx   # Group voting (later)
├── components/               # Reusable UI
│   ├── Map.tsx               # Mapbox canvas, pins, route line
│   ├── StopCard.tsx          # Sliding card for a place
│   └── VibePicker.tsx        # Vibe input
├── lib/
│   ├── ai/
│   │   ├── interpretVibe.ts  # Vibe sentence -> tags
│   │   ├── planDay.ts        # Build the itinerary
│   │   └── agent.ts          # LangGraph flow (much later)
│   ├── places.ts             # Find places (Places API + pgvector)
│   ├── routing.ts            # Travel times (Mapbox)
│   └── supabase.ts           # DB connection
├── supabase/migrations/      # Database tables
├── .env.local                # Secret keys — never commit
└── CLAUDE.md
```

## How to work with Claude Code on this project

- **One phase at a time.** Ask which phase we're on, do only that phase.
- **Explain as you go** — narrate each step so I learn while we build.
- **Never build ahead** of the current phase.
- **Each phase must end runnable.** We commit to git before starting the next phase.
- Tell me clearly which steps I must do manually (creating the Supabase project, getting
  API keys, etc.).

## Build roadmap

- **Phase 0 — Foundation.** Scaffold Next.js + TS + Tailwind, folder structure, env setup.
  *Done when:* the blank app runs locally.
- **Phase 1 — First AI spark.** `interpretVibe.ts`: vibe sentence -> tags, with a test.
  *Done when:* a vibe string returns clean tags.
- **Phase 2 — Place catalog.** `places` table with PostGIS location + pgvector embedding;
  seed ~20-30 real spots; embed descriptions. *Done when:* query places by location and vibe.
- **Phase 3 — Vibe matching.** Vibe + start point -> ranked list of real matching places.
- **Phase 4 — Itinerary builder.** `planDay.ts`: sequence places into a timed day, add
  Mapbox travel times, generate per-stop "why it fits" lines.
- **Phase 5 — The map (centerpiece).** Mapbox canvas, custom pins, route line, StopCard,
  VibePicker. *Done when:* enter a vibe on home and see a mapped day. First demo-able MVP.
- **Phase 6 — Accounts + saved trips.** Supabase Auth, save/revisit itineraries.
- **Phase 7 — The Pulse.** Events source (seeded + user-submitted, weekly), map toggle for
  live local events ranked by vibe.
- **Phase 8 — Reviews + community places.** User reviews and place submissions; AI review
  summaries.
- **Phase 9 — Trip Lobby.** Shareable links, Supabase Realtime voting, route reshapes when
  a stop is voted out. LangGraph agent enters here.
- **Phase 10 — Round out + ship.** Event-anchored road-trip mode, mobile polish, deploy.

## Conventions

- TypeScript strict mode on.
- Secrets only in `.env.local` (git-ignored). Provide a `.env.local.example` with key names.
- Small, focused commits — one per meaningful step.
