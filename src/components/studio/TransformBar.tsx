import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { OrbColor } from '@/game/engine/types';
import { ORB_COLORS } from '@/game/studio/grid';
import type { LevelStudio } from '@/hooks/useLevelStudio';
import { orbColors } from '@/theme/colors';
import { StudioButton } from './StudioButton';
import { studioTheme } from './theme';

/** Artwork transforms — mirror / rotate / replace-colour. Pure, undoable. */
export function TransformBar({ studio }: { studio: LevelStudio }) {
  const [from, setFrom] = useState<OrbColor | null>(null);
  const square = studio.level.width === studio.level.height;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <StudioButton label="Mirror ⇆" compact onPress={studio.mirrorH} />
        <StudioButton label="Mirror ⇅" compact onPress={studio.mirrorV} />
        <StudioButton label="Rotate 90°" compact disabled={!square} onPress={studio.rotate} />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Replace</Text>
        {ORB_COLORS.map((c) => (
          <Pressable
            key={c}
            style={[styles.swatch, { backgroundColor: orbColors[c] }, from === c && styles.swatchActive]}
            onPress={() => setFrom(from === c ? null : c)}
          />
        ))}
      </View>
      {from ? (
        <View style={styles.row}>
          <Text style={styles.label}>{from} →</Text>
          {ORB_COLORS.filter((c) => c !== from).map((c) => (
            <Pressable
              key={c}
              style={[styles.swatch, { backgroundColor: orbColors[c] }]}
              onPress={() => { studio.replaceColor(from, c); setFrom(null); }}
            />
          ))}
        </View>
      ) : null}
      {studio.transformWarning ? <Text style={styles.warn}>{studio.transformWarning}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  label: { color: studioTheme.textDim, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  swatch: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: 'transparent' },
  swatchActive: { borderColor: studioTheme.text },
  warn: { color: studioTheme.warning, fontSize: 10, fontFamily: studioTheme.mono },
});
