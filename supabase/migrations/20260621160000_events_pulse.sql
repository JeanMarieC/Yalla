-- Phase 7 — The Pulse.
-- Events differ from places: they are time-bound. The same vibe embedding ranks
-- them, but a row only counts if it's live within a time window (active now or
-- starting soon). Times are timestamptz (stored UTC). Embeddings use the SAME
-- model + dimension as places (vector(768)) so events and places are comparable.

create table if not exists public.events (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text not null,
  city         text not null,
  location     geography(Point, 4326) not null,
  start_time   timestamptz not null,
  end_time     timestamptz not null,
  tags         text[] not null default '{}',
  embedding    vector(768),
  source       text not null default 'user' check (source in ('seeded', 'user')),
  submitted_by uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists events_location_gist on public.events using gist (location);
create index if not exists events_embedding_hnsw
  on public.events using hnsw (embedding vector_cosine_ops);
create index if not exists events_time_idx on public.events (end_time, start_time);

-- RLS: anyone can read; logged-in users can add; owners manage their own.
alter table public.events enable row level security;

drop policy if exists "events are publicly readable" on public.events;
drop policy if exists "insert own events" on public.events;
drop policy if exists "update own events" on public.events;
drop policy if exists "delete own events" on public.events;

create policy "events are publicly readable"
  on public.events for select
  to anon, authenticated
  using (true);

create policy "insert own events"
  on public.events for insert
  to authenticated
  with check (submitted_by = auth.uid());

create policy "update own events"
  on public.events for update
  to authenticated
  using (submitted_by = auth.uid())
  with check (submitted_by = auth.uid());

create policy "delete own events"
  on public.events for delete
  to authenticated
  using (submitted_by = auth.uid());

-- Vibe ranking, scoped to a city AND a live time window.
-- "Live" = hasn't ended yet (end_time >= now) and starts within the window
-- (start_time <= now + within_days). This is what makes an event current.
create or replace function public.match_events(
  query_embedding vector(768),
  match_count int default 12,
  filter_city text default null,
  within_days int default 7
)
returns table (
  id          uuid,
  name        text,
  description text,
  city        text,
  start_time  timestamptz,
  end_time    timestamptz,
  tags        text[],
  lng         float,
  lat         float,
  similarity  float
)
language sql
stable
as $$
  select
    e.id, e.name, e.description, e.city, e.start_time, e.end_time, e.tags,
    st_x(e.location::geometry) as lng,
    st_y(e.location::geometry) as lat,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.events e
  where e.embedding is not null
    and (filter_city is null or e.city = filter_city)
    and e.end_time   >= now()
    and e.start_time <= now() + (within_days * interval '1 day')
  order by e.embedding <=> query_embedding
  limit match_count;
$$;
