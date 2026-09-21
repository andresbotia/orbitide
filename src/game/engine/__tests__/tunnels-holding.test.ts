import { createGame } from '../createGame';
import { resolveArrival } from '../holdingArrival';
import { CORE_V2_TUNNEL_COUNT, expectedTunnelCount, LEGACY_TUNNEL_COUNT } from '../ruleset';
import {
  holdingWarnAt,
  upcomingPreviewCount,
  visibleTunnelWindow,
  VISIBLE_TUNNEL_ENTRIES,
} from '../selectors';
import { resolveAction } from '../resolveLaunch';
import { resolveHoldingLaunch } from '../resolveHolding';
import type { ChargeSpec, LevelDefinition, OrbColor } from '../types';
import { fromLevelDefinition, toLevelDefinition } from '@/game/studio/serialize';
import { createBlankLevel } from '@/game/studio/model';
import { validateStudioLevel } from '@/game/studio/validate';
import { normalizeAuthoredLevel } from '@/game/levels/authoring/normalize';
import { validateLevelStructure } from '@/game/levels/authoring/validate';
import { LEVEL_DEFINITIONS } from '@/game/levels/levelDefinitions';
import { buildLaunchScript } from '@/game/presentation/buildScript';

function queue(specs: { color: OrbColor; capacity: number }[]): ChargeSpec[] {
  return specs.map((s) => ({ color: s.color, capacity: s.capacity }));
}

const v2 = (
  extra: Partial<LevelDefinition> & { pixelArt?: string[] } = {},
): LevelDefinition => {
  const tunnels = [...(extra.tunnels ?? [[], [], [], []])];
  while (tunnels.length < 4) tunnels.push([]);
  return {
    id: extra.id ?? 8500,
    title: extra.title ?? 'TunnelsHolding',
    themeId: 'test',
    difficulty: 'easy',
    pixelArt: extra.pixelArt ?? ['WWW', 'WWW', 'WWW'],
    ...extra,
    tunnels,
    holdingCapacity: extra.holdingCapacity ?? 4,
    ruleset: extra.ruleset ?? 'coreV2',
  };
};

const T = (i: number) => ({ kind: 'tunnel' as const, id: `tunnel-${i}` });

describe('Core V2 tunnel count', () => {
  test('a 4-tunnel Core V2 definition is accepted', () => {
    const state = createGame(v2({
      tunnels: [[{ color: 'white', capacity: 1 }], [], [], []],
    }));
    expect(state.tunnels).toHaveLength(CORE_V2_TUNNEL_COUNT);
    expect(expectedTunnelCount('coreV2')).toBe(4);
  });

  test('a 3-tunnel Core V2 definition is rejected', () => {
    expect(() => createGame({
      id: 8501, title: 'Bad', themeId: 'test', difficulty: 'easy', holdingCapacity: 4,
      pixelArt: ['W'], ruleset: 'coreV2',
      tunnels: [[{ color: 'white', capacity: 1 }], [], []],
    })).toThrow(/expected exactly 4 tunnels/);
    const res = validateLevelStructure({
      id: 8501, title: 'Bad', themeId: 'test', difficulty: 'easy', holdingCapacity: 4,
      pixelArt: ['W'], ruleset: 'coreV2',
      tunnels: [[{ color: 'white', capacity: 1 }], [], []],
    });
    expect(res.diagnostics.some((d) => d.code === 'TUNNEL_COUNT_MISMATCH')).toBe(true);
  });

  test('Legacy V1 with 3 tunnels is still accepted', () => {
    expect(expectedTunnelCount('legacyV1')).toBe(LEGACY_TUNNEL_COUNT);
    const state = createGame(LEVEL_DEFINITIONS[0]!);
    expect(state.tunnels).toHaveLength(3);
    expect(state.holdingCapacity).toBe(3);
    expect(validateLevelStructure(LEVEL_DEFINITIONS[0]!).valid).toBe(true);
  });
});

