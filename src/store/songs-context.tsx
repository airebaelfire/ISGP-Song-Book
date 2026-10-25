import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { Song, supabase } from '@/lib/supabase';

const CACHE_KEY = '@isgp-song-book/songs-cache';

interface SongsContextValue {
  songs: Song[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const SongsContext = createContext<SongsContextValue | null>(null);

/**
 * Single shared source of songs for the whole app: one fetch, one cache
 * write, one Realtime subscription — regardless of how many screens read
 * from it. Supabase Realtime errors if a second `postgres_changes`
 * listener is attached to an already-subscribed channel, which is what
 * happens if each screen opens its own subscription independently.
 */
export function SongsProvider({ children }: { children: React.ReactNode }) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedFromCache = useRef(false);

  const fetchSongs = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('songs')
      .select('*')
      .order('title', { ascending: true });

    if (fetchError) {
      setError(fetchError.message);
      return;
    }

    setSongs(data ?? []);
    setError(null);
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data ?? [])).catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await fetchSongs();
    setLoading(false);
  }, [fetchSongs]);

  useEffect(() => {
    (async () => {
      if (!loadedFromCache.current) {
        loadedFromCache.current = true;
        try {
          const cached = await AsyncStorage.getItem(CACHE_KEY);
          if (cached) {
            setSongs(JSON.parse(cached));
            setLoading(false);
          }
        } catch {
          // ignore cache read errors, fall through to network fetch
        }
      }
      await fetchSongs();
      setLoading(false);
    })();
  }, [fetchSongs]);

  useEffect(() => {
    const channel = supabase
      .channel('songs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'songs' }, () => {
        fetchSongs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchSongs]);

  return (
    <SongsContext.Provider value={{ songs, loading, error, refresh }}>
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
