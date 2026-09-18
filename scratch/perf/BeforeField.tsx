import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ColorAssistMark } from '@/components/ColorAssistMark';
import { reachablePixels } from '@/game/engine/pixels';
import type { GameState } from '@/game/engine/types';
import { cellCenter, type BoardGeometry } from '@/game/rendering/boardGeometry';
import { Pixel } from '@/game/rendering/Pixel';

/**
 * The board layer exactly as it rendered before this pass: one `<Pixel>` subtree
 * per uncleared cell, a rebuilt `Set` of reachable ids per clear, and the
 * view-based Color Assist overlay. Kept only so the perf harness can measure
 * before and after through the identical code path.
 */
export const BeforeField = memo(function BeforeField({ state, geo, colorAssist }: {
  state: GameState; geo: BoardGeometry; colorAssist: boolean;
}) {
  const reachable = useMemo(
    () => new Set(reachablePixels(state).map((p) => p.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.pixels, state.width, state.height],
  );
  const markSize = Math.max(6, geo.cell * 0.52);

  return (
    <>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {state.pixels.map((p) => {
          if (p.cleared) return null;
          const c = cellCenter(geo, p.x, p.y);
          return (
            <Pixel
              key={p.id}
              color={p.color}
              cx={c.x}
              cy={c.y}
              cell={geo.cell}
              adaptive={geo.adaptive}
              modifierDim={0}
              reachable={reachable.has(p.id)}
            />
          );
        })}
      </View>
      {colorAssist ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {state.pixels.map((p) => {
            if (p.cleared) return null;
            const c = cellCenter(geo, p.x, p.y);
            return (
              <View key={p.id} style={{ position: 'absolute', left: c.x - markSize / 2, top: c.y - markSize / 2 }}>
                <ColorAssistMark color={p.color} size={markSize} density={geo.density} />
              </View>
            );
          })}
        </View>
      ) : null}
    </>
  );
});
