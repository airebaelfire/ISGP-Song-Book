import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { Library, LibrarySong, Song, supabase } from '@/lib/supabase';
import {
  loadCachedData,
  loadSelection,
  saveCachedData,
  saveSelection,
  SongbookData,
} from '@/store/songs-cache';

/** Shown when nothing has been saved yet, or every saved library has since been removed. */
const DEFAULT_LIBRARY_SLUG = 'isgp-bc';
/** Realtime changes often arrive in bursts (e.g. adding a library and its songs); refetch once per burst. */
const REALTIME_DEBOUNCE_MS = 1000;
const PAGE_SIZE = 1000;

interface SongsContextValue {
  /** Every song, regardless of library — for opening a song by id/link. */
  allSongs: Song[];
  /** Songs in at least one selected library, once each, sorted by title. */
  songs: Song[];
  /** All libraries, in sort_order. Empty if library data has never loaded. */
  libraries: Library[];
  /** song count per library id. */
  librarySongCounts: Map<string, number>;
  /** Never empty while `libraries` is non-empty. */
  selectedLibraryIds: string[];
  /** Persists the selection. An empty (or entirely unknown) list is ignored. */
  setSelectedLibraryIds: (ids: string[]) => void;
  /** Adds or removes one library; removing the last selected one is a no-op. */
  toggleLibrary: (id: string) => void;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const SongsContext = createContext<SongsContextValue | null>(null);

const EMPTY_DATA: SongbookData = { allSongs: [], libraries: null, librarySongs: null };

/**
 * Reads every row of a table, page by page. PostgREST caps each response at
 * the project's max_rows (1000 by default), which would otherwise silently
 * truncate library_songs as libraries grow. `order` must make rows unique so
 * pages don't overlap.
 */
async function fetchAll<T>(
  table: string,
  order: string[]
): Promise<{ data: T[]; error: null } | { data: null; error: string }> {
  const rows: T[] = [];
  for (;;) {
    let query = supabase.from(table).select('*', { count: 'exact' });
    for (const column of order) query = query.order(column, { ascending: true });
    const { data, error, count } = await query.range(rows.length, rows.length + PAGE_SIZE - 1);
    if (error) return { data: null, error: error.message };
    rows.push(...((data ?? []) as T[]));
    // Stop on an empty page too, in case count is unavailable.
    if (!data || data.length === 0 || count === null || rows.length >= count) break;
  }
  return { data: rows, error: null };
}

/**
 * Single shared source of songs for the whole app: one fetch, one cache
 * write, one Realtime subscription — regardless of how many screens read
 * from it. Supabase Realtime errors if a second `postgres_changes`
 * listener is attached to an already-subscribed channel, which is what
 * happens if each screen opens its own subscription independently.
 *
 * All songs, libraries and memberships are fetched and cached together, and
 * library filtering happens on the device, so switching libraries is instant
 * and works offline.
 */
export function SongsProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<SongbookData>(EMPTY_DATA);
  const [savedSelection, setSavedSelection] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dataRef = useRef<SongbookData>(EMPTY_DATA);
  const loadedFromCache = useRef(false);
  const fetchedOnce = useRef(false);

  const applyData = useCallback((next: SongbookData) => {
    dataRef.current = next;
    setData(next);
  }, []);

