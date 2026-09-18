import { Profiler, useCallback, useMemo } from 'react';
import { act, create } from 'react-test-renderer';
import { LEVEL_DEFINITIONS } from '@/game/levels/levels';
import { createGame } from '@/game/engine/createGame';
import { exteriorMask, isPixelReachable } from '@/game/engine/pixels';
import { computeBoardGeometry } from '@/game/rendering/boardGeometry';
import { StaticPixelField } from '@/game/rendering/StaticPixelField';
import { SpecialPixelLayer, type SpecialPixelInput } from '@/game/rendering/SpecialPixelLayer';
import type { GameState, Pixel } from '@/game/engine/types';
import * as skia from './stubs/skia';

const EMPTY = new Set<string>();
const EMPTY_DIM = new Map<string, number>();
const N = 20;

function clearOne(state: GameState, i: number): GameState {
  const next = [...state.pixels];
  next[i] = { ...next[i]!, cleared: true };
  return { ...state, pixels: next };
}

test('isolate layers', () => {
  const def = LEVEL_DEFINITIONS.find((l) => l.id === 100)!;
  const base = createGame(def);
  const geo = computeBoardGeometry(360, base.width, base.height, {
    roundedRect: true, box: { width: 360, height: 360 },
  });
  console.log(`[INFO] level 100: ${base.pixels.length} pixels, ${base.pixels.filter((p) => p.modifier).length} with modifiers`);

  const measure = (label: string, Comp: (p: { st: GameState }) => any) => {
    let durations: number[] = [];
    const onRender = (_i: string, _p: string, a: number) => { durations.push(a); };
    const el = (s: GameState) => <Profiler id="x" onRender={onRender}><Comp st={s} /></Profiler>;
    let tree!: ReturnType<typeof create>;
    skia.resetSkiaOps();
    act(() => { tree = create(el(base)); });
    const mount = durations[0] ?? 0;
    const mountOps = skia.SKIA_PATH_OPS;
    durations = [];
    skia.resetSkiaOps();
    let s = base;
    for (let i = 0; i < N; i++) { s = clearOne(s, i); const c = s; act(() => { tree.update(el(c)); }); }
    const per = durations.reduce((a, b) => a + b, 0) / durations.length;
    console.log(`[ISO] ${label}: mountMs=${mount.toFixed(1)} mountOps=${mountOps} perClearMs=${per.toFixed(2)} opsPerClear=${(skia.SKIA_PATH_OPS / N).toFixed(0)}`);
    tree.unmount();
  };

  const Field = ({ st }: { st: GameState }) => {
    const mask = useMemo(() => exteriorMask(st), [st.pixels]);
    const isReachable = useCallback((p: Pixel) => isPixelReachable(mask, p), [mask]);
    return <StaticPixelField pixels={st.pixels} geo={geo} hiddenIds={EMPTY} dimById={EMPTY_DIM} isReachable={isReachable} colorAssist={false} />;
  };
  measure('StaticPixelField alone ', Field);

  const Specials = ({ st }: { st: GameState }) => {
    const specials = useMemo<SpecialPixelInput[]>(() => {
      const list: SpecialPixelInput[] = [];
      for (const p of st.pixels) if (!p.cleared && p.modifier) list.push({ id: p.id, x: p.x, y: p.y, color: p.color, modifier: p.modifier });
      return list;
    }, [st.pixels]);
    return <SpecialPixelLayer geo={geo} specials={specials} reducedMotion={false} />;
  };
  measure('SpecialPixelLayer alone', Specials);
});
