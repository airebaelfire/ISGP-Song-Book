import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useRef } from 'react';
import {
  Animated,
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CapoPicker } from '@/components/capo-picker';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { SongDisplay } from '@/components/song-display';
import { StrumPattern } from '@/components/strum-pattern';
import { Touchable } from '@/components/touchable';
import { colors, radius, spacing } from '@/constants/theme';
import { useFontSize } from '@/hooks/use-font-size';
import { shareViewAsImage } from '@/lib/share-image';
import { useSongs } from '@/store/songs-context';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function SongDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { songs } = useSongs();
  const song = songs.find((s) => s.id === id);
  const [desiredCapo, setDesiredCapo] = React.useState(song?.capo ?? 0);
  const [showCapoPicker, setShowCapoPicker] = React.useState(false);
  const [showStrum, setShowStrum] = React.useState(false);
  const [hideChords, setHideChords] = React.useState(false);
  const fontSize = useFontSize();
  const captureRef_ = useRef<View>(null);
  const [sharing, setSharing] = React.useState(false);
  const chevronRotation = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (song) setDesiredCapo(song.capo);
  }, [song?.id]);

  const toggleCapoPicker = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.spring(chevronRotation, {
      toValue: showCapoPicker ? 0 : 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
    setShowCapoPicker((v) => !v);
  };

  const toggleStrum = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowStrum((v) => !v);
  };

  const share = async () => {
    if (!captureRef_.current) return;
    try {
      setSharing(true);
      await shareViewAsImage(captureRef_, `${song?.title ?? 'song'}.png`);
    } finally {
      setSharing(false);
    }
  };

  if (!song) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>Song not found.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: '',
          headerBackButtonDisplayMode: 'minimal',
        }}
      />

      {/* Plain icon in the corner — deliberately not a header button, since
          native header buttons get an automatic glass background on iOS 26. */}
      <View style={styles.hideChordsOverlay}>
        <IconButton
          name={hideChords ? 'eyeSlash' : 'eye'}
          onPress={() => setHideChords((v) => !v)}
          color={colors.accent}
          size={22}
          haptic="selection"
          accessibilityLabel={hideChords ? 'Show chords' : 'Hide chords'}
        />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View ref={captureRef_} collapsable={false} style={styles.captureArea}>
          <Text style={styles.title}>{song.title}</Text>
          {!!song.origin && <Text style={styles.origin}>{song.origin}</Text>}
          <View style={styles.capoBadge}>
            <Text style={styles.capoBadgeText}>Capo {song.capo}</Text>
          </View>

          {!!song.strumming_pattern && (
            <View style={styles.strumSection}>
              <Touchable
                variant="scale"
                haptic="none"
                style={styles.strumToggle}
                onPress={toggleStrum}
                accessibilityRole="button"
                accessibilityLabel={showStrum ? 'Hide strumming pattern' : 'Show strumming pattern'}>
                <Text style={styles.strumToggleLabel}>Strumming Pattern</Text>
                <Icon name={showStrum ? 'chevronUp' : 'chevronDown'} color={colors.textSecondary} size={12} />
              </Touchable>
              {showStrum && (
                <View style={styles.strumContent}>
                  <StrumPattern pattern={song.strumming_pattern} />
                </View>
              )}
            </View>
          )}

          <View style={styles.songContent}>
            <SongDisplay
              song={song.song}
              originalCapo={song.capo}
              desiredCapo={desiredCapo}
              fontSize={fontSize.size}
              hideChords={hideChords}
            />
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <Touchable
          style={styles.disclosure}
          onPress={toggleCapoPicker}
          haptic="none"
          accessibilityRole="button"
          accessibilityLabel="Toggle capo transpose">
          <Animated.View
            style={{
              transform: [
                {
                  rotate: chevronRotation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '180deg'],
                  }),
                },
              ],
            }}>
            <Icon name="chevronUp" color={colors.textSecondary} size={18} />
          </Animated.View>
        </Touchable>

        {showCapoPicker && (
          <View style={styles.capoPickerWrap}>
            <Text style={styles.capoPickerLabel}>Transpose to capo</Text>
            <CapoPicker value={desiredCapo} onChange={setDesiredCapo} />
          </View>
        )}

        <View style={styles.actionsRow}>
          <IconButton
            name="share"
            onPress={share}
            disabled={sharing}
            color={colors.accent}
            size={28}
            accessibilityLabel="Share as image"
          />
          <View style={styles.spacer} />
          <View style={styles.fontStepper}>
            <IconButton
              name="minusCircle"
              onPress={fontSize.decrease}
              haptic="selection"
              color={colors.accent}
              size={28}
              accessibilityLabel="Decrease font size"
            />
            <IconButton
              name="plusCircle"
              onPress={fontSize.increase}
              haptic="selection"
              color={colors.accent}
              size={28}
              accessibilityLabel="Increase font size"
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hideChordsOverlay: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.sm,
    zIndex: 10,
  },
  notFound: {
    color: colors.textSecondary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  captureArea: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  origin: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  capoBadge: {
    alignSelf: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  capoBadgeText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accent,
  },
  strumSection: {
    marginTop: spacing.xs,
    alignItems: 'center',
  },
  strumToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  strumToggleLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  strumContent: {
    marginTop: spacing.sm,
  },
  songContent: {
    marginTop: spacing.lg,
  },
  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  disclosure: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  capoPickerWrap: {
    paddingBottom: spacing.sm,
  },
  capoPickerLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.xs,
  },
  spacer: {
    flex: 1,
  },
  fontStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
