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
[`supabase/schema.sql`](supabase/schema.sql), and run it. This creates the `songs` table,
locks it down with Row Level Security (read-only from the app, writes only via the
dashboard), enables Realtime, and inserts two sample songs so you can verify things work
before importing your real song list.

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

> **Note:** this project is currently pinned to Expo SDK 56 rather than the latest release,
> because the SDK 57 update to the Expo Go app was still pending Apple App Store review at
> the time. Once that's approved, or if you're using a development build (EAS build) instead
> of Expo Go, you can move back to the latest SDK with:
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
