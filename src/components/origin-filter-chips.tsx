import React, { useEffect, useRef } from 'react';
import { Animated, Platform, ScrollView, StyleSheet, Text } from 'react-native';

import { GlassView } from '@/components/glass-view';
import { Touchable } from '@/components/touchable';
import { colors, radius, spacing } from '@/constants/theme';

interface OriginFilterChipsProps {
  origins: string[];
  selected: string | null;
  onSelect: (origin: string | null) => void;
}

export function OriginFilterChips({ origins, selected, onSelect }: OriginFilterChipsProps) {
  if (origins.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scrollView}
      contentContainerStyle={styles.container}>
      <Chip label="All" active={selected === null} onPress={() => onSelect(null)} />
      {origins.map((origin) => (
        <Chip
          key={origin}
          label={origin}
          active={selected === origin}
          onPress={() => onSelect(selected === origin ? null : origin)}
        />
      ))}
    </ScrollView>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  if (Platform.OS === 'ios') {
    return (
      <Touchable onPress={onPress} haptic="selection" accessibilityRole="button">
        <GlassView
          glassEffectStyle="regular"
          tintColor={active ? colors.accent : undefined}
          isInteractive
          style={styles.chip}>
          <Text style={[styles.chipText, active ? styles.chipTextOnGlassActive : styles.chipTextOnGlass]}>
            {label}
          </Text>
        </GlassView>
      </Touchable>
    );
  }

  return <AnimatedChip label={label} active={active} onPress={onPress} />;
}

function AnimatedChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const progress = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: active ? 1 : 0,
      duration: 160,
      useNativeDriver: false,
    }).start();
  }, [active, progress]);

  const backgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.chip, colors.chipSelected],
  });
  const textColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.chipText, colors.chipSelectedText],
  });

  return (
    <Touchable onPress={onPress} haptic="selection" accessibilityRole="button">
      <Animated.View style={[styles.chip, { backgroundColor }]}>
        <Animated.Text style={[styles.chipText, active && styles.chipTextActive, { color: textColor }]}>
          {label}
        </Animated.Text>
      </Animated.View>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flexGrow: 0,
  },
  container: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  chipTextActive: {
    fontWeight: '600',
  },
  chipTextOnGlass: {
    color: colors.text,
  },
  chipTextOnGlassActive: {
    color: colors.accentText,
    fontWeight: '600',
  },
});
