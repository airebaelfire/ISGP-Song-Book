-- ISGP Song Book — Supabase schema
-- Run this once in your Supabase project's SQL Editor (Project > SQL Editor > New query).

create extension if not exists "pgcrypto";

create table if not exists public.songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  origin text,
  capo int not null default 0,
  song text not null,
  strumming_pattern text,
  -- Comma-separated values, e.g. 'Hype, Mellow' and 'Easy chords, No capo'.
  vibes text,
  difficulty text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Re-running on a table created before vibes/difficulty existed (same as
-- supabase/tags.sql):
alter table public.songs add column if not exists vibes text;
alter table public.songs add column if not exists difficulty text;

-- Keep updated_at current on every edit made from Supabase Studio.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists songs_set_updated_at on public.songs;
create trigger songs_set_updated_at
  before update on public.songs
  for each row execute function public.set_updated_at();

-- Row Level Security: everyone can read, nobody can write through the app.
-- Songs are added/edited/deleted only via the Supabase Table Editor (which
-- uses your own dashboard login and bypasses RLS), never from the app itself.
alter table public.songs enable row level security;

drop policy if exists "Songs are publicly readable" on public.songs;
create policy "Songs are publicly readable"
  on public.songs for select
  to anon, authenticated
  using (true);

-- Enable Realtime so the app refreshes automatically after you edit a song
-- in the dashboard. Safe to re-run: skips if already enabled.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'songs'
  ) then
    alter publication supabase_realtime add table public.songs;
  end if;
end $$;

-- Song libraries: named lists of songs ("ISGP BC", "BWC", ...). A song lives
-- once in `songs` and is linked to any number of libraries via `library_songs`.
-- (Projects created before libraries existed: run supabase/libraries.sql.)

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

-- A couple of sample songs in the reference app's format, so you can verify
-- the app works end-to-end before importing your real song list.
insert into public.songs (title, origin, capo, song, strumming_pattern, vibes, difficulty) values
(
  'Sample Song',
  'ISGP Seminar',
  2,
  E'[C]This is a sample [F]verse line one\n[G]And a second [C]line here\n{[C]This is the chorus, [F]repeated twice\n[G]With its own [C]line}2\n[C]Back to a closing [F]line after the chorus',
  'D-DUDU',
  'Hype, Mellow',
  'Easy chords'
),
(
  'Another Example',
  'Devotional',
  0,
  E'[Am]Opening line of [F]the song\n[C]Second line [G]goes here\n{[Am]Bridge or chorus [F]content\n[C]Shown in a [G]box}3',
  'D--U-U-U',
  'Mellow',
  'Easy chords, No capo'
);

-- The app's default library. Every song should belong to at least one library,
-- or it only opens from a direct link.
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
