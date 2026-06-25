-- Phase 14.4 — Let the planner see the facts.
-- match_places / match_places_near now also return opening_hours (normalized
-- weekly JSON) and prominence, so planDay can schedule only OPEN places and
-- weight picks by quality. Return shape changes → DROP + CREATE (per the Phase 4
-- note: CREATE OR REPLACE can't change a function's result type).
-- Apply after the Phase 14.1 columns exist.

drop function if exists public.match_places(vector, int, text);
create function public.match_places(
  query_embedding vector(768),
  match_count int default 5,
  filter_city text default null
)
returns table (
  id            uuid,
  name          text,
  description   text,
  city          text,
  country       text,
  place_types   text[],
  lng           float,
  lat           float,
  similarity    float,
  opening_hours jsonb,
  prominence    real
)
language sql
stable
as $$
  select
    p.id, p.name, p.description, p.city, p.country, p.place_types,
    st_x(p.location::geometry) as lng,
    st_y(p.location::geometry) as lat,
    1 - (p.embedding <=> query_embedding) as similarity,
    p.opening_hours,
    p.prominence
  from public.places p
  where p.embedding is not null
    and (
      filter_city is null
      or lower(p.city) = lower(filter_city)
      or lower(filter_city) like '%' || lower(p.city) || '%'
    )
  order by p.embedding <=> query_embedding
  limit match_count;
$$;

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
  distance_meters float,
  opening_hours   jsonb,
  prominence      real
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
    st_distance(p.location, origin.g)     as distance_meters,
    p.opening_hours,
    p.prominence
  from public.places p, origin
  where p.embedding is not null
    and st_dwithin(p.location, origin.g, radius_meters)
  order by p.embedding <=> query_embedding
  limit match_count;
$$;
