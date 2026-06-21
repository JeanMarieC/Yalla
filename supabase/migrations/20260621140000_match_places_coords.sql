-- Phase 4 — Itinerary builder.
-- Routing needs each place's coordinates, so we redefine the two match
-- functions to also return lng/lat (extracted from the geography column).
-- Changing a function's return columns requires DROP + CREATE (CREATE OR
-- REPLACE can't change the result type). Apply after the Phase 2 & 3 migrations.

-- match_places: vibe similarity + optional city filter, now with coordinates.
drop function if exists public.match_places(vector, int, text);
create function public.match_places(
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
  lng         float,
  lat         float,
  similarity  float
)
language sql
stable
as $$
  select
    p.id, p.name, p.description, p.city, p.country, p.place_types,
    st_x(p.location::geometry) as lng,
    st_y(p.location::geometry) as lat,
    1 - (p.embedding <=> query_embedding) as similarity
  from public.places p
  where p.embedding is not null
    and (filter_city is null or p.city = filter_city)
  order by p.embedding <=> query_embedding
  limit match_count;
$$;

-- match_places_near: vibe similarity within a radius, now with coordinates.
drop function if exists public.match_places_near(vector, float, float, float, int);
create function public.match_places_near(
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
  lng             float,
  lat             float,
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
    st_x(p.location::geometry) as lng,
    st_y(p.location::geometry) as lat,
    1 - (p.embedding <=> query_embedding) as similarity,
    st_distance(p.location, origin.g)     as distance_meters
  from public.places p, origin
  where p.embedding is not null
    and st_dwithin(p.location, origin.g, radius_meters)
  order by p.embedding <=> query_embedding
  limit match_count;
$$;
