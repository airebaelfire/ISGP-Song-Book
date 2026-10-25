import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { colors } from '@/constants/theme';
import { SongsProvider } from '@/store/songs-context';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <SongsProvider>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: colors.background },
        }}>
        <Stack.Screen name="index" options={{ title: 'ISGP Song Book' }} />
        <Stack.Screen name="song/[id]" options={{ title: '' }} />
        <Stack.Screen name="random" options={{ title: 'Random Song', presentation: 'modal' }} />
      </Stack>
    </SongsProvider>
  );
}
