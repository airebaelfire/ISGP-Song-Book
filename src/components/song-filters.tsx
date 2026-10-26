import React, { useEffect, useState } from 'react';
import { Animated, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GlassView } from '@/components/glass-view';
import { Touchable } from '@/components/touchable';
import { colors, radius, spacing } from '@/constants/theme';
import { FILTER_TABS, FilterTab, FilterValue } from '@/lib/song-format';

const TAB_LABELS: Record<FilterTab, string> = {
  origin: 'Origin',
  vibe: 'Vibe',
  difficulty: 'Difficulty',
};

interface SongFiltersProps {
  /** Chips per tab. A tab with none is hidden. */
  options: Record<FilterTab, FilterValue[]>;
  /** Selected chip keys per tab. */
  selected: Record<FilterTab, string[]>;
  onToggle: (tab: FilterTab, key: string) => void;
  /** The stored tab and chip visibility (see useFilterTabPrefs). */
  tab: FilterTab;
  chipsVisible: boolean;
  onPressTab: (tab: FilterTab, selectedTab: FilterTab) => void;
}

/**
 * Origin / Vibe / Difficulty tabs over one row of multi-select chips for the
 * selected tab. Tapping the selected tab hides or shows its chips. With only
 * one tab that has chips, the tab row is left out and its chips are always
 * shown, since there'd be no tab to tap to bring them back.
 */
export function SongFilters({ options, selected, onToggle, tab, chipsVisible, onPressTab }: SongFiltersProps) {
  const visibleTabs = FILTER_TABS.filter((t) => options[t].length > 0);
  if (visibleTabs.length === 0) return null;

  // Derived, never written back: the stored tab may only be hidden for now.
  const selectedTab = visibleTabs.includes(tab) ? tab : visibleTabs[0];
  const showTabs = visibleTabs.length > 1;
  const showChips = !showTabs || chipsVisible;
  const selectedKeys = selected[selectedTab];

  return (
    <View>
      {showTabs && (
        <View style={styles.tabRow} accessibilityRole="tablist">
          {visibleTabs.map((t) => {
            const isSelected = t === selectedTab;
            const activeCount = selected[t].length;
            const expanded = isSelected && chipsVisible;
            const label = [
              TAB_LABELS[t],
              activeCount > 0 && `${activeCount} active`,
              isSelected && (chipsVisible ? 'filters shown' : 'filters hidden'),
            ]
              .filter(Boolean)
              .join(', ');
            return (
              <View key={t} style={styles.tabCell}>
                <Touchable
                  onPress={() => onPressTab(t, selectedTab)}
                  haptic="selection"
                  accessibilityRole="tab"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: isSelected, expanded }}
                  style={styles.tab}>
                  <View style={styles.tabLabelRow}>
                    <Text
                      style={[styles.tabText, isSelected ? styles.tabTextSelected : styles.tabTextUnselected]}
                      numberOfLines={1}
                      maxFontSizeMultiplier={1.5}>
                      {TAB_LABELS[t]}
                    </Text>
                    {activeCount > 0 && <View style={styles.activeDot} />}
                  </View>
                  {expanded && <View style={styles.underline} />}
                </Touchable>
              </View>
            );
          })}
        </View>
      )}

      {showChips && (
        <ScrollView
          key={selectedTab}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scrollView}
          contentContainerStyle={styles.container}>
          {options[selectedTab].map((option) => (
            <Chip
              key={option.key}
              label={option.label}
              active={selectedKeys.includes(option.key)}
              onPress={() => onToggle(selectedTab, option.key)}
            />
          ))}
        </ScrollView>
      )}
    </View>
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
      <Touchable
        onPress={onPress}
        haptic="selection"
        accessibilityRole="button"
        accessibilityState={{ selected: active }}>
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
  const [progress] = useState(() => new Animated.Value(active ? 1 : 0));

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
    <Touchable
      onPress={onPress}
      haptic="selection"
      accessibilityRole="button"
      accessibilityState={{ selected: active }}>
      <Animated.View style={[styles.chip, { backgroundColor }]}>
        <Animated.Text style={[styles.chipText, active && styles.chipTextActive, { color: textColor }]}>
          {label}
        </Animated.Text>
      </Animated.View>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.separator,
  },
  tabCell: {
    flex: 1,
  },
  tab: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  tabLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  tabText: {
    fontSize: 13,
    textAlign: 'center',
    flexShrink: 1,
  },
  tabTextSelected: {
    fontWeight: '600',
    color: colors.text,
  },
  tabTextUnselected: {
    fontWeight: '500',
    color: colors.textMuted,
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.accent,
  },
  underline: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    // Sits over the row's separator line.
    bottom: -0.5,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.accent,
  },
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
