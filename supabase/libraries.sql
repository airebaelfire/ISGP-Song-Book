-- ISGP Song Book — song libraries migration
-- Run this in your Supabase project's SQL Editor on a project that was set up
-- with an older schema.sql (before libraries existed). Safe to run more than
-- once: every statement either skips or converges on the same end state.
--
-- A library is a named list of songs ("ISGP BC", "BWC", ...). Songs live once
-- in `songs`; `library_songs` links them to any number of libraries.

create extension if not exists "pgcrypto";

create table if not exists public.libraries (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  sort_order int not null default 0
);

create table if not exists public.library_songs (
  library_id uuid not null references public.libraries (id) on delete cascade,
  song_id uuid not null references public.songs (id) on delete cascade,
  primary key (library_id, song_id)
);

-- The primary key already covers lookups by library_id; this covers song_id
-- (e.g. the cascade when a song is deleted).
create index if not exists library_songs_song_id_idx on public.library_songs (song_id);

-- Row Level Security: same approach as `songs` — everyone can read, nobody can
-- write through the app. Libraries and memberships are managed only via the
-- Supabase dashboard, which bypasses RLS.
alter table public.libraries enable row level security;
alter table public.library_songs enable row level security;

drop policy if exists "Libraries are publicly readable" on public.libraries;
create policy "Libraries are publicly readable"
  on public.libraries for select
  to anon, authenticated
  using (true);

drop policy if exists "Library songs are publicly readable" on public.library_songs;
create policy "Library songs are publicly readable"
  on public.library_songs for select
  to anon, authenticated
  using (true);

-- Make sure these tables end up select-only: drop any insert/update/delete/all
-- policy that may have been added by hand, so re-running this file always
-- restores the read-only state.
do $$
declare
  pol record;
begin
  for pol in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('libraries', 'library_songs')
      and cmd <> 'SELECT'
  loop
    execute format('drop policy %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- Enable Realtime so the app refreshes when libraries change. Safe to re-run:
-- skips tables that are already in the publication.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'libraries'
  ) then
    alter publication supabase_realtime add table public.libraries;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'library_songs'
  ) then
    alter publication supabase_realtime add table public.library_songs;
  end if;
end $$;

-- Backfill: the app's default library, containing every existing song.
insert into public.libraries (slug, name, description, sort_order)
values ('isgp-bc', 'ISGP BC', null, 0)
on conflict (slug) do nothing;

insert into public.library_songs (library_id, song_id)
select l.id, s.id
from public.libraries l
cross join public.songs s
where l.slug = 'isgp-bc'
on conflict do nothing;

-- After adding songs, run this to find songs that aren't in any library.
-- They won't appear in the app's list (only via a direct link):
--
-- select s.id, s.title, s.origin
-- from public.songs s
-- left join public.library_songs ls on ls.song_id = s.id
-- where ls.song_id is null
-- order by s.title;
