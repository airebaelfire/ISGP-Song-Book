/**
 * Single source of truth for the app's look. To re-skin the app later,
 * change the values here — components consume these named tokens, not
 * raw hex codes or literal sizes. Defaults mirror iOS system colors so
 * the app reads as a native SwiftUI app out of the box.
 */
import { Platform } from 'react-native';

export const colors = {
  background: '#F2F2F7', // systemGroupedBackground
  surface: '#FFFFFF', // secondarySystemGroupedBackground
  surfaceAlt: '#E5E5EA', // systemGray5
  border: '#D1D1D6', // systemGray4
  separator: '#C6C6C8', // separator
  text: '#000000', // label
  textSecondary: '#8E8E93', // secondaryLabel
  textMuted: '#636366', // systemGray (dark); unlike textSecondary, meets 4.5:1 on background
  accent: '#007AFF', // systemBlue
  accentText: '#FFFFFF',
  accentSoft: '#E8F0FE', // light tint of accent, for badges on a white/light surface
  chip: '#E5E5EA',
  chipSelected: '#007AFF',
  chipText: '#3C3C43',
  chipSelectedText: '#FFFFFF',
  chord: '#007AFF',
  strumAccent: '#007AFF',
  danger: '#FF3B30', // systemRed
} as const;

export type ThemeColor = keyof typeof colors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

export const font = Platform.select({
  ios: { sans: 'System', mono: 'Menlo' },
  android: { sans: 'sans-serif', mono: 'monospace' },
  default: { sans: 'system-ui', mono: 'monospace' },
})!;

export const fontSize = {
  min: 10,
  default: 17,
  max: 32,
  step: 2,
} as const;

export const shadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
  },
  android: { elevation: 1 },
  default: {},
})!;
