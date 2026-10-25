import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/constants/theme';
import { useSongs } from '@/store/songs-context';

export default function RandomSongScreen() {
  const { songs, loading } = useSongs();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && songs.length > 0) {
      const song = songs[Math.floor(Math.random() * songs.length)];
      router.replace(`/song/${song.id}`);
    }
  }, [loading, songs, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.accent} />
      <Text style={styles.text}>Picking a song…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  text: {
    color: colors.textSecondary,
  },
});
