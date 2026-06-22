-- Phase 8 — Reviews + community places.
-- Closes the data loop: users add places and reviews; an AI summary (cached on
-- the place) folds into the embedding so well-reviewed character shapes matching.

-- 1. Extend places: provenance + cached review summary -----------------------
alter table public.places
  add column if not exists source text not null default 'seeded',
  add column if not exists submitted_by uuid references auth.users(id) on delete set null,
  add column if not exists review_summary text,
  add column if not exists summary_updated_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'places_source_check') then
    alter table public.places
      add constraint places_source_check check (source in ('seeded', 'api', 'user'));
  end if;
end $$;

-- Logged-in users may add their own places (catalog stays writable only via
-- this self-scoped policy; the service role still bypasses RLS for seeding).
drop policy if exists "insert own places" on public.places;
create policy "insert own places"
  on public.places for insert
  to authenticated
  with check (submitted_by = auth.uid() and source = 'user');

-- 2. Reviews: one per user per place -----------------------------------------
create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  place_id   uuid not null references public.places(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  rating     int not null check (rating between 1 and 5),
  body       text,
  created_at timestamptz not null default now(),
  unique (place_id, user_id)
);

create index if not exists reviews_place_id_idx on public.reviews(place_id);

alter table public.reviews enable row level security;

drop policy if exists "reviews are publicly readable" on public.reviews;
drop policy if exists "insert own reviews" on public.reviews;
drop policy if exists "update own reviews" on public.reviews;
drop policy if exists "delete own reviews" on public.reviews;

create policy "reviews are publicly readable"
  on public.reviews for select
  to anon, authenticated
  using (true);

create policy "insert own reviews"
  on public.reviews for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "update own reviews"
  on public.reviews for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "delete own reviews"
  on public.reviews for delete
  to authenticated
  using (user_id = auth.uid());
