import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { StyleSheet } from 'react-native';

import { AV } from '@/theme/arcadiaV2';

const SHELL = [AV.shellTop, AV.shellMid, AV.shellBottom] as const;
const STOPS = [0, 0.55, 1] as const;

/**
 * M7A — v2 gameplay shell: a clear mid-tone arcade blue, #3159C9 → #203B8F.
 * Deliberately flat and fully static (no world ambience, no breathing glow):
 * the board well is the only deep surface, so the pixels, Pals and hits carry
 * the energy. Nothing here animates.
 */
export const GameplayEnvironment = memo(function GameplayEnvironment() {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={SHELL}
      locations={STOPS}
      style={StyleSheet.absoluteFill}
    />
  );
});
