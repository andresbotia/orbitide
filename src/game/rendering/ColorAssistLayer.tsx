import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ColorAssistMark } from '@/components/ColorAssistMark';
import type { GameState } from '@/game/engine/types';
import { cellCenter, type BoardGeometry } from './boardGeometry';

interface ColorAssistLayerProps {
  state: GameState;
  geo: BoardGeometry;
  enabled: boolean;
}

/**
 * Top board layer for Color Assist marks (above pixels AND the special-pixel
 * shell layer). One consistently-inset mark per uncleared pixel, representing
 * its COLOUR. Cleared pixels drop out. Rendered only when the preference is on.
 */
export const ColorAssistLayer = memo(function ColorAssistLayer({ state, geo, enabled }: ColorAssistLayerProps) {
  if (!enabled) return null;
  const markSize = Math.max(6, geo.cell * 0.52);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {state.pixels.map((p) => {
        if (p.cleared) return null;
        const c = cellCenter(geo, p.x, p.y);
        return (
          <View key={p.id} style={[styles.mark, { left: c.x - markSize / 2, top: c.y - markSize / 2 }]}>
            <ColorAssistMark color={p.color} size={markSize} density={geo.density} />
          </View>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  mark: { position: 'absolute' },
});
