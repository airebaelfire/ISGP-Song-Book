-- ============================================================================
-- FOR TEST PROJECTS ONLY. NEVER RUN THIS ON THE LIVE DATABASE.
-- ============================================================================
-- Seeds a second library so multi-library selection can be tested. Run it on a
-- test Supabase project after schema.sql (or libraries.sql). Safe to re-run.
--
-- Creates "Test Library" with:
--   - two new songs that exist only in Test Library (origin "Test Origin"), and
--   - "Sample Song" from schema.sql, which is also in ISGP BC, so you can check
--     that a song in both selected libraries is listed once.

insert into public.libraries (slug, name, description, sort_order)
values ('test-library', 'Test Library', 'Seed data for testing libraries', 1)
on conflict (slug) do nothing;

insert into public.songs (title, origin, capo, song, strumming_pattern)
select v.title, v.origin, v.capo, v.song, v.strumming_pattern
from (values
  ('TEST Only In Test Library A', 'Test Origin', 0, E'[G]Test song A [C]line one\n[D]Line [G]two', 'D-DU'),
  ('TEST Only In Test Library B', 'Test Origin', 3, E'[Em]Test song B [C]line one\n[G]Line [D]two', null)
) as v (title, origin, capo, song, strumming_pattern)
where not exists (select 1 from public.songs s where s.title = v.title);

insert into public.library_songs (library_id, song_id)
select l.id, s.id
from public.libraries l
join public.songs s
  on s.title in ('TEST Only In Test Library A', 'TEST Only In Test Library B', 'Sample Song')
where l.slug = 'test-library'
on conflict do nothing;

-- To remove the seed data afterwards (memberships go with it via cascade):
--
-- delete from public.songs where title like 'TEST Only In Test Library %';
-- delete from public.libraries where slug = 'test-library';
