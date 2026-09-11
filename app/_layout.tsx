import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { brandColor } from '@/theme/brand';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Live wordmark font. The UI never blocks on it — the wordmark falls back to
  // the system bold face until it resolves — but we hold the native splash a
  // beat so the first frame is already branded.
  const [fontsLoaded, fontError] = useFonts({ SpaceGrotesk_700Bold });

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: brandColor.background },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="worlds" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="world/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="game" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
