import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { fontSize } from '@/constants/theme';

const STORAGE_KEY = '@isgp-song-book/font-size';

/** Font size for song display, remembered across app launches. */
export function useFontSize() {
  const [size, setSize] = useState<number>(fontSize.default);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored) setSize(Number(stored));
    });
  }, []);

  const update = (next: number) => {
    const clamped = Math.min(fontSize.max, Math.max(fontSize.min, next));
    setSize(clamped);
    AsyncStorage.setItem(STORAGE_KEY, String(clamped)).catch(() => {});
  };

  return {
    size,
    increase: () => update(size + fontSize.step),
    decrease: () => update(size - fontSize.step),
  };
}
