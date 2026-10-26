-- ============================================================================
-- FOR TEST PROJECTS ONLY. NEVER RUN THIS ON THE LIVE DATABASE.
-- ============================================================================
-- Fills vibes and difficulty on the test songs so the Vibe and Difficulty
-- filters can be tested. Run it on a test Supabase project after tags.sql,
-- schema.sql and test-library.sql. Safe to re-run.
--
--   - "Another Example" (the schema.sql sample starting "[Am]Opening line")
--     uses " mellow" (leading space, lower case) on purpose: it should show
--     as one "Mellow" chip together with "Sample Song".
--   - "TEST Only In Test Library B" is the only song with "Reflective" and
--     "Barre chords", so deselecting Test Library should hide those chips.

-- Songs are matched by title or by how their body starts, so the schema.sql
-- samples are still found after being renamed in the Table Editor.
update public.songs as s
set vibes = v.vibes, difficulty = v.difficulty
from (values
  ('Sample Song', '[C]This is a sample [F]verse line one', 'Hype, Mellow', 'Easy chords'),
  ('Another Example', '[Am]Opening line of [F]the song', ' mellow', 'Easy chords, No capo'),
  ('TEST Only In Test Library A', '[G]Test song A [C]line one', 'Hype', 'No capo'),
  ('TEST Only In Test Library B', '[Em]Test song B [C]line one', 'Reflective', 'Barre chords')
) as v (title, song_start, vibes, difficulty)
where s.title = v.title or starts_with(s.song, v.song_start);

-- To check the app with no vibes or difficulty at all (both tabs hidden),
-- clear every song's values:
--
-- update public.songs set vibes = null, difficulty = null;
