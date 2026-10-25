import { Stack, useRouter } from 'expo-router';
import React from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  KeyboardEventEasing,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassView } from '@/components/glass-view';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { OriginFilterChips } from '@/components/origin-filter-chips';
import { Touchable } from '@/components/touchable';
import { colors, radius, spacing } from '@/constants/theme';
import { useSongs } from '@/store/songs-context';

// iOS reports the keyboard's own animation curve on each show/hide event.
// The previous code ignored it and always animated with Animated.timing's
// default Easing.inOut(ease), which front-loads slowly — next to the
// keyboard's own (much snappier) curve that reads as visibly lagging behind
// it. Mapping the reported curve onto a matching Easing keeps the bar synced.
function nativeKeyboardEasing(curve: KeyboardEventEasing | undefined) {
  switch (curve) {
    case 'easeIn':
      return Easing.in(Easing.ease);
    case 'easeOut':
      return Easing.out(Easing.ease);
    case 'linear':
      return Easing.linear;
    case 'easeInEaseOut':
    case 'keyboard':
    default:
      // iOS keyboard events almost always report "keyboard", its custom
      // UIKit curve — Easing.out(quad) is the closest standard approximation
      // (fast start, gentle settle) and reads far closer to the real motion
      // than the inOut default.
      return Easing.out(Easing.quad);
  }
}

export default function SongListScreen() {
  const { songs, loading, error, refresh } = useSongs();
  const router = useRouter();
  const [search, setSearch] = React.useState('');
  const [origin, setOrigin] = React.useState<string | null>(null);
  const [showAndroidSearch, setShowAndroidSearch] = React.useState(false);
  const androidSearchInputRef = React.useRef<TextInput>(null);

  // useSafeAreaInsets() must still be called unconditionally every render
  // (Rules of Hooks) — but react-native-safe-area-context recalculates
  // insets on every keyboard show/hide/frame-change event on iOS, and this
  // screen positions the floating search bar using these values. Stashing
  // the first value in a ref freezes it, so the bar doesn't visibly shift
  // every time the keyboard's presence changes the reported inset.
  const liveInsets = useSafeAreaInsets();
  const insets = React.useRef(liveInsets).current;

  // Separately, actually lift the search bar above the keyboard — driven
  // by the keyboard's own reported height (a one-shot value per show/hide
  // event), not by the reactive inset above, so it can't glitch the same way.
  const keyboardOffset = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const onShow = Keyboard.addListener('keyboardWillShow', (e) => {
      const shift = e.endCoordinates.height - insets.bottom + spacing.sm;
      Animated.timing(keyboardOffset, {
        toValue: -shift,
        duration: e.duration || 250,
        easing: nativeKeyboardEasing(e.easing),
        useNativeDriver: true,
      }).start();
    });
    const onHide = Keyboard.addListener('keyboardWillHide', (e) => {
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: e.duration || 250,
        easing: nativeKeyboardEasing(e.easing),
        useNativeDriver: true,
      }).start();
    });
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [insets.bottom, keyboardOffset]);

  const origins = React.useMemo(
    () =>
      Array.from(new Set(songs.map((s) => s.origin).filter((o): o is string => !!o))).sort(),
    [songs]
  );

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return songs.filter((s) => {
      if (origin && s.origin !== origin) return false;
      if (q && !s.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [songs, search, origin]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Static header block: title, filters — never scrolls. */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>ISGP Song Book</Text>
          <View style={styles.titleActions}>
            {Platform.OS === 'android' && (
              <IconButton
                name="search"
                onPress={() => {
                  setShowAndroidSearch((v) => {
                    const next = !v;
                    if (next) {
                      requestAnimationFrame(() => androidSearchInputRef.current?.focus());
                    } else {
                      setSearch('');
                    }
                    return next;
                  });
                }}
                color={colors.accent}
                size={22}
                accessibilityLabel={showAndroidSearch ? 'Hide search' : 'Search songs'}
              />
            )}
            <IconButton
              name="shuffle"
              onPress={() => router.push('/random')}
              color={colors.accent}
              size={22}
              accessibilityLabel="Random song"
            />
          </View>
        </View>

        {Platform.OS === 'android' && showAndroidSearch && (
          <View style={styles.androidSearchRow}>
            <Icon name="search" color={colors.textSecondary} size={18} />
            <TextInput
              ref={androidSearchInputRef}
              value={search}
              onChangeText={setSearch}
              placeholder="Search songs"
              placeholderTextColor={colors.textSecondary}
              style={styles.searchInput}
              autoCorrect={false}
              autoFocus
            />
            <IconButton
              name="xCircle"
              onPress={() => {
                setSearch('');
                setShowAndroidSearch(false);
              }}
              color={colors.textSecondary}
              size={18}
              accessibilityLabel="Close search"
            />
          </View>
        )}

        <OriginFilterChips origins={origins} selected={origin} onSelect={setOrigin} />

        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      {/* Separate scrollable container for the list itself. */}
      <View style={styles.listContainer}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}>
          {filtered.length === 0 && !loading ? (
            <Text style={styles.empty}>No songs found.</Text>
          ) : (
            <View style={styles.card}>
              {filtered.map((song, i) => (
                <Touchable
                  key={song.id}
                  variant="highlight"
                  haptic="none"
                  style={[styles.row, i < filtered.length - 1 && styles.rowDivider]}
                  onPress={() => router.push(`/song/${song.id}`)}
                  accessibilityRole="button">
                  <Text style={styles.rowTitle}>{song.title}</Text>
                  {!!song.origin && <Text style={styles.rowSubtitle}>{song.origin}</Text>}
                </Touchable>
              ))}
            </View>
          )}
        </ScrollView>
      </View>

      {/* Floating search bar, liquid glass, docked near the bottom.
          Android excluded — its search now lives in the top bar (behind
          the search icon button above), since Android already resizes the
          window for the keyboard on its own. Resting position is fixed to
          a frozen inset value so it never glitches on keyboard events;
          keyboardOffset separately lifts it above the keyboard when one
          actually appears (iOS only). */}
      {Platform.OS !== 'android' && (
        <Animated.View
          style={[
            styles.searchWrapper,
            {
              bottom: insets.bottom - 10,
              transform: [{ translateY: keyboardOffset }],
            },
          ]}>
          <GlassView
            glassEffectStyle="regular"
            isInteractive
            fallbackBackgroundColor={colors.surfaceAlt}
            style={styles.searchRow}>
            <Icon name="search" color={colors.textSecondary} size={18} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search songs"
              placeholderTextColor={colors.textSecondary}
              style={styles.searchInput}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </GlassView>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.background,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.text,
  },
  titleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  androidSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  listContainer: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl + spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.separator,
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
  empty: {
    textAlign: 'center',
    color: colors.textSecondary,
    marginTop: spacing.xl,
  },
  error: {
    color: colors.danger,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  searchWrapper: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  searchInput: {
    flex: 1,
    fontSize: 17,
    color: colors.text,
    padding: 0,
  } as never,
});
