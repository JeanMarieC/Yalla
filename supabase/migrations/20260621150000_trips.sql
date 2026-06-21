-- Phase 6 — Accounts + saved trips.
-- A trip is a saved itinerary owned by one user. Row Level Security makes every
-- row private: a user can only see/modify rows where user_id = auth.uid().

create table if not exists public.trips (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  vibe       text not null,
  city       text,
  itinerary  jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists trips_user_id_idx on public.trips(user_id);

-- Lock the table down, then open exactly four self-scoped policies.
alter table public.trips enable row level security;

drop policy if exists "read own trips"   on public.trips;
drop policy if exists "insert own trips"  on public.trips;
drop policy if exists "update own trips"  on public.trips;
drop policy if exists "delete own trips"  on public.trips;

create policy "read own trips"
  on public.trips for select
  to authenticated
  using (user_id = auth.uid());

create policy "insert own trips"
  on public.trips for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "update own trips"
  on public.trips for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "delete own trips"
  on public.trips for delete
  to authenticated
  using (user_id = auth.uid());
