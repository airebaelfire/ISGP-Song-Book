import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  AccessibilityState,
  Animated,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';

import { colors } from '@/constants/theme';

interface TouchableProps {
  onPress?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * 'scale' (default) gives buttons/chips/icons a UIKit-style spring
   * scale + opacity dip. 'highlight' gives full-width rows a native
   * iOS list-cell tap: a gray tint fades in/out instead of scaling,
   * since scaling a full-width row would look wrong.
   */
  variant?: 'scale' | 'highlight';
  haptic?: 'light' | 'selection' | 'none';
  disabled?: boolean;
  accessibilityRole?: 'button' | 'checkbox';
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
  hitSlop?: number;
}

/**
 * Shared press interaction for the whole app: an animated, spring-eased
 * response to touch plus a light haptic tick — the same physical feel
 * UIKit/SwiftUI controls give for free, which plain `TouchableOpacity`'s
 * instant on/off opacity swap doesn't.
 */
export function Touchable({
  onPress,
  children,
  style,
  variant = 'scale',
  haptic = 'light',
  disabled,
  accessibilityRole,
  accessibilityLabel,
  accessibilityState,
  hitSlop,
}: TouchableProps) {
  const [scale] = useState(() => new Animated.Value(1));
  const [opacity] = useState(() => new Animated.Value(1));
  const [highlight] = useState(() => new Animated.Value(0));

  const animateTo = (toScale: number, toOpacity: number, toHighlight: number) => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: toScale,
        useNativeDriver: true,
        speed: 40,
        bounciness: 6,
      }),
      Animated.timing(opacity, {
        toValue: toOpacity,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(highlight, {
        toValue: toHighlight,
        duration: 90,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handlePressIn = () =>
    variant === 'highlight' ? animateTo(1, 1, 1) : animateTo(0.96, 0.7, 0);
  const handlePressOut = () => animateTo(1, 1, 0);

  const handlePress = () => {
    if (haptic !== 'none' && Platform.OS !== 'web') {
      if (haptic === 'selection') {
        Haptics.selectionAsync();
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
    onPress?.();
  };

  const backgroundColor = highlight.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(0,0,0,0)', colors.surfaceAlt],
  });

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      hitSlop={hitSlop}>
      <Animated.View
        style={[
          variant === 'scale' && styles.centered,
          style,
          variant === 'scale'
            ? { transform: [{ scale }], opacity }
            : { backgroundColor },
        ]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
