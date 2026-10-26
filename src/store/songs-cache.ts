import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Library, LibrarySong, Song } from '@/lib/supabase';

const CACHE_KEY = '@isgp-song-book/cache-v2';
/** Pre-libraries cache: a bare Song[]. Read once for migration, removed after the first v2 write. */
const LEGACY_CACHE_KEY = '@isgp-song-book/songs-cache';
const SELECTION_KEY = '@isgp-song-book/selected-libraries';

/**
 * Everything the app needs to work offline. `libraries`/`librarySongs` are
 * null when library data has never been loaded successfully (e.g. a legacy
 * cache, or a project where libraries.sql hasn't been applied yet) — which is
 * different from "loaded, and there are none".
 */
export interface SongbookData {
  allSongs: Song[];
  libraries: Library[] | null;
  librarySongs: LibrarySong[] | null;
}

interface CacheV2 {
  version: 2;
  songs: Song[];
  libraries: Library[] | null;
  librarySongs: LibrarySong[] | null;
}

// AsyncStorage contents are untrusted: written by an older app version,
// corrupted, or edited on a rooted device. Every field is checked before use.

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

/** For columns that may not exist yet (added after a release), so may be missing. */
function isOptionalStringOrNull(value: unknown): value is string | null | undefined {
  return value === undefined || isStringOrNull(value);
}

function isSong(value: unknown): value is Song {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    isStringOrNull(value.origin) &&
    typeof value.capo === 'number' &&
    typeof value.song === 'string' &&
    isStringOrNull(value.strumming_pattern) &&
    isOptionalStringOrNull(value.vibes) &&
    isOptionalStringOrNull(value.difficulty) &&
    typeof value.created_at === 'string' &&
    typeof value.updated_at === 'string'
  );
}

function isLibrary(value: unknown): value is Library {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.slug === 'string' &&
    typeof value.name === 'string' &&
    isStringOrNull(value.description) &&
    typeof value.sort_order === 'number'
  );
}

function isLibrarySong(value: unknown): value is LibrarySong {
  return isObject(value) && typeof value.library_id === 'string' && typeof value.song_id === 'string';
}

function isArrayOf<T>(value: unknown, guard: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every(guard);
}

function isCacheV2(value: unknown): value is CacheV2 {
  return (
    isObject(value) &&
    value.version === 2 &&
    isArrayOf(value.songs, isSong) &&
    (value.libraries === null || isArrayOf(value.libraries, isLibrary)) &&
    (value.librarySongs === null || isArrayOf(value.librarySongs, isLibrarySong)) &&
    // Library data is only ever written as a pair.
    (value.libraries === null) === (value.librarySongs === null)
  );
}

/** Parses a stored value, or returns undefined if it's missing, unparseable, or fails `guard`. */
async function readValidated<T>(key: string, guard: (value: unknown) => value is T): Promise<T | undefined> {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(key);
  } catch {
    return undefined;
  }
  if (raw === null) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (guard(parsed)) return parsed;
  } catch {
    // fall through: discard below
  }
  AsyncStorage.removeItem(key).catch(() => {});
  return undefined;
}

export async function loadCachedData(): Promise<SongbookData | null> {
  const cached = await readValidated(CACHE_KEY, isCacheV2);
  if (cached) {
    return { allSongs: cached.songs, libraries: cached.libraries, librarySongs: cached.librarySongs };
  }
  // First launch after updating from the pre-libraries version: keep showing
  // the old cached songs (with no libraries) until a fetch succeeds.
  const legacy = await readValidated(LEGACY_CACHE_KEY, (v): v is Song[] => isArrayOf(v, isSong));
  if (legacy) {
    return { allSongs: legacy, libraries: null, librarySongs: null };
  }
  return null;
}

export async function saveCachedData(data: SongbookData): Promise<void> {
  const cache: CacheV2 = {
    version: 2,
    songs: data.allSongs,
    libraries: data.libraries,
    librarySongs: data.librarySongs,
  };
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    return; // keep the legacy cache: it's still the only offline copy
  }
  AsyncStorage.removeItem(LEGACY_CACHE_KEY).catch(() => {});
}

export async function loadSelection(): Promise<string[] | null> {
  const ids = await readValidated(SELECTION_KEY, (v): v is string[] =>
    Array.isArray(v) && v.every((id) => typeof id === 'string')
  );
  return ids ?? null;
}

export function saveSelection(ids: string[]): void {
  AsyncStorage.setItem(SELECTION_KEY, JSON.stringify(ids)).catch(() => {});
}
