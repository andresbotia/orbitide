import { Profiler, useCallback, useMemo, type ReactElement } from 'react';
import { act, create } from 'react-test-renderer';
import { LEVEL_DEFINITIONS } from '@/game/levels/levels';
import { createGame } from '@/game/engine/createGame';
import { exteriorMask, isPixelReachable } from '@/game/engine/pixels';
import { computeBoardGeometry } from '@/game/rendering/boardGeometry';
import { StaticPixelField } from '@/game/rendering/StaticPixelField';
import { BeforeField } from './BeforeField';
import type { GameState, Pixel } from '@/game/engine/types';

const EMPTY = new Set<string>();
const EMPTY_DIM = new Map<string, number>();
const N = 20;

function clearOne(state: GameState, i: number): GameState {
  const next = [...state.pixels];
  next[i] = { ...next[i]!, cleared: true };
  return { ...state, pixels: next };
}

function countNodes(n: any): number {
  if (!n || typeof n === 'string') return 0;
  if (Array.isArray(n)) return n.reduce((s, c) => s + countNodes(c), 0);
  return 1 + countNodes(n.children);
}

const def = LEVEL_DEFINITIONS.find((l) => l.id === 100)!;
const geoFor = (s: GameState) => computeBoardGeometry(360, s.width, s.height, {
  roundedRect: true, box: { width: 360, height: 360 },
});

function measure(label: string, Comp: (p: { st: GameState }) => ReactElement | null) {
  let state = createGame(def);
  let durations: number[] = [];
  const onRender = (_i: string, _p: string, actual: number) => { durations.push(actual); };
  const el = (s: GameState) => (
    <Profiler id="board" onRender={onRender}><Comp st={s} /></Profiler>
  );

  let tree!: ReturnType<typeof create>;
  act(() => { tree = create(el(state)); });
  const mountMs = durations[0] ?? 0;
  const nodes = countNodes(tree.toJSON());

  durations = [];
  for (let i = 0; i < N; i++) {
    state = clearOne(state, i);
    const cur = state;
    act(() => { tree.update(el(cur)); });
  }
  const perClear = durations.reduce((a, b) => a + b, 0) / durations.length;

  console.log(
    `[PERF] ${label} mountMs=${mountMs.toFixed(1)} nativeNodes=${nodes} perClearMs=${perClear.toFixed(2)}`,
  );
  tree.unmount();
}

const geo = geoFor(createGame(def));

const Before = ({ st }: { st: GameState }) => <BeforeField state={st} geo={geo} colorAssist={false} />;
const BeforeCA = ({ st }: { st: GameState }) => <BeforeField state={st} geo={geo} colorAssist />;

function After({ st, colorAssist }: { st: GameState; colorAssist: boolean }) {
  const mask = useMemo(() => exteriorMask(st), [st.pixels]);
  const isReachable = useCallback((p: Pixel) => isPixelReachable(mask, p), [mask]);
  return (
    <StaticPixelField
      pixels={st.pixels} geo={geo} hiddenIds={EMPTY} dimById={EMPTY_DIM}
      isReachable={isReachable} colorAssist={colorAssist}
    />
  );
}

test('board field: before vs after (Level 100, 770 pixels)', () => {
  measure('BEFORE  assist=off:', Before);
  measure('AFTER   assist=off:', ({ st }) => <After st={st} colorAssist={false} />);
  measure('BEFORE  assist=ON :', BeforeCA);
  measure('AFTER   assist=ON :', ({ st }) => <After st={st} colorAssist />);
});
