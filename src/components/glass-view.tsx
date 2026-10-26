import {
  GlassView as ExpoGlassView,
  GlassStyle,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
} from 'expo-glass-effect';
import React from 'react';
import { Platform, StyleProp, View, ViewStyle } from 'react-native';

/**
 * Whether real Liquid Glass can be drawn: iOS 26+ only. On older iOS,
 * expo-glass-effect's GlassView renders as a bare transparent View (no
 * material, no tint), so callers must style a fallback instead. Also false on
 * the iOS 26 betas that lack the API, where using it can crash.
 */
export const hasLiquidGlass =
  Platform.OS === 'ios' && isLiquidGlassAvailable() && isGlassEffectAPIAvailable();

interface GlassViewProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  glassEffectStyle?: GlassStyle;
  tintColor?: string;
  isInteractive?: boolean;
  /** Background applied wherever there's no real glass material (see hasLiquidGlass). */
  fallbackBackgroundColor?: string;
}

/**
 * iOS 26+ "Liquid Glass" material, falling back to a plain tinted View
 * everywhere else (older iOS, Android, web) — expo-glass-effect's own
 * fallback is a bare passthrough View that would otherwise leak iOS-only
 * props onto react-native-web's DOM output as unknown attributes.
 */
export function GlassView({
  children,
  style,
  glassEffectStyle = 'regular',
  tintColor,
  isInteractive,
  fallbackBackgroundColor,
}: GlassViewProps) {
  if (hasLiquidGlass) {
    return (
      <ExpoGlassView
        glassEffectStyle={glassEffectStyle}
        tintColor={tintColor}
        isInteractive={isInteractive}
        style={style}>
        {children}
      </ExpoGlassView>
    );
  }
  return (
    <View style={[style, fallbackBackgroundColor ? { backgroundColor: fallbackBackgroundColor } : null]}>
      {children}
    </View>
  );
}
