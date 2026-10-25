import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadow } from '@/constants/theme';

const CAPOS = Array.from({ length: 12 }, (_, i) => i);
const CONTAINER_PADDING = 2;
const CONTAINER_HEIGHT = 32;

interface CapoPickerProps {
  value: number;
  onChange: (capo: number) => void;
}

/** Mirrors a native iOS segmented control, including its sliding selection thumb. */
export function CapoPicker({ value, onChange }: CapoPickerProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  // onLayout reports the full border-box width; the segments live inside
  // the container's own padding.
  const segmentWidth = Math.max(0, containerWidth - CONTAINER_PADDING * 2) / CAPOS.length;
  const thumbPosition = useRef(new Animated.Value(value)).current;

  useEffect(() => {
    Animated.spring(thumbPosition, {
      toValue: value,
      useNativeDriver: true,
      speed: 30,
      bounciness: 8,
    }).start();
  }, [value, thumbPosition]);

  const translateX = thumbPosition.interpolate({
    inputRange: [0, CAPOS.length - 1],
    outputRange: [0, segmentWidth * (CAPOS.length - 1)],
  });

  return (
    <View style={styles.container} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      {containerWidth > 0 && (
        <>
          <Animated.View
            pointerEvents="none"
            style={[styles.thumb, { width: segmentWidth, transform: [{ translateX }] }]}
          />
          {/* Segments are positioned with transform: translateX rather than
              the `left` layout prop. `left` goes through Yoga's layout
              pass, which independently rounds each node to a physical
              pixel; `transform` (used by the thumb, for the slide
              animation) is applied later as a raw float with no such
              rounding. Using two different mechanisms for values that are
              supposed to line up exactly is what left them a pixel or so
              apart — same math, different rounding. */}
          {CAPOS.map((n) => (
            <Pressable
              key={n}
              style={[
                styles.segment,
                { width: segmentWidth, transform: [{ translateX: n * segmentWidth }] },
              ]}
              onPress={() => {
                if (Platform.OS !== 'web') Haptics.selectionAsync();
                onChange(n);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Capo ${n}`}>
              <Text style={[styles.text, n === value && styles.textActive]}>{n}</Text>
            </Pressable>
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: CONTAINER_HEIGHT,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: CONTAINER_PADDING,
  },
  thumb: {
    position: 'absolute',
    top: CONTAINER_PADDING,
    bottom: CONTAINER_PADDING,
    // Unlike CSS on web, React Native does not inset absolutely positioned
    // children by the parent's own padding — `left: 0` would sit flush
    // with the container's true edge, ignoring the 2px padding entirely.
    // That left the padding reserved on the right (where it's still part
    // of the container's own background) but not applied on the left,
    // which is why the gray background looked shifted right relative to
    // the thumb/segments/numbers. Offsetting the base by the padding
    // amount ourselves fixes that.
    left: CONTAINER_PADDING,
    backgroundColor: colors.surface,
    borderRadius: radius.sm - 2,
    ...shadow,
  },
  segment: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: CONTAINER_PADDING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 13,
    color: colors.textSecondary,
    // Proportionally-spaced digits (the default) don't all have the same
    // glyph width or optical centering — a "1" can look off-center in a
    // box that a "0" or "8" centers in perfectly, even though the box
    // itself is positioned identically. Tabular figures give every digit
    // the same fixed width, so centering is visually consistent for all of them.
    fontVariant: ['tabular-nums'],
  },
  textActive: {
    color: colors.text,
    fontWeight: '600',
  },
});
