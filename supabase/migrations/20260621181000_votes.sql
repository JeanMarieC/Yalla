-- Phase 9 (Pass 2) — Live voting.
-- One vote per user per stop. stop_id is the stop's place id (the itinerary is
-- jsonb; stops are identified by their place id). Shared among participants and
-- broadcast over Realtime so tallies update live for everyone.

create table if not exists public.votes (
  id         uuid primary key default gen_random_uuid(),
  lobby_id   uuid not null references public.trips(id) on delete cascade,
  stop_id    text not null,
  user_id    uuid not null references auth.users(id) on delete cascade,
  vote       text not null check (vote in ('up', 'down')),
  created_at timestamptz not null default now(),
  unique (lobby_id, user_id, stop_id)
);

create index if not exists votes_lobby_idx on public.votes(lobby_id);

alter table public.votes enable row level security;

drop policy if exists "read lobby votes"   on public.votes;
drop policy if exists "insert own votes"    on public.votes;
drop policy if exists "update own votes"    on public.votes;
drop policy if exists "delete own votes"    on public.votes;

-- Any participant can read every vote in their lobby (shared tallies)...
create policy "read lobby votes"
  on public.votes for select
  to authenticated
  using (is_lobby_participant(lobby_id));

-- ...but you can only cast/change/remove your OWN vote.
create policy "insert own votes"
  on public.votes for insert
  to authenticated
  with check (user_id = auth.uid() and is_lobby_participant(lobby_id));

create policy "update own votes"
  on public.votes for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "delete own votes"
  on public.votes for delete
  to authenticated
  using (user_id = auth.uid());

do $$ begin
  alter publication supabase_realtime add table public.votes;
exception when duplicate_object then null; end $$;
