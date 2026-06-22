-- Phase 9 (Pass 1) — Trip Lobby: shareable, shared-access, presence.
-- The lobby IS the trip; the trip's UUID is the share token. RLS shifts from
-- "owner only" (Phase 6) to "owner OR any participant of this lobby".

-- Extra trip fields the re-planning agent needs (Phase 4 inputs) + a change note.
alter table public.trips
  add column if not exists start_time   text not null default '10:00',
  add column if not exists budget_hours int  not null default 8,
  add column if not exists last_change_note text;

-- Who is in a lobby. Joining = inserting your own row.
create table if not exists public.lobby_participants (
  id        uuid primary key default gen_random_uuid(),
  trip_id   uuid not null references public.trips(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (trip_id, user_id)
);

-- SECURITY DEFINER so it can be used inside RLS policies without recursing
-- through those same policies.
create or replace function public.is_lobby_participant(trip uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.lobby_participants lp
    where lp.trip_id = trip and lp.user_id = auth.uid()
  );
$$;

alter table public.lobby_participants enable row level security;

drop policy if exists "join lobby" on public.lobby_participants;
drop policy if exists "read lobby participants" on public.lobby_participants;
drop policy if exists "leave lobby" on public.lobby_participants;

create policy "join lobby"
  on public.lobby_participants for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "read lobby participants"
  on public.lobby_participants for select
  to authenticated
  using (is_lobby_participant(trip_id));

create policy "leave lobby"
  on public.lobby_participants for delete
  to authenticated
  using (user_id = auth.uid());

-- The shared-access shift: participants can read the lobby's trip (the owner
-- policy from Phase 6 still applies too — permissive policies OR together).
drop policy if exists "read lobby trips" on public.trips;
create policy "read lobby trips"
  on public.trips for select
  to authenticated
  using (is_lobby_participant(id));

-- Realtime: itinerary changes (trips) and presence-of-record (participants).
do $$ begin
  alter publication supabase_realtime add table public.trips;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.lobby_participants;
exception when duplicate_object then null; end $$;
