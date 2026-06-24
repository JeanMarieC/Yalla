-- Phase 12 — Destination finder (Layer B).
-- A catalog of real places to GO TO, each with a vibe embedding, theme tags, and
-- the months it shines (for seasonal/event boosts, e.g. Paris in July). Ranking
-- = vibe cosine similarity + a small in-season boost.

create table if not exists public.destinations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  country     text not null,
  lat         double precision not null,
  lng         double precision not null,
  description text not null,        -- evocative; includes signature seasons/events
  tags        text[] not null default '{}',
  best_months int[]  not null default '{}',  -- 1..12 the place is at its best
  embedding   vector(768),
  created_at  timestamptz not null default now()
);

create index if not exists destinations_embedding_hnsw
  on public.destinations using hnsw (embedding vector_cosine_ops);

alter table public.destinations enable row level security;
drop policy if exists "destinations public read" on public.destinations;
create policy "destinations public read"
  on public.destinations for select
  to anon, authenticated
  using (true);

-- Vibe match + seasonal boost. filter_month (1..12) optional: destinations whose
-- best_months include it get nudged up, so "somewhere fun in July" surfaces
-- places with great July happenings.
create or replace function public.match_destinations(
  query_embedding vector(768),
  match_count int default 8,
  filter_month int default null
)
returns table (
  id          uuid,
  name        text,
  country     text,
  lat         double precision,
  lng         double precision,
  description text,
  tags        text[],
  best_months int[],
  similarity  float,
  in_season   boolean
)
language sql
stable
as $$
  select
    d.id, d.name, d.country, d.lat, d.lng, d.description, d.tags, d.best_months,
    1 - (d.embedding <=> query_embedding) as similarity,
    (filter_month is not null and filter_month = any(d.best_months)) as in_season
  from public.destinations d
  where d.embedding is not null
  order by
    (1 - (d.embedding <=> query_embedding))
    + case when filter_month is not null and filter_month = any(d.best_months)
        then 0.05 else 0 end
    desc
  limit match_count;
$$;