describe('queue depth and visible preview', () => {
  const deep = queue([
    { color: 'white', capacity: 8 },
    { color: 'blue', capacity: 10 },
    { color: 'red', capacity: 6 },
    { color: 'orange', capacity: 11 },
    { color: 'purple', capacity: 7 },
  ]);

  test('deep hidden entries remain in runtime state and are not truncated', () => {
    const state = createGame(v2({
      id: 8502,
      tunnels: [deep, [], [], []],
    }));
    expect(state.tunnels[0]!.queue).toHaveLength(5);
    expect(state.tunnels[0]!.queue.map((c) => `${c.color}${c.capacity}`))
      .toEqual(['white8', 'blue10', 'red6', 'orange11', 'purple7']);
  });

  test('Core V2 exposes only CURRENT, NEXT, NEXT+1', () => {
    expect(VISIBLE_TUNNEL_ENTRIES).toBe(3);
    expect(upcomingPreviewCount('coreV2')).toBe(2);
    const state = createGame(v2({ id: 8503, tunnels: [deep, [], [], []] }));
    const window = visibleTunnelWindow(state.tunnels[0]!.queue, state.ruleset);
    expect(window.map((c) => `${c.color}${c.capacity}`)).toEqual(['white8', 'blue10', 'red6']);
  });

  test('launching advances the visible window A B C D E → B C D → C D E', () => {
    let state = createGame(v2({
      id: 8504,
      pixelArt: ['GGG', 'GGG', 'GGG'],
      holdingCapacity: 4,
      tunnels: [deep, [], [], []],
    }));
    expect(visibleTunnelWindow(state.tunnels[0]!.queue, 'coreV2').map((c) => c.color))
      .toEqual(['white', 'blue', 'red']);

    state = resolveAction(state, T(0)).state;
    expect(state.tunnels[0]!.queue.map((c) => c.color)).toEqual(['blue', 'red', 'orange', 'purple']);
    expect(visibleTunnelWindow(state.tunnels[0]!.queue, 'coreV2').map((c) => c.color))
      .toEqual(['blue', 'red', 'orange']);

    state = resolveAction(state, T(0)).state;
    expect(visibleTunnelWindow(state.tunnels[0]!.queue, 'coreV2').map((c) => c.color))
      .toEqual(['red', 'orange', 'purple']);
    expect(state.tunnels[0]!.queue).toHaveLength(3);
  });
});

describe('four tunnels advance independently', () => {
  test('launching tunnel 0 leaves tunnels 1–3 untouched', () => {
    const def = v2({
      id: 8505,
      pixelArt: ['GGG', 'GGG', 'GGG'],
      holdingCapacity: 4,
      tunnels: [
        [{ color: 'white', capacity: 1 }, { color: 'blue', capacity: 2 }],
        [{ color: 'red', capacity: 3 }, { color: 'orange', capacity: 4 }],
        [{ color: 'purple', capacity: 5 }],
        [{ color: 'green', capacity: 6 }, { color: 'cyan', capacity: 7 }],
      ],
    });
    const before = createGame(def);
    const snapshot = JSON.stringify(before.tunnels.slice(1));
    const after = resolveAction(before, T(0)).state;
    expect(after.tunnels[0]!.queue[0]!.color).toBe('blue');
    expect(JSON.stringify(after.tunnels.slice(1))).toBe(snapshot);

    const after3 = resolveAction(after, T(3)).state;
    expect(after3.tunnels[3]!.queue[0]!.color).toBe('cyan');
    expect(after3.tunnels[0]).toEqual(after.tunnels[0]);
    expect(after3.tunnels[1]).toEqual(after.tunnels[1]);
    expect(after3.tunnels[2]).toEqual(after.tunnels[2]);
  });
});

