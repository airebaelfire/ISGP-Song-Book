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
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassView } from '@/components/glass-view';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { SongFilters } from '@/components/song-filters';
import { Touchable } from '@/components/touchable';
import { colors, radius, spacing } from '@/constants/theme';
import { useFilterTabPrefs } from '@/hooks/use-filter-tab-prefs';
import { useLibraryPillVisible } from '@/hooks/use-library-pill-visible';
import { buildFilterOptions, FILTER_TABS, FilterTab, songFilterValues } from '@/lib/song-format';
import { useSongs } from '@/store/songs-context';

const NO_FILTERS: Record<FilterTab, string[]> = { origin: [], vibe: [], difficulty: [] };

const LIBRARY_ICON_SIZE = 14;
const LIBRARY_CHEVRON_SIZE = 10;
const LIBRARY_PILL_PADDING_X = spacing.sm + 2;
// Everything in the pill except its label: horizontal padding, both icons and
// the two gaps between them and the text.
const LIBRARY_PILL_CHROME_WIDTH =
  LIBRARY_PILL_PADDING_X * 2 + LIBRARY_ICON_SIZE + LIBRARY_CHEVRON_SIZE + spacing.xs * 2;

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

// React Native doesn't re-measure existing Text when Dynamic Type changes while
// the app is open, so text is drawn at the new size inside its old, now too
// small boxes and gets clipped. Remounting the screen on a font scale change
// forces a fresh layout (search and filter state reset, which is rare enough).
export default function SongListRoot() {
  const { fontScale } = useWindowDimensions();
  return <SongListScreen key={fontScale} />;
}

