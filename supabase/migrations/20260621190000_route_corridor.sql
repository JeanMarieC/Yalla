-- Phase 10 (Part 1) — Event-anchored road trip.
-- Find vibe-matched places within a corridor around a driving route, and report
-- each one's PROGRESS along the route (0 = start, 1 = the event) so stops can be
-- sequenced start -> event instead of clustered in one city.

create or replace function public.match_places_along_route(
  query_embedding vector(768),
  route_geojson text,            -- a GeoJSON LineString geometry (from Mapbox)
  corridor_meters float default 2000,
  match_count int default 30
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
  similarity  float,
  progress    float
)
language sql
stable
as $$
  with route as (
    select st_setsrid(st_geomfromgeojson(route_geojson), 4326) as geom
  )
  select
    p.id, p.name, p.description, p.city, p.country, p.place_types,
    st_x(p.location::geometry) as lng,
    st_y(p.location::geometry) as lat,
    1 - (p.embedding <=> query_embedding) as similarity,
    st_linelocatepoint(route.geom, p.location::geometry) as progress
  from public.places p, route
  where p.embedding is not null
    and st_dwithin(p.location, route.geom::geography, corridor_meters)  -- within corridor
  order by p.embedding <=> query_embedding                              -- vibe rank
  limit match_count;
$$;
