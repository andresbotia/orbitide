import { useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import type { LevelDefinition } from '@/game/engine/types';
import { thumbnailDataUri } from '@/game/studio/thumbnail';
import type { StudioLevel } from '@/game/studio/types';
import { studioTheme } from './theme';

/**
 * A cheap, deterministic level thumbnail — an inline SVG data URI, generated in
 * the browser from the level data. No backend, no 3D materials. `size` is the
 * box; the artwork letterboxes inside it.
 */
export function Thumbnail({ level, size = 56, markers = true }: {
  level: StudioLevel | LevelDefinition;
  size?: number;
  markers?: boolean;
}) {
  const uri = useMemo(() => thumbnailDataUri(level, { cell: 8, markers }), [level, markers]);
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <Image source={{ uri }} style={styles.img} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderColor: studioTheme.border,
    borderRadius: 4,
    backgroundColor: studioTheme.bg,
    overflow: 'hidden',
  },
  img: { width: '100%', height: '100%' },
});
