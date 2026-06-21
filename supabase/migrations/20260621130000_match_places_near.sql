-- Phase 3 — Vibe matching.
-- Combines pgvector similarity with a PostGIS radius filter: rank places by how
-- well they match a vibe embedding, but only among those within radius_meters of
-- a point. This is the geo-scoped counterpart to match_places(... filter_city).
-- Location-agnostic: works for any coordinate on Earth.
-- Apply this after the Phase 2 migration.

create or replace function public.match_places_near(
  query_embedding vector(768),
  center_lat float,
  center_lng float,
  radius_meters float default 5000,
  match_count int default 10
)
returns table (
  id              uuid,
  name            text,
  description     text,
  city            text,
  country         text,
  place_types     text[],
  similarity      float,
  distance_meters float
)
language sql
stable
as $$
  with origin as (
    select st_setsrid(st_makepoint(center_lng, center_lat), 4326)::geography as g
  )
  select
    p.id, p.name, p.description, p.city, p.country, p.place_types,
    1 - (p.embedding <=> query_embedding) as similarity,
    st_distance(p.location, origin.g)     as distance_meters
  from public.places p, origin
  where p.embedding is not null
    and st_dwithin(p.location, origin.g, radius_meters)
  order by p.embedding <=> query_embedding   -- rank by vibe, within the radius
  limit match_count;
$$;
