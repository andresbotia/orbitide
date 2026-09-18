import { memo, useCallback, useMemo } from 'react';

import { exteriorMask, isPixelReachable } from '@/game/engine/pixels';
import type { GameState, ModifierInstance, Pixel as BoardPixel } from '@/game/engine/types';
import { type BoardGeometry } from './boardGeometry';
import { SpecialPixelLayer, type SpecialPixelInput } from './SpecialPixelLayer';
import { StaticPixelField } from './StaticPixelField';
import { resolveModifier } from './specialPixels';

const EMPTY: Record<string, ModifierInstance> = {};
const EMPTY_SPECIALS: SpecialPixelInput[] = [];
const EMPTY_DIM_MAP: Map<string, number> = new Map();

/**
 * The static pixel-art actor layer: board pixels, special-pixel shells, and
 * the Color Assist marks. Shared verbatim by `OrbitBoard` (Legacy V1's
 * circular rail) and `CoreV2Board` (M5.3's rounded-rectangle rail) — the
 * rail shape never changes how the picture itself is drawn.
 *
 * The board itself is drawn by `StaticPixelField` as batched Skia paths rather
 * than one React view subtree per cell; see that file for the measurements that
 * motivated it. Color Assist marks ride in the same canvas for the same reason —
 * as views they cost another ~4 per uncleared pixel, which made late boards
 * unusable with the preference on.
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

  // The exterior flood fill, memoized in the engine by `state.pixels` identity.
  // Handing the field a predicate instead of a `Set` of ids keeps one array and
  // one Set per clear off the heap on a 770-cell board.
  const mask = useMemo(
    () => exteriorMask(state),
    // Reachability keys off pixels + board size, not the rest of GameState.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.pixels, state.width, state.height],
  );
  const isReachable = useCallback(
    (pixel: BoardPixel) => isPixelReachable(mask, pixel),
    [mask],
  );

  const specials = useMemo<SpecialPixelInput[]>(() => {
    const list: SpecialPixelInput[] = [];
    for (const p of state.pixels) {
      // Engine truth first (Frozen updates `p.modifier` as ice cracks); the prop
      // is only a fallback for callers that drive modifiers externally.
      const modifier = p.modifier ?? mods[p.id];
      if (!p.cleared && modifier) list.push({ id: p.id, x: p.x, y: p.y, color: p.color, modifier });
    }
    return list.length === 0 ? EMPTY_SPECIALS : list;
  }, [state.pixels, mods]);

  const dimById = useMemo(() => {
    if (specials.length === 0) return EMPTY_DIM_MAP;
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
      <StaticPixelField
        pixels={state.pixels}
        geo={geo}
        hiddenIds={shotPixelIds}
        dimById={dimById}
        isReachable={isReachable}
        colorAssist={colorAssist}
      />

      <SpecialPixelLayer geo={geo} specials={specials} reducedMotion={reducedMotion} />
    </>
  );
});
