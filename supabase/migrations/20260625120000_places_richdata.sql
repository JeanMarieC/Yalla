-- Phase 14.1 — Location data quality: richer place facts.
-- These columns let the planner schedule only OPEN places and weight picks by a
-- free "prominence" quality proxy (no paid ratings API). All nullable / defaulted
-- so existing rows and the current ingest keep working until Phase 14.2 fills them.
-- Apply in the Supabase SQL Editor (same as the earlier migrations).

alter table public.places
  -- Where it is, in human terms (for the UI + the later booking phase).
  add column if not exists address      text,
  add column if not exists neighborhood text,

  -- Opening hours. raw_opening_hours keeps the original OSM string (audit/debug);
  -- opening_hours is the NORMALIZED weekly shape the planner reads:
  --   { "mon": [["09:00","17:00"]], ..., "sun": [], "alwaysOpen": false }
  -- A null opening_hours means "unknown" — the planner treats those leniently.
  add column if not exists raw_opening_hours text,
  add column if not exists opening_hours     jsonb,

  -- Quality proxy in [0,1]. Built at ingest from free signals (wikidata/wikipedia
  -- presence, tourism tags, tag completeness) and — later — fused with reviews.
  add column if not exists prominence real not null default 0,

  -- Stable identity from OpenStreetMap, so re-ingest can upsert/dedupe reliably
  -- instead of matching on name alone.
  add column if not exists osm_type text,   -- 'node' | 'way' | 'relation'
  add column if not exists osm_id   bigint;

-- Fast upsert/dedupe by OSM identity.
create unique index if not exists places_osm_uidx
  on public.places (osm_type, osm_id)
  where osm_id is not null;

-- Filter/scan by prominence cheaply when ranking.
create index if not exists places_prominence_idx
  on public.places (prominence desc);
