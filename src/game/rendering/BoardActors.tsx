import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { reachablePixels } from '@/game/engine/pixels';
import type { GameState, ModifierInstance } from '@/game/engine/types';
import { ColorAssistLayer } from './ColorAssistLayer';
import { cellCenter, type BoardGeometry } from './boardGeometry';
import { Pixel } from './Pixel';
import { SpecialPixelLayer, type SpecialPixelInput } from './SpecialPixelLayer';
import { resolveModifier } from './specialPixels';

const EMPTY: Record<string, ModifierInstance> = {};

/**
 * The static pixel-art actor layer: board pixels, special-pixel shells, and
 * the Color Assist overlay. Shared verbatim by `OrbitBoard` (Legacy V1's
 * circular rail) and `CoreV2Board` (M5.3's rounded-rectangle rail) — the
 * rail shape never changes how the picture itself is drawn.
 */
export const BoardActors = memo(function BoardActors({ state, geo, colorAssist, reducedMotion, modifiers, shotPixelIds }: {
  state: GameState;
  geo: BoardGeometry;
  colorAssist: boolean;
  reducedMotion: boolean;
  modifiers?: Record<string, ModifierInstance>;
  /** Pixels an active flight will pop — rendered by that flight, not here. */
  shotPixelIds: Set<string>;
}) {
  const mods = modifiers ?? EMPTY;
  const reachable = useMemo(
    () => new Set(reachablePixels(state).map((p) => p.id)),
    // Flood-fill keys off pixels + board size, not the rest of GameState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.pixels, state.width, state.height],
  );

  const specials = useMemo<SpecialPixelInput[]>(() => {
    const list: SpecialPixelInput[] = [];
    for (const p of state.pixels) {
      // Engine truth first (Frozen updates `p.modifier` as ice cracks); the prop
      // is only a fallback for callers that drive modifiers externally.
      const modifier = p.modifier ?? mods[p.id];
      if (!p.cleared && modifier) list.push({ id: p.id, x: p.x, y: p.y, color: p.color, modifier });
    }
    return list;
  }, [state.pixels, mods]);

  const dimById = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of specials) {
      const r = resolveModifier(s.modifier, geo.density);
      const dim = Math.max(r.desaturate, r.concealment);
      if (dim > 0) map.set(s.id, dim);
    }
    return map;
  }, [specials, geo.density]);

  return (
    <>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {state.pixels.map((p) => {
          if (p.cleared || shotPixelIds.has(p.id)) return null;
          const c = cellCenter(geo, p.x, p.y);
          return (
            <Pixel
              key={p.id}
              color={p.color}
              cx={c.x}
              cy={c.y}
              cell={geo.cell}
              adaptive={geo.adaptive}
              modifierDim={dimById.get(p.id) ?? 0}
              reachable={reachable.has(p.id)}
            />
          );
        })}
      </View>

      <SpecialPixelLayer geo={geo} specials={specials} reducedMotion={reducedMotion} />
      <ColorAssistLayer state={state} geo={geo} enabled={colorAssist} />
    </>
  );
});
