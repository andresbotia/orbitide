import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import {
  Rubik_400Regular,
  Rubik_500Medium,
  Rubik_600SemiBold,
  Rubik_700Bold,
  Rubik_800ExtraBold,
  Rubik_900Black,
} from '@expo-google-fonts/rubik';
import { PixelifySans_600SemiBold } from '@expo-google-fonts/pixelify-sans';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AV } from '@/theme/arcadiaV2';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Live wordmark font + the v2 UI faces (Rubik for all UI and numbers,
  // Pixelify Sans for tiny brand captions). The UI never blocks on them —
  // text falls back to the system face until they resolve — but we hold the
  // native splash a beat so the first frame is already branded.
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_700Bold,
    Rubik_400Regular,
    Rubik_500Medium,
    Rubik_600SemiBold,
    Rubik_700Bold,
    Rubik_800ExtraBold,
    Rubik_900Black,
    PixelifySans_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {/*
          UI-R7 transition language. `slide_from_right` on Home → Worlds →
          World Levels resolves to the platform default push on iOS (per
          react-native-screens — it's an Android-only override; iOS already
          uses its own fast native push) and is left without an explicit
          `animationDuration`, since that option only customises
          `fade`/`fade_from_bottom`/`slide_from_bottom`/`simple_push`. Back
          navigation automatically reverses whichever animation a screen
          pushed with — no separate "back" language to maintain.
          `game` gets its own `fade_from_bottom` ("entering the stage") at a
          deliberately short 280ms — the previous unconfigured `fade` default
          was iOS's own 500ms, over this milestone's target ceiling.
        */}
        <Stack
          screenOptions={{
            headerShown: false,
            // v2 shell blue, so Home ⇄ gameplay fades never flash dark navy.
            contentStyle: { backgroundColor: AV.shellBottom },
            animation: 'fade',
            animationDuration: 220,
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="shop" options={{ animation: 'fade', animationDuration: 220 }} />
          <Stack.Screen name="leaderboard" options={{ animation: 'fade', animationDuration: 220 }} />
          <Stack.Screen name="settings" options={{ animation: 'fade', animationDuration: 220 }} />
          <Stack.Screen name="worlds" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="world/[id]" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="game" options={{ animation: 'fade_from_bottom', animationDuration: 280 }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
