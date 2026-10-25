import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const STORAGE_KEY = '@isgp-song-book/library-pill-visible';

/**
 * Whether the home screen's library pill is shown, remembered across app
 * launches. Visible by default; a missing or invalid stored value (anything
 * other than a JSON boolean) also falls back to visible. `loaded` is false
 * until the stored value has been read, so callers can avoid briefly showing
 * a pill the user had hidden.
 */
export function useLibraryPillVisible() {
  const [visible, setVisible] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === null) return;
        try {
          const parsed: unknown = JSON.parse(stored);
          if (typeof parsed === 'boolean') {
            setVisible(parsed);
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

  const toggle = () => {
    const next = !visible;
    setVisible(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  };

  return { visible, loaded, toggle };
}
