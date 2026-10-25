import { Ionicons } from '@expo/vector-icons';
import { SymbolView, SymbolViewProps } from 'expo-symbols';
import React from 'react';
import { ColorValue, StyleProp, ViewStyle } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';
import type { ComponentProps } from 'react';

/**
 * Cross-platform icon: real SF Symbols on iOS via `expo-symbols`; on
 * Android/web (where SF Symbols don't exist) `SymbolView` renders the
 * `fallback` node instead, which we fill with the closest Ionicon.
 * Add new icons to this map rather than passing raw symbol names around
 * the app.
 */
const ICONS = {
  search: { ios: 'magnifyingglass', ionicon: 'search' },
  shuffle: { ios: 'shuffle', ionicon: 'shuffle' },
  share: { ios: 'square.and.arrow.up', ionicon: 'share-outline' },
  plusCircle: { ios: 'plus.circle.fill', ionicon: 'add-circle' },
  minusCircle: { ios: 'minus.circle.fill', ionicon: 'remove-circle' },
  chevronUp: { ios: 'chevron.up', ionicon: 'chevron-up' },
  chevronDown: { ios: 'chevron.down', ionicon: 'chevron-down' },
  strumDown: { ios: 'chevron.down', ionicon: 'chevron-down' },
  strumUp: { ios: 'chevron.up', ionicon: 'chevron-up' },
  strumRest: { ios: 'line.3.horizontal', ionicon: 'reorder-three-outline' },
  eye: { ios: 'eye', ionicon: 'eye-outline' },
  eyeSlash: { ios: 'eye.slash', ionicon: 'eye-off-outline' },
  xCircle: { ios: 'x.circle', ionicon: 'close-circle-outline' },
  library: { ios: 'books.vertical', ionicon: 'library-outline' },
  checkmark: { ios: 'checkmark', ionicon: 'checkmark' },
} satisfies Record<string, { ios: SFSymbol; ionicon: ComponentProps<typeof Ionicons>['name'] }>;

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  color?: ColorValue;
  style?: StyleProp<ViewStyle>;
  weight?: SymbolViewProps['weight'];
}

export function Icon({ name, size = 20, color, style, weight }: IconProps) {
  const symbol = ICONS[name];
  return (
    <SymbolView
      name={symbol.ios}
      size={size}
      tintColor={color}
      weight={weight}
      // This SDK's native iOS module has no "size" prop handler at all —
      // the glyph always renders at a fixed native point size and is then
      // scaled to fit the view's frame. "scaleAspectFit" (the default,
      // stated explicitly here so it can't regress again) is what makes
      // our width/height below actually control the visible size, and it
      // centers non-square glyphs within that box for free.
      resizeMode="scaleAspectFit"
      fallback={<Ionicons name={symbol.ionicon} size={size} color={color as string} />}
      style={[{ width: size, height: size }, style]}
    />
  );
}
