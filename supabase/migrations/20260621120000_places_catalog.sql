-- Phase 2 — Place catalog.
-- Location-agnostic: serves any city/country. Vibe search via pgvector cosine
-- similarity; proximity search via PostGIS. Apply this whole file once (see
-- CLAUDE.md / the Phase 2 notes for how: Supabase SQL Editor or the CLI).

-- 1. Extensions ------------------------------------------------------------
-- PostGIS for geospatial types/queries, pgvector for embeddings.
-- If you prefer, enable these in the Dashboard (Database -> Extensions) and
-- delete these two lines. On Supabase they install into the "extensions" schema.
create extension if not exists postgis;
create extension if not exists vector;

-- 2. Table -----------------------------------------------------------------
-- embedding is vector(768): MUST match EMBEDDING_DIMENSION in lib/ai/embed.ts.
-- location is geography(Point, 4326) → distances come back in METERS.
create table if not exists public.places (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text not null,
  city        text not null,
  country     text not null,
  location    geography(Point, 4326) not null,
  place_types text[] not null default '{}',
  embedding   vector(768),
  created_at  timestamptz not null default now()
);

-- 3. Indexes ---------------------------------------------------------------
-- GiST on the geography column for fast proximity / ST_DWithin queries.
create index if not exists places_location_gist
  on public.places using gist (location);

-- HNSW on the embedding for fast approximate cosine-similarity search.
-- (vector_cosine_ops pairs with the <=> cosine-distance operator below.)
create index if not exists places_embedding_hnsw
  on public.places using hnsw (embedding vector_cosine_ops);

-- GIN on place_types so we can filter by tag cheaply later.
create index if not exists places_place_types_gin
  on public.places using gin (place_types);

-- 4. Row Level Security ----------------------------------------------------
-- Places are public read-only. Inserts/updates happen via the service role,
-- which bypasses RLS — so the anon key can never write to this table.
alter table public.places enable row level security;

drop policy if exists "places are publicly readable" on public.places;
create policy "places are publicly readable"
  on public.places for select
  to anon, authenticated
  using (true);

-- 5. Vibe search: cosine similarity ---------------------------------------
-- Returns the closest places to query_embedding, optionally scoped to a city.
-- similarity is 1 - cosine_distance, so higher = better (range ~0..1).
create or replace function public.match_places(
  query_embedding vector(768),
  match_count int default 5,
  filter_city text default null
)
returns table (
  id          uuid,
  name        text,
  description text,
  city        text,
  country     text,
  place_types text[],
  similarity  float
)
language sql
stable
as $$
  select
    p.id, p.name, p.description, p.city, p.country, p.place_types,
    1 - (p.embedding <=> query_embedding) as similarity
  from public.places p
  where p.embedding is not null
    and (filter_city is null or p.city = filter_city)
  order by p.embedding <=> query_embedding
  limit match_count;
$$;

-- 6. Proximity search: PostGIS distance -----------------------------------
-- Returns places within radius_meters of (lat,lng), nearest first.
-- NOTE: ST_MakePoint takes (lng, lat) — longitude first.
create or replace function public.nearby_places(
  lat float,
  lng float,
  radius_meters float default 2000,
  match_count int default 20
)
returns table (
  id              uuid,
  name            text,
  description     text,
  city            text,
  country         text,
  place_types     text[],
  distance_meters float
)
language sql
stable
as $$
  with origin as (
    select st_setsrid(st_makepoint(lng, lat), 4326)::geography as g
  )
  select
    p.id, p.name, p.description, p.city, p.country, p.place_types,
    st_distance(p.location, origin.g) as distance_meters
  from public.places p, origin
  where st_dwithin(p.location, origin.g, radius_meters)
  order by p.location <-> origin.g
  limit match_count;
$$;
