import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { OrbColor } from '@/game/engine/types';
import { ORB_COLORS, isDefaultLegendColor } from '@/game/studio/grid';
import { orbColors, orbLabel } from '@/theme/colors';
import { studioTheme } from './theme';

interface PalettePanelProps {
  mode: 'paint' | 'erase';
  color: OrbColor;
  onSelectColor: (color: OrbColor) => void;
  onSelectErase: () => void;
}

/**
 * The real 15-colour gameplay palette (`OrbColor`) — no second palette. Colours
 * outside the shared default art legend are marked so the author knows the
 * export will carry an explicit `legend`.
 */
export function PalettePanel({ mode, color, onSelectColor, onSelectErase }: PalettePanelProps) {
  return (
    <View>
      <View style={styles.grid}>
        {ORB_COLORS.map((c) => {
          const active = mode === 'paint' && c === color;
          return (
            <Pressable
              key={c}
              onPress={() => onSelectColor(c)}
              accessibilityRole="button"
              accessibilityLabel={`Paint ${orbLabel[c]}`}
              style={[styles.swatch, { backgroundColor: orbColors[c] }, active && styles.swatchActive]}
            >
              {!isDefaultLegendColor(c) ? <Text style={styles.ext}>+</Text> : null}
            </Pressable>
          );
        })}
      </View>
      <Pressable
        onPress={onSelectErase}
        accessibilityRole="button"
        style={[styles.erase, mode === 'erase' && styles.eraseActive]}
      >
        <Text style={styles.eraseText}>{mode === 'erase' ? '● ERASE' : 'ERASE'}</Text>
      </Pressable>
      <Text style={styles.caption}>
        {mode === 'erase' ? 'Erasing cells' : orbLabel[color]}
        {mode === 'paint' && !isDefaultLegendColor(color) ? ' · needs legend entry' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  swatch: {
    width: 30,
    height: 30,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchActive: { borderColor: studioTheme.text },
  ext: { color: '#0009', fontSize: 13, fontWeight: '900' },
  erase: {
    marginTop: 8,
    paddingVertical: 6,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: studioTheme.borderStrong,
    alignItems: 'center',
  },
  eraseActive: { backgroundColor: studioTheme.panelAlt, borderColor: studioTheme.text },
  eraseText: { color: studioTheme.textDim, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  caption: { color: studioTheme.textFaint, fontSize: 10, marginTop: 6, fontFamily: studioTheme.mono },
});
