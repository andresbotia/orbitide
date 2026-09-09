/**
 * Frozen — the first implemented special-pixel mechanic (M4A.1).
 *
 * A matching charge that reaches a Frozen pixel spends one capacity to crack an
 * ice layer without clearing the pixel; only a later matching hit (after every
 * layer is gone) clears it. Exposure, the clockwise order and the deterministic
 * concurrent arbitration are all unchanged.
 */
import { legalActions } from '../actions';
import { createGame } from '../createGame';
import { boardFingerprint, iceLayers, isIced, resolveMatchingHit } from '../frozen';
import { reachablePixels } from '../pixels';
import { resolveAction } from '../resolveLaunch';
import { solve, stateKey } from '../solver';
import { traceActions } from '../trace';
import type { LevelDefinition } from '../types';

/** A 3×1 white strip; the centre pixel wears one ice layer. */
const STRIP: LevelDefinition = {
  id: 9700, title: 'Frozen Strip', themeId: 'fixture', difficulty: 'easy', holdingCapacity: 3,
  pixelArt: ['WWW'],
  modifiers: { '1,0': { kind: 'frozen', level: 1 } },
  tunnels: [[{ color: 'white', capacity: 4 }], [], []],
};

const T0 = { kind: 'tunnel' as const, id: 'tunnel-0' };
const centre = (s: ReturnType<typeof createGame>) => s.pixels.find((p) => p.x === 1 && p.y === 0)!;

describe('frozen.ts pure helpers', () => {
  test('iceLayers / isIced read the authored durability and clamp', () => {
    const g = createGame(STRIP);
    expect(iceLayers(centre(g))).toBe(1);
    expect(isIced(centre(g))).toBe(true);
    expect(iceLayers(g.pixels.find((p) => p.x === 0)!)).toBe(0);
  });

  test('resolveMatchingHit cracks ice before it clears', () => {
    const g = createGame(STRIP);
    const first = resolveMatchingHit(centre(g));
    expect(first.frozenBreak).toBe(true);
    expect(first.cleared).toBe(false);
    expect(first.pixel.cleared).toBe(false);
    expect(iceLayers(first.pixel)).toBe(0);
    expect(first.pixel.modifier).toMatchObject({ kind: 'frozen', level: 0, state: 'broken' });

    const second = resolveMatchingHit(first.pixel);
    expect(second.frozenBreak).toBe(false);
    expect(second.cleared).toBe(true);
    expect(second.pixel.cleared).toBe(true);
  });

  test('a thawed Frozen pixel remains distinct from a plain uncleared pixel', () => {
    const g = createGame(STRIP);
    const iced = boardFingerprint(g.pixels);
    const thawed = boardFingerprint(g.pixels.map((p) => (p.x === 1 ? resolveMatchingHit(p).pixel : p)));
    expect(iced).toBe('N.F1.N');
    expect(thawed).toBe('N.FB.N');
  });

  test('the solver stateKey distinguishes iced, thawed, and plain states', () => {
    const iced = createGame(STRIP);
    const thaw = (s: ReturnType<typeof createGame>) => ({
      ...s, pixels: s.pixels.map((p) => (p.x === 1 ? resolveMatchingHit(p).pixel : p)),
    });
    const plain = createGame({ ...STRIP, id: 9799, modifiers: undefined });
    expect(stateKey(thaw(iced))).not.toBe(stateKey(iced));       // ice matters
    expect(stateKey(thaw(iced)).replace(/9700/g, 'X'))
      .not.toBe(stateKey(plain).replace(/9799/g, 'X'));
  });
});

describe('frozen gameplay rule', () => {
  test('one matching charge cracks the ice but cannot also clear it on the same pass', () => {
    const g = createGame(STRIP);
    const out = resolveAction(g, T0);
    expect(out.accepted).toBe(true);
    // Two plain pixels cleared; the centre only lost its ice.
    expect(out.state.pixels.filter((p) => p.cleared).map((p) => p.x).sort()).toEqual([0, 2]);
    expect(centre(out.state).cleared).toBe(false);
    expect(iceLayers(centre(out.state))).toBe(0);
    expect(out.state.status).toBe('playing');
    // Capacity was spent on the crack: 4 → 1 leftover parked in Holding.
    expect(out.state.holding).toHaveLength(1);
    expect(out.state.holding[0]!.capacity).toBe(1);
  });

  test('a second matching hit clears the thawed pixel and wins', () => {
    let state = createGame(STRIP);
    state = resolveAction(state, T0).state;
    const held = state.holding[0]!;
    const out = resolveAction(state, { kind: 'holding', id: held.id });
    expect(out.accepted).toBe(true);
    expect(centre(out.state).cleared).toBe(true);
    expect(out.state.status).toBe('won');
  });

  test('capacity is spent on the crack even when nothing clears', () => {
    // One frozen pixel, one exactly-sized charge: the crack strands it, no win.
    const level: LevelDefinition = {
      ...STRIP, id: 9701, pixelArt: ['.W.'],
      modifiers: { '1,0': { kind: 'frozen', level: 1 } },
      tunnels: [[{ color: 'white', capacity: 1 }], [], []],
    };
    const out = resolveAction(createGame(level), T0);
    expect(out.state.pixels[0]!.cleared).toBe(false);
    expect(iceLayers(out.state.pixels[0]!)).toBe(0);
    expect(out.state.holding).toHaveLength(0); // the charge is gone, not parked
    expect(out.state.status).toBe('lost'); // no charge left, pixel still there
  });

  test('exposure never treats a Frozen cell as empty until the pixel itself clears', () => {
    // A cyan centre buried under a frozen white ring: the ring must actually
    // clear (not just crack) before cyan is reachable.
    const level: LevelDefinition = {
      id: 9702, title: 'Frozen Shell', themeId: 'fixture', difficulty: 'easy', holdingCapacity: 3,
      pixelArt: ['WWW', 'WCW', 'WWW'],
      modifiers: {
        '0,1': { kind: 'frozen', level: 1 }, '1,0': { kind: 'frozen', level: 1 },
        '2,1': { kind: 'frozen', level: 1 }, '1,2': { kind: 'frozen', level: 1 },
      },
      tunnels: [[{ color: 'white', capacity: 12 }], [{ color: 'cyan', capacity: 1 }], []],
    };
    const g = createGame(level);
    expect(reachablePixels(g).some((p) => p.color === 'cyan')).toBe(false);
    // Launch white once: cracks the 4 frozen edges + clears the 4 corners, but
    // the frozen edge pixels are still on the board, so cyan is still buried.
    const after1 = resolveAction(g, T0).state;
    expect(reachablePixels(after1).some((p) => p.color === 'cyan')).toBe(false);
    expect(after1.pixels.filter((p) => p.color === 'white' && !p.cleared)).toHaveLength(4);
  });
});

