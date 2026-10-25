import { GlassView as ExpoGlassView, GlassStyle } from 'expo-glass-effect';
import React from 'react';
import { Platform, StyleProp, View, ViewStyle } from 'react-native';

interface GlassViewProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  glassEffectStyle?: GlassStyle;
  tintColor?: string;
  isInteractive?: boolean;
  /** Background applied on Android/web/pre-iOS26, where there's no real glass material. */
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
  if (Platform.OS === 'ios') {
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
