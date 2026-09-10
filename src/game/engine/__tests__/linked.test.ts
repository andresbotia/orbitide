import { attachModifiers } from '../art';
import { createGame } from '../createGame';
import { boardFingerprint } from '../frozen';
import { isLinkedPrimed, resolveBoardHit } from '../linked';
import { reachablePixels } from '../pixels';
import { resolveAction } from '../resolveLaunch';
import { solve, stateKey } from '../solver';
import { traceActions } from '../trace';
import type { LevelDefinition, Pixel } from '../types';
import { computeStatus } from '../winState';

const LINKED: LevelDefinition = {
  id: 9760, title: 'Linked Fixture', themeId: 'fixture', difficulty: 'easy', holdingCapacity: 3,
  pixelArt: ['R.B'],
  modifiers: {
    '0,0': { kind: 'linked', group: 'pair-a' },
    '2,0': { kind: 'linked', group: 'pair-a' },
  },
  tunnels: [[{ color: 'red', capacity: 1 }], [{ color: 'blue', capacity: 1 }], []],
};

const action = (id: string, join = false) => ({ kind: 'tunnel' as const, id, ...(join ? { join: true } : {}) });

test('runtime hydration gives both members canonical, symmetric wiring', () => {
  const state = createGame(LINKED);
  expect(state.pixels.map((p) => p.modifier)).toEqual([
    expect.objectContaining({ group: 'pair-a', linkId: 'pair-a', linkedPixelIds: [state.pixels[1]!.id] }),
    expect.objectContaining({ group: 'pair-a', linkId: 'pair-a', linkedPixelIds: [state.pixels[0]!.id] }),
  ]);
  expect(attachModifiers(state.pixels, undefined)).toBe(state.pixels);
});

test('first member hit spends its own capacity, primes it, and remains solid', () => {
  const out = resolveAction(createGame(LINKED), action('tunnel-0'));
  expect(out.accepted).toBe(true);
  expect(out.pass?.encounters).toEqual([
    expect.objectContaining({ pixelId: 'L9760-p0-0', remaining: 0, linkedPrime: true, linkedGroupId: 'pair-a' }),
  ]);
  expect(out.state.pixels[0]).toMatchObject({ cleared: false, modifier: { state: 'primed', linkProgress: 1 } });
  expect(out.state.pixels[1]).toMatchObject({ cleared: false });
  expect(reachablePixels(out.state).some((pixel) => pixel.id === 'L9760-p0-0')).toBe(true);
});

test('an incomplete group without a partner action is a real deadlock', () => {
  const primed = resolveAction(createGame(LINKED), action('tunnel-0')).state;
  const stranded = {
    ...primed,
    tunnels: primed.tunnels.map((tunnel) => ({ ...tunnel, queue: [] })),
    holding: [],
    epoch: null,
    activeCharges: [],
  };
  expect(computeStatus(stranded)).toBe('lost');
});

test('a partial group with a joinable partner action remains live and resolves', () => {
  const primed = resolveAction(createGame(LINKED), action('tunnel-0')).state;
  expect(primed.status).toBe('playing');
  const joined = resolveAction(primed, action('tunnel-1', true));
  expect(joined.accepted).toBe(true);
  expect(joined.state.status).toBe('won');
});

test('an insufficient partner-color budget is unsolvable', () => {
  const short: LevelDefinition = {
    ...LINKED, id: 9765,
    tunnels: [[{ color: 'red', capacity: 1 }], [{ color: 'white', capacity: 1 }], [{ color: 'yellow', capacity: 1 }]],
  };
  expect(solve(short).solved).toBe(false);
});

test('a concurrently vanished Linked target does not spend a later charge', () => {
  const level: LevelDefinition = {
    ...LINKED, id: 9766, pixelArt: ['R.R.G'],
    modifiers: {
      '0,0': { kind: 'linked', group: 'pair-a' }, '2,0': { kind: 'linked', group: 'pair-a' },
    },
    tunnels: [
      [{ color: 'red', capacity: 1 }],
      [{ color: 'red', capacity: 1 }],
      [{ color: 'red', capacity: 1 }, { color: 'green', capacity: 1 }],
    ],
  };
  let state = resolveAction(createGame(level), action('tunnel-0')).state;
  state = resolveAction(state, action('tunnel-1', true)).state;
  const third = resolveAction(state, action('tunnel-2', true));
  const charge = third.epochCharges!.find((candidate) => candidate.originId === 'tunnel-2')!;
  expect(charge.encounters).toEqual([]);
  expect(charge.remainingCapacity).toBe(1);
  expect(third.state.holding).toContainEqual(expect.objectContaining({ id: charge.id, capacity: 1 }));
});

