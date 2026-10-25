import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { colors, radius, spacing } from '@/constants/theme';

interface StrumPatternProps {
  pattern: string;
}

/** D = downstrum, U = upstrum, anything else = a rest, one slot per 8th note. */
export function StrumPattern({ pattern }: StrumPatternProps) {
  const beats = Array.from(pattern);

  return (
    <View style={styles.row}>
      {beats.map((beat, i) => (
        <View key={i} style={styles.beat}>
          <View style={styles.chip}>
            <Icon
              name={beat === 'D' ? 'strumDown' : beat === 'U' ? 'strumUp' : 'strumRest'}
              size={16}
              color={colors.strumAccent}
            />
          </View>
          <Text style={styles.label}>{i % 2 !== 0 ? '&' : String(i / 2 + 1)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  beat: {
    alignItems: 'center',
    gap: 2,
  },
  chip: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    color: colors.textSecondary,
  },
});