  const fetchSongs = useCallback(async () => {
    const [songsResult, librariesResult, librarySongsResult] = await Promise.all([
      fetchAll<Song>('songs', ['title', 'id']),
      fetchAll<Library>('libraries', ['sort_order', 'name', 'id']),
      fetchAll<LibrarySong>('library_songs', ['library_id', 'song_id']),
    ]);

    if (songsResult.error !== null) {
      setError(songsResult.error);
      return;
    }

    fetchedOnce.current = true;
    const libraryError = librariesResult.error ?? librarySongsResult.error;
    // If library data fails to load, keep whatever library data we already
    // have (from cache or an earlier fetch) rather than dropping to "no
    // libraries", which would suddenly show every song.
    const next: SongbookData =
      libraryError === null
        ? {
            allSongs: songsResult.data,
            libraries: librariesResult.data,
            librarySongs: librarySongsResult.data,
          }
        : {
            allSongs: songsResult.data,
            libraries: dataRef.current.libraries,
            librarySongs: dataRef.current.librarySongs,
          };

    applyData(next);
    setError(libraryError);
    saveCachedData(next);
  }, [applyData]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchSongs();
    setLoading(false);
  }, [fetchSongs]);

  useEffect(() => {
    (async () => {
      if (!loadedFromCache.current) {
        loadedFromCache.current = true;
        const [cached, selection] = await Promise.all([loadCachedData(), loadSelection()]);
        setSavedSelection(selection);
        // A Realtime-triggered fetch may already have landed; don't clobber it.
        if (cached && !fetchedOnce.current) {
          applyData(cached);
          setLoading(false);
        }
      }
      await fetchSongs();
      setLoading(false);
    })();
  }, [applyData, fetchSongs]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefetch = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        fetchSongs();
      }, REALTIME_DEBOUNCE_MS);
    };

    // All listeners are attached before subscribe(), on one channel.
    const channel = supabase
      .channel('songs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'songs' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'libraries' }, scheduleRefetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'library_songs' }, scheduleRefetch)
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [fetchSongs]);

  const libraries = useMemo(() => data.libraries ?? [], [data.libraries]);

  // Derived, never written back: a fallback (first launch, or a saved library
  // that was deleted) mustn't overwrite the user's saved choice, in case it's
  // only a temporary state of the data.
  const selectedLibraryIds = useMemo(() => {
    if (libraries.length === 0) return [];
    const saved = new Set(savedSelection ?? []);
    const valid = libraries.filter((l) => saved.has(l.id)).map((l) => l.id);
    if (valid.length > 0) return valid;
    const fallback = libraries.find((l) => l.slug === DEFAULT_LIBRARY_SLUG) ?? libraries[0];
    return [fallback.id];
  }, [libraries, savedSelection]);

  const songs = useMemo(() => {
    // No library data at all (never loaded): show everything rather than nothing.
    if (libraries.length === 0) return data.allSongs;
    const selected = new Set(selectedLibraryIds);
    const visible = new Set<string>();
    for (const ls of data.librarySongs ?? []) {
      if (selected.has(ls.library_id)) visible.add(ls.song_id);
    }
    // allSongs is already ordered by title (from the query, or the cache of
    // it), and filtering it keeps that order and lists each song once.
    return data.allSongs.filter((s) => visible.has(s.id));
  }, [data.allSongs, data.librarySongs, libraries, selectedLibraryIds]);

  const librarySongCounts = useMemo(() => {
    const songIds = new Set(data.allSongs.map((s) => s.id));
    const counts = new Map<string, number>();
    for (const ls of data.librarySongs ?? []) {
      if (songIds.has(ls.song_id)) counts.set(ls.library_id, (counts.get(ls.library_id) ?? 0) + 1);
    }
    return counts;
  }, [data.allSongs, data.librarySongs]);

  const setSelectedLibraryIds = useCallback(
    (ids: string[]) => {
      const known = new Set(libraries.map((l) => l.id));
      const next = ids.filter((id) => known.has(id));
      if (next.length === 0) return;
      setSavedSelection(next);
      saveSelection(next);
    },
    [libraries]
  );

  const toggleLibrary = useCallback(
    (id: string) => {
      if (selectedLibraryIds.includes(id)) {
        if (selectedLibraryIds.length === 1) return;
        setSelectedLibraryIds(selectedLibraryIds.filter((s) => s !== id));
      } else {
        setSelectedLibraryIds([...selectedLibraryIds, id]);
      }
    },
    [selectedLibraryIds, setSelectedLibraryIds]
  );

  return (
    <SongsContext.Provider
      value={{
        allSongs: data.allSongs,
        songs,
        libraries,
        librarySongCounts,
        selectedLibraryIds,
        setSelectedLibraryIds,
        toggleLibrary,
        loading,
        error,
        refresh,
      }}>
      {children}
    </SongsContext.Provider>
  );
}

export function useSongs(): SongsContextValue {
  const context = useContext(SongsContext);
  if (!context) {
    throw new Error('useSongs must be used within a SongsProvider');
  }
  return context;
}