test('final member hit atomically clears both colors without extra capacity', () => {
  let state = resolveAction(createGame(LINKED), action('tunnel-0')).state;
  const out = resolveAction(state, action('tunnel-1'));
  expect(out.pass?.encounters[0]).toMatchObject({
    linkedGroupClear: true,
    linkedGroupId: 'pair-a',
    linkedClearedPixelIds: ['L9760-p0-0', 'L9760-p2-0'],
    remaining: 0,
  });
  expect(out.state.pixels.every((p) => p.cleared)).toBe(true);
  expect(out.state.status).toBe('won');
});

test('a primed member remains exposed and cannot be hit twice in one pass', () => {
  const sameColor: LevelDefinition = {
    ...LINKED, id: 9761, pixelArt: ['R.R'],
    tunnels: [[{ color: 'red', capacity: 2 }], [], []],
  };
  const out = resolveAction(createGame(sameColor), action('tunnel-0'));
  expect(out.pass?.encounters.map((e) => e.pixelId)).toEqual(['L9761-p0-0', 'L9761-p2-0']);
  expect(out.pass?.encounters.map((e) => [e.linkedPrime, e.linkedGroupClear])).toEqual([
    [true, undefined], [undefined, true],
  ]);
  expect(out.state.status).toBe('won');
});

test('simultaneous joined hits are ordered deterministically and never double-spend', () => {
  const sameColor: LevelDefinition = {
    ...LINKED, id: 9762,
    modifiers: {
      '0,0': { kind: 'linked', group: 'pair-a' },
      '2,0': { kind: 'linked', group: 'pair-a' },
    },
    pixelArt: ['R.R'],
    tunnels: [[{ color: 'red', capacity: 1 }], [{ color: 'red', capacity: 1 }], []],
  };
  const first = resolveAction(createGame(sameColor), action('tunnel-0')).state;
  const joined = resolveAction(first, action('tunnel-1', true));
  const events = joined.epochCharges!.flatMap((charge) => charge.encounters);
  expect(events.filter((event) => event.linkedPrime)).toHaveLength(1);
  expect(events.filter((event) => event.linkedGroupClear)).toHaveLength(1);
  expect(events).toHaveLength(2);
  expect(joined.state.status).toBe('won');
});

test('unprimed, primed, group identity, and group assignment fingerprint distinctly', () => {
  const initial = createGame(LINKED);
  const primed = resolveAction(initial, action('tunnel-0')).state;
  const renamed = createGame({ ...LINKED, id: 9763, modifiers: {
    '0,0': { kind: 'linked', group: 'pair-b' }, '2,0': { kind: 'linked', group: 'pair-b' },
  } });
  const reassignedPixels = initial.pixels.map((pixel, index): Pixel => index === 1
    ? { ...pixel, modifier: { ...pixel.modifier!, group: 'pair-b', linkId: 'pair-b' } }
    : pixel);
  expect(new Set([
    boardFingerprint(initial.pixels), boardFingerprint(primed.pixels),
    boardFingerprint(renamed.pixels), boardFingerprint(reassignedPixels),
  ]).size).toBe(4);
  expect(stateKey(initial)).not.toBe(stateKey(primed));
});

test('Frozen, Shielded, and Linked occupy distinct fingerprint states', () => {
  const base = { ...LINKED, id: 9767, pixelArt: ['R'], tunnels: [[{ color: 'red' as const, capacity: 2 }], [], []] };
  const frozen = createGame({ ...base, modifiers: { '0,0': { kind: 'frozen', level: 1 } } });
  const shielded = createGame({ ...base, modifiers: { '0,0': { kind: 'shielded', level: 1 } } });
  const linked = createGame({ ...base, modifiers: { '0,0': { kind: 'linked', group: 'orphan' } } });
  expect(new Set([
    boardFingerprint(frozen.pixels),
    boardFingerprint(shielded.pixels),
    boardFingerprint(linked.pixels),
  ]).size).toBe(3);
});

test('malformed singleton links prime deterministically but never self-clear', () => {
  const pixel = createGame({ ...LINKED, id: 9764, pixelArt: ['R'], modifiers: {
    '0,0': { kind: 'linked', group: 'orphan' },
  }, tunnels: [[{ color: 'red', capacity: 1 }], [], []] }).pixels[0]!;
  const result = resolveBoardHit([pixel], pixel.id);
  expect(result.linkedPrime).toBe(true);
  expect(result.clearedPixelIds).toEqual([]);
  expect(result.pixels[0]!.cleared).toBe(false);
  expect(isLinkedPrimed(result.pixels[0]!)).toBe(true);
});

test('solver uses the real Linked mechanic and trace separates prime from group clear', () => {
  const result = solve(LINKED);
  expect(result.solved).toBe(true);
  const trace = traceActions(LINKED, result.moves);
  expect(trace.outcome).toBe('won');
  expect(trace.steps.flatMap((step) => step.linkedPrimePixelIds)).toEqual(['L9760-p0-0']);
  expect(trace.steps.flatMap((step) => step.linkedGroupClearIds)).toEqual(['pair-a']);
  expect(trace.steps.flatMap((step) => step.clearedPixelIds).sort()).toEqual(['L9760-p0-0', 'L9760-p2-0']);
});
