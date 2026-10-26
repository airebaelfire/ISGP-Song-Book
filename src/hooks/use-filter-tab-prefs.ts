import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { FILTER_TABS, FilterTab } from '@/lib/song-format';

const STORAGE_KEY = '@isgp-song-book/filter-tab';

interface FilterTabPrefs {
  tab: FilterTab;
  chipsVisible: boolean;
}

const DEFAULT_PREFS: FilterTabPrefs = { tab: 'origin', chipsVisible: true };

function isFilterTabPrefs(value: unknown): value is FilterTabPrefs {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return FILTER_TABS.includes(v.tab as FilterTab) && typeof v.chipsVisible === 'boolean';
}

/**
 * Which home screen filter tab is selected and whether its chip row is shown,
 * remembered across app launches. Which filters are active is deliberately
 * not remembered, so a hidden chip row can never hide a forgotten filter.
 * A missing or invalid stored value falls back to Origin, shown. `loaded` is
 * false until the stored value has been read, so callers can avoid briefly
 * showing a chip row the user had hidden.
 */
export function useFilterTabPrefs() {
  const [prefs, setPrefs] = useState<FilterTabPrefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === null) return;
        try {
          const parsed: unknown = JSON.parse(stored);
          if (isFilterTabPrefs(parsed)) {
            setPrefs({ tab: parsed.tab, chipsVisible: parsed.chipsVisible });
            return;
          }
        } catch {
          // fall through: discard below
        }
        AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  /**
   * Tapping `tab` (the tab currently shown as selected, which may differ from
   * the stored one when that's hidden): toggles the chips if it's selected,
   * otherwise selects it and shows its chips.
   */
  const pressTab = (tab: FilterTab, selectedTab: FilterTab) => {
    const next: FilterTabPrefs =
      tab === selectedTab ? { tab, chipsVisible: !prefs.chipsVisible } : { tab, chipsVisible: true };
    setPrefs(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  };

  return { tab: prefs.tab, chipsVisible: prefs.chipsVisible, loaded, pressTab };
}
