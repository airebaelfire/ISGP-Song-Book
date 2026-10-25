import React from 'react';
import { ColorValue, StyleSheet } from 'react-native';

import { Icon, IconName } from '@/components/icon';
import { Touchable } from '@/components/touchable';

interface IconButtonProps {
  name: IconName;
  onPress: () => void;
  color?: ColorValue;
  size?: number;
  haptic?: 'light' | 'selection' | 'none';
  disabled?: boolean;
  accessibilityLabel: string;
  hitSlop?: number;
}

/**
 * A fixed-size, centered tap target for an icon-only button. Wrapping the
 * icon in an explicit square box (rather than letting it size to its own
 * glyph bounds) is what actually guarantees consistent visual centering —
 * SF Symbols don't all report identical optical bounds, so centering
 * inside a box beats trying to center the glyph itself.
 */
export function IconButton({
  name,
  onPress,
  color,
  size = 24,
  haptic = 'light',
  disabled,
  accessibilityLabel,
  hitSlop = 10,
}: IconButtonProps) {
  // The tap target only needs to be a little bigger than the glyph itself —
  // hitSlop extends the actual touchable area beyond that without adding
  // visible empty space around the icon.
  const box = size + 8;
  return (
    <Touchable
      onPress={onPress}
      haptic={haptic}
      disabled={disabled}
      style={[styles.button, { width: box, height: box }]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={hitSlop}>
      <Icon name={name} color={color} size={size} />
    </Touchable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
