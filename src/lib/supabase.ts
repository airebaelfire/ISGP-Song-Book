import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env and fill in your Supabase project details.'
  );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

/** A row from the `songs` table. Read-only from the app — songs are managed via Supabase Studio. */
export interface Song {
  id: string;
  title: string;
  origin: string | null;
  capo: number;
  song: string;
  strumming_pattern: string | null;
  /**
   * Comma-separated values, e.g. "Hype, Mellow" (see parseTagList). Optional:
   * undefined until supabase/tags.sql has been run, or in an older cache.
   */
  vibes?: string | null;
  /** Comma-separated values, e.g. "Easy chords, No capo". Same as `vibes`. */
  difficulty?: string | null;
  created_at: string;
  updated_at: string;
}

/** A row from the `libraries` table: a named list of songs (e.g. "ISGP BC"). */
export interface Library {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
}

/** A row from the `library_songs` join table: one song's membership in one library. */
export interface LibrarySong {
  library_id: string;
  song_id: string;
}
