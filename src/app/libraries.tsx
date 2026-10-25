import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Touchable } from '@/components/touchable';
import { colors, radius, spacing } from '@/constants/theme';
import { useSongs } from '@/store/songs-context';

export default function LibrariesScreen() {
  const { libraries, librarySongCounts, selectedLibraryIds, toggleLibrary } = useSongs();
  const selected = new Set(selectedLibraryIds);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      {libraries.length === 0 ? (
        <Text style={styles.empty}>No libraries available.</Text>
      ) : (
        <>
          <View style={styles.card}>
            {libraries.map((library, i) => {
              const checked = selected.has(library.id);
              const count = librarySongCounts.get(library.id) ?? 0;
              return (
                <Touchable
                  key={library.id}
                  variant="highlight"
                  haptic="selection"
                  style={[styles.row, i < libraries.length - 1 && styles.rowDivider]}
                  onPress={() => toggleLibrary(library.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  accessibilityLabel={`${library.name}, ${count} ${count === 1 ? 'song' : 'songs'}`}>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{library.name}</Text>
                    {!!library.description && (
                      <Text style={styles.rowSubtitle}>{library.description}</Text>
                    )}
                    <Text style={styles.rowSubtitle}>
                      {count} {count === 1 ? 'song' : 'songs'}
                    </Text>
                  </View>
                  <View style={styles.check}>
                    {checked && <Icon name="checkmark" color={colors.accent} size={18} weight="semibold" />}
                  </View>
                </Touchable>
              );
            })}
          </View>
          <Text style={styles.footnote}>
            Select one or more libraries. Their songs are shown together. At least one library
            always stays selected.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  rowSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textSecondary,
  },
  check: {
    width: 24,
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  footnote: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    fontSize: 13,
    color: colors.textSecondary,
  },
  empty: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: spacing.xl,
  },
});
