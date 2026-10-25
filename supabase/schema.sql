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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

-- A couple of sample songs in the reference app's format, so you can verify
-- the app works end-to-end before importing your real song list.
insert into public.songs (title, origin, capo, song, strumming_pattern) values
(
  'Sample Song',
  'ISGP Seminar',
  2,
  E'[C]This is a sample [F]verse line one\n[G]And a second [C]line here\n{[C]This is the chorus, [F]repeated twice\n[G]With its own [C]line}2\n[C]Back to a closing [F]line after the chorus',
  'D-DUDU'
),
(
  'Another Example',
  'Devotional',
  0,
  E'[Am]Opening line of [F]the song\n[C]Second line [G]goes here\n{[Am]Bridge or chorus [F]content\n[C]Shown in a [G]box}3',
  'D--U-U-U'
);
