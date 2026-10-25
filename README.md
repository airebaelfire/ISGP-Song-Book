# ISGP Song Book

Cross-platform (iOS + Android) song book app for the ISGP Undergraduate Seminar. Everyone
browses/searches/transposes/exports the same shared list of songs; songs themselves are
added, edited, or deleted directly in Supabase (see below), not in the app.

## One-time setup

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a free account/project if you don't have
one already. Once it's ready, open **Project Settings > API** and note down:

- **Project URL** (e.g. `https://xxxxxxxx.supabase.co`)
- **anon public** key (a long JWT string)

### 2. Create the database table

In the Supabase dashboard, open **SQL Editor > New query**, paste in the contents of
[`supabase/schema.sql`](supabase/schema.sql), and run it. This creates the `songs`,
`libraries` and `library_songs` tables, locks them down with Row Level Security (read-only
from the app, writes only via the dashboard), enables Realtime, and inserts two sample songs
in an "ISGP BC" library so you can verify things work before importing your real song list.

> **Upgrading an existing project** (set up before libraries existed)? Run
> [`supabase/libraries.sql`](supabase/libraries.sql) instead. It adds the two library tables
> and puts every existing song in "ISGP BC". It's safe to run more than once.

### 3. Configure the app

```bash
cp .env.example .env
```

Edit `.env` and fill in the Project URL and anon key from step 1:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

The anon key is safe to ship in the app — it can only ever *read* songs, because of the
Row Level Security policy set up in step 2.

### 4. Install and run

```bash
npm install
npx expo start
```

Open the result in the iOS Simulator, an Android emulator, or Expo Go on a physical device.

> **Note:** this project is on Expo SDK 57 (React Native 0.86). The app needs iOS 16.4 or
> later, or Android 7.0 (API 24) or later.
>
> - **Expo Go:** the SDK 57 version of Expo Go may not be in the App Store or Play Store yet.
>   On an iPhone, install it with `eas go`. In the iOS Simulator or on Android, `npx expo start`
>   installs it for you.
> - **iOS 27:** builds made with Xcode 27 must use the UIKit scene life cycle. `app.json`
>   turns this on with `expo-build-properties` → `ios.enableSceneSupport`, which needs
>   `expo@57.0.23` or newer. SDK 58 does this by default, so remove the setting after upgrading.
>
> To move to a newer SDK later:
> ```bash
> npx expo install expo@latest
> npx expo install --fix
> ```
> Also update the version number in [`AGENTS.md`](AGENTS.md)'s doc link to match.

## Managing songs

Songs are managed entirely from the Supabase dashboard — **Table Editor > songs**. There's
no login or edit screen in the app itself. Each row has:

- `title`, `origin` — plain text
- `capo` — the capo position the chords below are written for (integer, 0 = no capo)
- `song` — the song body. Same format as the original RY Song Book app:
  - Chords are written inline right before the syllable they belong to: `[C]like this`
  - A `{...}label` block boxes a group of lines and shows a label in the corner. Everything
    right after the closing `}` up to the next line break becomes the label, verbatim — so
    it can be a repeat count (`}x2`, or just `}2`) or free text (`}Repeat twice`, `}Bridge`):
    ```
    {[C]Chorus line one
    [F]Chorus line two}Repeat twice
    ```
- `strumming_pattern` — optional, e.g. `D-DUDU`

See the two sample rows inserted by `schema.sql` for a working example. The app polls
Realtime, so changes made in the dashboard show up in the app within a few seconds without
needing to reinstall or restart it.

### Libraries

Songs are grouped into libraries (e.g. "ISGP BC", "BWC", a neighbourhood's own list). In the
app, people pick one or more libraries and see all of their songs together; "ISGP BC" is the
default. A song is stored once in `songs` and can be in any number of libraries.

- **Table Editor > libraries**: one row per library. `slug` is a unique, stable id (e.g.
  `bwc`; the app's default is `isgp-bc`, so don't rename that one), `name` is what the app
  shows, `description` is optional, and `sort_order` sets the order in the picker (lowest
  first).
- **Table Editor > library_songs**: one row per (library, song) pair. To add a song to a
  library, insert a row with that `library_id` and `song_id`. Deleting a song or a library
  removes its rows here automatically.

A new song shows up in the app's list only once it's in at least one library. Until then,
it can only be opened from a direct link. After adding songs, run this in the SQL Editor to
find any that aren't in a library yet:

```sql
select s.id, s.title, s.origin
from public.songs s
left join public.library_songs ls on ls.song_id = s.id
where ls.song_id is null
order by s.title;
```

To put songs in a library in bulk, for example every song with a given origin:

```sql
insert into public.library_songs (library_id, song_id)
select l.id, s.id
from public.libraries l, public.songs s
where l.slug = 'bwc' and s.origin = 'BWC'
on conflict do nothing;
```

### Checking the database is read-only

`scripts/check-rls.mjs` uses the anon key from `.env` to confirm the app can read `songs`,
`libraries` and `library_songs` but can't insert, update or delete them:

```bash
npm run check-rls
```

By default it only does reads, no-op updates (setting a field to its current value) and an
insert of a clearly labelled row (`RLS CHECK - safe to delete`). If that insert succeeds,
RLS is broken and the script prints the row's id so you can delete it in the dashboard.
`npm run check-rls -- --destructive` also tries deleting real rows. Run that **on a test
project only**. It requires `LIVE_SUPABASE_PROJECT_REF` in `.env` (see `.env.example`) and
refuses to run if `EXPO_PUBLIC_SUPABASE_URL` points at that project.

[`supabase/test-library.sql`](supabase/test-library.sql) seeds a second library for
testing. It's for test projects only. Never run it on the live database.

## Re-theming

All colors, spacing, and font tokens live in [`src/constants/theme.ts`](src/constants/theme.ts).
To change the app's look, edit the values there — components reference named tokens
(`colors.accent`, `spacing.md`, etc.), not raw hex codes or literal numbers, so a full
re-skin is a one-file change.

## Migrating songs from the old RY Song Book app

Since this app's `song` field uses the exact same format as the old CloudKit-based app, no
reformatting is needed — export existing records' `title`/`origin`/`song`/`capo`/
`strumming_pattern` fields and insert them as rows into the new `songs` table (via the SQL
Editor or Table Editor's CSV import).