function SongListScreen() {
  const { allSongs, songs, libraries, selectedLibraryIds, loading, error, refresh } = useSongs();
  const router = useRouter();
  const [search, setSearch] = React.useState('');
  // Chip selections, by key (see songFilterValues). Deliberately not
  // persisted: they reset on relaunch, so a hidden chip row can't hide a
  // filter the user forgot about.
  const [selectedFilters, setSelectedFilters] = React.useState(NO_FILTERS);
  const filterTab = useFilterTabPrefs();
  const [showAndroidSearch, setShowAndroidSearch] = React.useState(false);
  const androidSearchInputRef = React.useRef<TextInput>(null);

  // useSafeAreaInsets() must still be called unconditionally every render
  // (Rules of Hooks) — but react-native-safe-area-context recalculates
  // insets on every keyboard show/hide/frame-change event on iOS, and this
  // screen positions the floating search bar using these values. Stashing
  // the first value in state (never updated) freezes it, so the bar doesn't
  // visibly shift every time the keyboard's presence changes the reported inset.
  const liveInsets = useSafeAreaInsets();
  const [insets] = React.useState(liveInsets);

  // Separately, actually lift the search bar above the keyboard — driven
  // by the keyboard's own reported height (a one-shot value per show/hide
  // event), not by the reactive inset above, so it can't glitch the same way.
  const [keyboardOffset] = React.useState(() => new Animated.Value(0));

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

  // Chips only for values used by songs in the selected libraries.
  const filterOptions = React.useMemo(
    () => ({
      origin: buildFilterOptions(allSongs, songs, 'origin'),
      vibe: buildFilterOptions(allSongs, songs, 'vibe'),
      difficulty: buildFilterOptions(allSongs, songs, 'difficulty'),
    }),
    [allSongs, songs]
  );

  // After a library change or a data update, a selected chip may no longer
  // exist among the visible songs — drop it rather than filtering by
  // something that can't be seen or unselected. Adjusted during render when
  // the options change, rather than in an effect.
  const [prevFilterOptions, setPrevFilterOptions] = React.useState(filterOptions);
  if (filterOptions !== prevFilterOptions) {
    setPrevFilterOptions(filterOptions);
    const pruned = { ...selectedFilters };
    let changed = false;
    for (const tab of FILTER_TABS) {
      const keys = new Set(filterOptions[tab].map((o) => o.key));
      const kept = selectedFilters[tab].filter((k) => keys.has(k));
      if (kept.length !== selectedFilters[tab].length) {
        pruned[tab] = kept;
        changed = true;
      }
    }
    if (changed) setSelectedFilters(pruned);
  }

  const hasActiveFilters = FILTER_TABS.some((tab) => selectedFilters[tab].length > 0);
  const toggleFilter = (tab: FilterTab, key: string) =>
    setSelectedFilters((prev) => ({
      ...prev,
      [tab]: prev[tab].includes(key) ? prev[tab].filter((k) => k !== key) : [...prev[tab], key],
    }));

  const hasLibraryChoice = libraries.length > 1;
  const selectedNames = libraries.filter((l) => selectedLibraryIds.includes(l.id)).map((l) => l.name);

  // The library button shows/hides the pill (remembered across launches); the
  // pill itself is what opens the picker.
  const libraryPill = useLibraryPillVisible();
  const [pillProgress] = React.useState(() => new Animated.Value(1));
  // The row's natural height, measured while nothing constrains it: once known
  // (or whenever the pill starts hidden) the row is absolutely positioned inside
  // the animated container, so shrinking the container can't squash the row and
  // feed a smaller height back into the measurement, and Dynamic Type changes
  // are still picked up.
  const [pillHeight, setPillHeight] = React.useState(0);
  const pillRowFloating = pillHeight > 0 || !libraryPill.visible;
  const pillAnimationReady = React.useRef(false);
  // Apply the stored choice before first paint without animating, so a pill
  // the user hid doesn't flash on launch; animate every change after that.
  React.useLayoutEffect(() => {
    if (!libraryPill.loaded) return;
    const target = libraryPill.visible ? 1 : 0;
    if (!pillAnimationReady.current) {
      pillAnimationReady.current = true;
      pillProgress.setValue(target);
      return;
    }
    Animated.timing(pillProgress, {
      toValue: target,
      duration: 160,
      useNativeDriver: false,
    }).start();
  }, [libraryPill.loaded, libraryPill.visible, pillProgress]);

  // Pill label: all selected names joined with " + " if they fit on one line
  // in the space available, otherwise "N libraries". Decided by measuring an
  // invisible copy of the full label at the available width (so Dynamic Type
  // is accounted for), keyed by label, width and font scale so a stale
  // measurement is never used. Until the measurement for the current key
  // arrives, the count is shown, which avoids a flash of names that don't fit.
  // React Native doesn't re-measure existing text when Dynamic Type changes
  // while the app is open, so the measuring copy is remounted (keyed) instead.
  const { fontScale } = useWindowDimensions();
  const [libraryRowWidth, setLibraryRowWidth] = React.useState(0);
  const fullLibraryLabel = selectedNames.join(' + ');
  const countLibraryLabel = `${selectedNames.length} ${selectedNames.length === 1 ? 'library' : 'libraries'}`;
  const libraryLabelWidth = Math.max(0, libraryRowWidth - LIBRARY_PILL_CHROME_WIDTH);
  const libraryMeasureKey = `${fontScale}|${libraryLabelWidth}|${fullLibraryLabel}`;
  const [libraryLabelFit, setLibraryLabelFit] = React.useState<{ key: string; fits: boolean } | null>(
    null
  );
  const libraryLabel =
    libraryLabelFit?.key === libraryMeasureKey && libraryLabelFit.fits
      ? fullLibraryLabel
      : countLibraryLabel;

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const activeTabs = FILTER_TABS.filter((tab) => selectedFilters[tab].length > 0);
    return songs.filter((s) => {
      if (q && !s.title.toLowerCase().includes(q)) return false;
      // Any selected chip within a tab; every tab that has a selection.
      const values = songFilterValues(s);
      return activeTabs.every((tab) => values[tab].some((v) => selectedFilters[tab].includes(v.key)));
    });
  }, [songs, search, selectedFilters]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Static header block: title, filters — never scrolls. */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title} maxFontSizeMultiplier={1.5}>
            ISGP Song Book
          </Text>
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
            {hasLibraryChoice && libraryPill.loaded && (
              <IconButton
                name="library"
                onPress={libraryPill.toggle}
                color={libraryPill.visible ? colors.accent : colors.textSecondary}
                size={22}
                haptic="selection"
                accessibilityLabel={libraryPill.visible ? 'Hide libraries' : 'Show libraries'}
                accessibilityState={{ expanded: libraryPill.visible }}
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

        {hasLibraryChoice && libraryPill.loaded && (
          <Animated.View
            style={[
              styles.libraryCollapse,
              {
                opacity: pillProgress,
                // Until the row's natural height is known, size it by content
                // (or collapse it if it starts hidden; see pillRowFloating).
                height:
                  pillHeight > 0
                    ? pillProgress.interpolate({ inputRange: [0, 1], outputRange: [0, pillHeight] })
                    : libraryPill.visible
                      ? undefined
                      : 0,
              },
            ]}
            pointerEvents={libraryPill.visible ? 'auto' : 'none'}
            aria-hidden={!libraryPill.visible}>
            <View
              style={[styles.libraryRow, pillRowFloating && styles.libraryRowFloating]}
              onLayout={(e) => {
                setPillHeight(e.nativeEvent.layout.height);
                setLibraryRowWidth(e.nativeEvent.layout.width - spacing.lg * 2);
              }}>
              <Touchable
                onPress={() => router.push('/libraries')}
                haptic="light"
                accessibilityRole="button"
                accessibilityLabel={`Libraries: ${selectedNames.join(', ')}`}>
                <GlassView
                  glassEffectStyle="regular"
                  isInteractive
                  fallbackBackgroundColor={colors.surfaceAlt}
                  style={styles.libraryPill}>
                  <Icon name="library" color={colors.textSecondary} size={LIBRARY_ICON_SIZE} />
                  <Text style={styles.libraryPillText} numberOfLines={1}>
                    {libraryLabel}
                  </Text>
                  <Icon name="chevronDown" color={colors.textSecondary} size={LIBRARY_CHEVRON_SIZE} />
                </GlassView>
              </Touchable>

              {/* Invisible measuring copy of the full label (see libraryLabel). */}
              {libraryLabelWidth > 0 && (
                <Text
                  key={libraryMeasureKey}
                  style={[styles.libraryPillText, styles.libraryMeasure, { width: libraryLabelWidth }]}
                  onTextLayout={(e) =>
                    setLibraryLabelFit({ key: libraryMeasureKey, fits: e.nativeEvent.lines.length <= 1 })
                  }
                  pointerEvents="none"
                  accessible={false}
                  aria-hidden>
                  {fullLibraryLabel}
                </Text>
              )}
            </View>
          </Animated.View>
        )}

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

        {filterTab.loaded && (
          <SongFilters
            options={filterOptions}
            selected={selectedFilters}
            onToggle={toggleFilter}
            tab={filterTab.tab}
            chipsVisible={filterTab.chipsVisible}
            onPressTab={filterTab.pressTab}
          />
        )}

        {error && <Text style={styles.error}>{error}</Text>}
      </View>

      {/* Separate scrollable container for the list itself. */}
      <View style={styles.listContainer}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}>
          {filtered.length === 0 && !loading && hasActiveFilters ? (
            <View style={styles.emptyFilters}>
              <Text style={styles.emptyText}>No songs match these filters</Text>
              <Touchable onPress={() => setSelectedFilters(NO_FILTERS)} accessibilityRole="button">
                <Text style={styles.clearFilters}>Clear filters</Text>
              </Touchable>
            </View>
          ) : filtered.length === 0 && !loading ? (
            <Text style={[styles.emptyText, styles.empty]}>No songs found.</Text>
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
    flexShrink: 1,
    fontSize: 30,
    fontWeight: '700',
    color: colors.text,
  },
  titleActions: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  libraryCollapse: {
    overflow: 'hidden',
  },
  libraryRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
  },
  libraryRowFloating: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  libraryMeasure: {
    position: 'absolute',
    left: spacing.lg,
    top: 0,
    opacity: 0,
    flexShrink: 0,
  },
  libraryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: LIBRARY_PILL_PADDING_X,
    paddingVertical: 5,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  libraryPillText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    flexShrink: 1,
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
  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
  },
  empty: {
    marginTop: spacing.xl,
  },
  emptyFilters: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  clearFilters: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
