import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '@/constants/theme';
import { capoSemitoneShift, parseSong, transposeChord } from '@/lib/song-format';

interface SongDisplayProps {
  song: string;
  originalCapo: number;
  desiredCapo: number;
  fontSize: number;
  hideChords?: boolean;
}

export function SongDisplay({
  song,
  originalCapo,
  desiredCapo,
  fontSize,
  hideChords = false,
}: SongDisplayProps) {
  const segments = React.useMemo(() => parseSong(song), [song]);
  const semitones = capoSemitoneShift(originalCapo, desiredCapo);

  return (
    <View style={styles.container}>
      {segments.map((segment, segmentIndex) => {
        const content = (
          <View style={{ gap: spacing.sm }}>
            {segment.lines.map((line, lineIndex) => (
              <View key={lineIndex} style={styles.line}>
                {line.map((token, tokenIndex) => (
                  <View key={tokenIndex} style={styles.token}>
                    {!hideChords && token.chord !== null && (
                      <Text style={[styles.chord, { fontSize: fontSize * 0.85 }]}>
                        {token.chord.length > 0 ? transposeChord(token.chord, semitones) : ' '}
                      </Text>
                    )}
                    <Text style={[styles.lyrics, { fontSize }]}>{token.lyrics}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        );

        if (!segment.boxed) {
          return (
            <View key={segmentIndex} style={styles.plainSegment}>
              {content}
            </View>
          );
        }

        return (
          <View
            key={segmentIndex}
            style={[styles.boxedSegment, !!segment.label && styles.boxedSegmentWithLabel]}>
            {content}
            {segment.label && (
              <Text style={styles.label} numberOfLines={1}>
                {segment.label}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  plainSegment: {
    paddingHorizontal: spacing.xs,
  },
  boxedSegment: {
    borderRadius: radius.md,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  boxedSegmentWithLabel: {
    paddingTop: spacing.lg,
  },
  label: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.md,
    maxWidth: '70%',
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'right',
  },
  line: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  token: {
    flexDirection: 'column',
  },
  chord: {
    color: colors.chord,
    fontWeight: '700',
  },
  lyrics: {
    color: colors.text,
  },
});
