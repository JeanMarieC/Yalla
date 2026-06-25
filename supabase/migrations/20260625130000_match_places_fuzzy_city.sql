-- Phase 14.3 — Robust city matching.
-- Before: match_places filtered on exact `p.city = filter_city`, so a brief that
-- resolved to "Beirut, Lebanon" returned ZERO rows against places stored as
-- "Beirut" → empty plan. Now we match case-insensitively and tolerate the
-- stored city being a substring of the requested phrase (the common case).
-- Return shape is unchanged, so CREATE OR REPLACE is safe (no DROP needed).

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
    and (
      filter_city is null
      or lower(p.city) = lower(filter_city)
      -- "Beirut" (stored) is contained in "Beirut, Lebanon" (requested)
      or lower(filter_city) like '%' || lower(p.city) || '%'
    )
  order by p.embedding <=> query_embedding
  limit match_count;
$$;
