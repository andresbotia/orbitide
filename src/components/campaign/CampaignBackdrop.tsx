import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { material } from '@/theme/material';

interface CampaignBackdropProps {
  /**
   * A single world's accent, shown as a faint static wash (World Level
   * Select — the bridge between that world's destination card and its
   * gameplay environment). Omitted on World Select, which shows all worlds
   * at once and stays neutral.
   */
  worldAccent?: string;
}

/**
 * Shared Pixel Arcadia backdrop for World Select and World Level Select
 * (UI-R5) — one environment layer per screen, fully static (no shared
 * values, no canvas): a dark material gradient plus, optionally, one flat
 * low-opacity accent wash. Cheap by construction — these screens render at
 * most 10 items and shouldn't spend a frame budget on ambience.
 */
export const CampaignBackdrop = memo(function CampaignBackdrop({ worldAccent }: CampaignBackdropProps) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[material.elevatedBackground, material.background, material.background]}
        style={StyleSheet.absoluteFill}
      />
      {worldAccent ? (
        <View style={[styles.wash, { backgroundColor: worldAccent }]} />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wash: {
    position: 'absolute',
    top: -120,
    left: '-30%',
    width: '160%',
    aspectRatio: 1,
    borderRadius: 999,
    opacity: 0.06,
  },
});