describe('Holding capacity 4', () => {
  const miss = v2({
    id: 8506,
    pixelArt: ['WWW', 'WWW', 'WWW'],
    holdingCapacity: 4,
    tunnels: [
      [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
      [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
      [{ color: 'blue', capacity: 1 }],
      [{ color: 'blue', capacity: 1 }],
    ],
  });

  test('Core V2 can park 1–4 held charges; 4/4 is full', () => {
    let state = createGame(miss);
    expect(state.holdingCapacity).toBe(4);
    state = resolveAction(state, T(0)).state;
    expect(state.holding).toHaveLength(1);
    state = resolveAction(state, T(1)).state;
    expect(state.holding).toHaveLength(2);
    state = resolveAction(state, T(2)).state;
    expect(state.holding).toHaveLength(3);
    state = resolveAction(state, T(3)).state;
    expect(state.holding).toHaveLength(4);
    expect(state.holding.length).toBe(state.holdingCapacity);

    const fifth = resolveAction(state, T(0));
    expect(fifth.accepted).toBe(true);
    // It is inbound, not lost: the tray could still open before it lands.
    expect(fifth.state.status).toBe('playing');
    expect(fifth.state.pendingHolding).toHaveLength(1);
    // Nothing freed a slot, so its arrival at the Gate is the loss.
    const arrival = resolveArrival(fifth.state);
    expect(arrival.state.status).toBe('lost');
    expect(arrival.state.holding).toHaveLength(4);
    expect(arrival.state.holding.map((c) => c.id)).toEqual(state.holding.map((c) => c.id));
  });

  test('held relaunch from a 4-slot tray frees that slot and preserves identity', () => {
    let state = createGame(miss);
    state = resolveAction(state, T(0)).state;
    state = resolveAction(state, T(1)).state;
    state = resolveAction(state, T(2)).state;
    expect(state.holding).toHaveLength(3);
    const keep = state.holding[1]!;
    const target = state.holding[0]!;
    const relaunch = resolveHoldingLaunch(state, target.id);
    expect(relaunch.accepted).toBe(true);
    expect(relaunch.launchedCharge!.id).toBe(target.id);
    expect(relaunch.launchedCharge!.capacity).toBe(target.capacity);
    expect(relaunch.state.holding.some((c) => c.id === target.id)).toBe(true); // re-parked after miss
    expect(relaunch.state.holding.some((c) => c.id === keep.id)).toBe(true);
    expect(relaunch.state.holding.find((c) => c.id === keep.id)).toEqual(keep);
  });
});

describe('Holding pressure thresholds', () => {
  test('capacity 3 warns at 2 and is full at 3; capacity 4 warns at 3 and is full at 4', () => {
    expect(holdingWarnAt(3)).toBe(2);
    expect(holdingWarnAt(4)).toBe(3);
  });

  test('presentation emits holdingFull at actual capacity, not hardcoded 3', () => {
    const def = v2({
      id: 8509,
      pixelArt: ['WWW', 'WWW', 'WWW'],
      holdingCapacity: 4,
      tunnels: [
        [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
        [{ color: 'blue', capacity: 1 }],
        [{ color: 'blue', capacity: 1 }],
        [{ color: 'blue', capacity: 1 }],
      ],
    });
    let prev = createGame(def);
    prev = resolveAction(prev, T(0)).state;
    prev = resolveAction(prev, T(1)).state;
    prev = resolveAction(prev, T(2)).state;
    expect(prev.holding).toHaveLength(3);
    const fourth = resolveAction(prev, T(3));
    const pass = buildLaunchScript(fourth, prev).pass;
    expect(pass.events.some((e) => e.kind === 'holdingCritical')).toBe(false);
    expect(pass.events.some((e) => e.kind === 'holdingFull')).toBe(true);
  });
});

describe('source registration keys', () => {
  test('four tunnel and four Holding keys are unique and stable', () => {
    const state = createGame(v2({ id: 8507, tunnels: [[], [], [], []] }));
    const tunnelKeys = state.tunnels.map((t) => t.id);
    expect(tunnelKeys).toEqual(['tunnel-0', 'tunnel-1', 'tunnel-2', 'tunnel-3']);
    expect(new Set(tunnelKeys).size).toBe(4);
    const holdingKeys = Array.from({ length: state.holdingCapacity }, (_, i) => `holding-${i}`);
    expect(holdingKeys).toEqual(['holding-0', 'holding-1', 'holding-2', 'holding-3']);
    expect(new Set(holdingKeys).size).toBe(4);
    expect(new Set([...tunnelKeys, ...holdingKeys]).size).toBe(8);
  });
});

describe('authoring / studio round-trip', () => {
  test('Core V2 4-tunnel holding-4 definition round-trips', () => {
    const authored = normalizeAuthoredLevel({
      id: 8508,
      title: 'V2 Round',
      difficulty: 'easy',
      ruleset: 'coreV2',
      grid: ['R'],
      tunnels: [
        [{ color: 'red', capacity: 1 }],
        [{ color: 'blue', capacity: 2 }],
        [],
        [{ color: 'white', capacity: 3 }],
      ],
    });
    expect(authored.ruleset).toBe('coreV2');
    expect(authored.holdingCapacity).toBe(4);
    expect(authored.tunnels).toHaveLength(4);

    const studio = fromLevelDefinition(authored);
    expect(studio.ruleset).toBe('coreV2');
    expect(studio.holdingCapacity).toBe(4);
    expect(studio.tunnels).toHaveLength(4);
    const back = toLevelDefinition(studio);
    expect(back.ruleset).toBe('coreV2');
    expect(back.holdingCapacity).toBe(4);
    expect(back.tunnels).toHaveLength(4);
    expect(back.tunnels).toEqual(authored.tunnels);
    expect(createGame(back).tunnels.map((t) => t.queue.map((c) => `${c.color}${c.capacity}`)))
      .toEqual(createGame(authored).tunnels.map((t) => t.queue.map((c) => `${c.color}${c.capacity}`)));
  });

  test('createBlankLevel Core V2 starts with 4 tunnels and holding 4', () => {
    const blank = createBlankLevel({ ruleset: 'coreV2', width: 7, height: 7 });
    expect(blank.tunnels).toHaveLength(4);
    expect(blank.holdingCapacity).toBe(4);
    expect(validateStudioLevel(blank).errors.some((e) => e.code === 'tunnels/count')).toBe(false);
  });

  test('Legacy V1 campaign round-trip keeps 3 tunnels and holding 3', () => {
    const def = LEVEL_DEFINITIONS[0]!;
    const back = toLevelDefinition(fromLevelDefinition(def));
    expect(back.tunnels).toHaveLength(3);
    expect(back.holdingCapacity).toBe(3);
    expect(back.ruleset).toBeUndefined();
    expect(back.tunnels).toEqual(def.tunnels);
  });
});