describe('frozen under concurrency', () => {
  test('one charge cracks the ice, a second charge in the same epoch clears it — never a double claim', () => {
    const level: LevelDefinition = {
      id: 9703, title: 'Frozen Duo', themeId: 'fixture', difficulty: 'medium', holdingCapacity: 3,
      pixelArt: ['.W.'],
      modifiers: { '1,0': { kind: 'frozen', level: 1 } },
      tunnels: [[{ color: 'white', capacity: 1 }], [{ color: 'white', capacity: 1 }], []],
    };
    let state = createGame(level);
    const a = resolveAction(state, { kind: 'tunnel', id: 'tunnel-0' });
    state = a.state;
    const b = resolveAction(state, { kind: 'tunnel', id: 'tunnel-1', join: true });
    expect(b.joinedEpoch).toBe(true);
    // Exactly one crack and one clear across the two charges — the pixel is gone.
    const breaks = b.epochCharges!.flatMap((c) => c.encounters.filter((e) => e.frozenBreak)).length;
    const clears = b.epochCharges!.flatMap((c) => c.encounters.filter((e) => !e.frozenBreak)).length;
    expect(breaks).toBe(1);
    expect(clears).toBe(1);
    expect(b.state.status).toBe('won');
  });

  test('resolution is deterministic — identical launches give an identical board', () => {
    const level: LevelDefinition = {
      id: 9704, title: 'Frozen Det', themeId: 'fixture', difficulty: 'medium', holdingCapacity: 3,
      pixelArt: ['WWWWW'],
      modifiers: { '2,0': { kind: 'frozen', level: 2 } },
      tunnels: [[{ color: 'white', capacity: 4 }], [{ color: 'white', capacity: 3 }], []],
    };
    const run = () => {
      let s = createGame(level);
      s = resolveAction(s, { kind: 'tunnel', id: 'tunnel-0' }).state;
      s = resolveAction(s, { kind: 'tunnel', id: 'tunnel-1', join: true }).state;
      return boardFingerprint(s.pixels);
    };
    expect(run()).toBe(run());
  });
});

describe('frozen solver + trace support', () => {
  test('the solver models the extra required hit and stays winnable with zero boosters', () => {
    const plain: LevelDefinition = { ...STRIP, id: 9705, modifiers: undefined,
      tunnels: [[{ color: 'white', capacity: 3 }], [], []] };
    const rp = solve(plain);
    const rf = solve(STRIP);
    expect(rp.solved).toBe(true);
    expect(rf.solved).toBe(true);
    // Frozen needs a manual relaunch the plain strip does not.
    expect(rf.length).toBeGreaterThan(rp.length);
    expect(rf.heldLaunches).toBeGreaterThanOrEqual(1);
  });

  test('an under-capacity Frozen level is proven unsolvable, not silently "won"', () => {
    const level: LevelDefinition = {
      ...STRIP, id: 9706, pixelArt: ['.W.'],
      modifiers: { '1,0': { kind: 'frozen', level: 2 } },
      tunnels: [[{ color: 'white', capacity: 2 }], [], []],
    };
    expect(solve(level).solved).toBe(false);
  });

  test('the trace distinguishes a FROZEN break from a PIXEL clear', () => {
    const r = solve(STRIP);
    const trace = traceActions(STRIP, r.moves);
    expect(trace.outcome).toBe('won');
    const allBreaks = trace.steps.flatMap((s) => s.frozenBreakPixelIds);
    const allClears = trace.steps.flatMap((s) => s.clearedPixelIds);
    const centreId = createGame(STRIP).pixels.find((p) => p.x === 1 && p.y === 0)!.id;
    expect(allBreaks).toContain(centreId); // ice cracked …
    expect(allClears).toContain(centreId); // … and later cleared
    expect(allClears.filter((id) => id === centreId)).toHaveLength(1); // cleared once
    // A break step is not also a clear step for that pixel.
    for (const step of trace.steps) {
      expect(step.frozenBreakPixelIds.some((id) => step.clearedPixelIds.includes(id))).toBe(false);
    }
  });

  test('legalActions still offers a matching charge while only ice remains', () => {
    let state = createGame(STRIP);
    state = resolveAction(state, T0).state; // centre now thawed but uncleared
    expect(state.holding).toHaveLength(1);
    expect(legalActions(state).some((a) => a.kind === 'holding')).toBe(true);
  });
});
