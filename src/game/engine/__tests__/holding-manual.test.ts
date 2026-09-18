/**
 * REGRESSION A — MANUAL HOLDING ONLY.
 *
 * A charge that lands in Holding with capacity to spare must stay there until
 * the player explicitly taps it. It must never auto-relaunch because a target
 * gets exposed, another charge clears something, an epoch settles, the solver
 * advances, or another tunnel charge launches.
 *
 * These are must-not-regress rules. The M1/M2B engine already implements them
 * (the only held-relaunch path is an explicit `{ kind: 'holding', id }` action);
 * this suite pins that down for the concurrent model and the solver.
 */
import { legalActions } from '../actions';
import { LAUNCH_SPACING } from '../concurrency';
import { createGame } from '../createGame';
import { simulateEpoch } from '../epoch';
import { resolveAction } from '../resolveLaunch';
import { resolveHoldingLaunch } from '../resolveHolding';
import type { EpochLaunch, GameState, LevelDefinition, OrbColor } from '../types';
import { computeStatus } from '../winState';
import { solve } from './solver';
import { LEVEL_DEFINITIONS } from '../../levels/levelDefinitions';

const level = (
  pixelArt: string[],
  tunnels: LevelDefinition['tunnels'],
  holdingCapacity = 3,
): LevelDefinition => ({
  id: 710, title: 'ManualHolding', themeId: 'test', difficulty: 'easy', holdingCapacity, pixelArt, tunnels,
});

/** A settle-first launch (fresh epoch, M1 semantics). */
const T = (i: number) => ({ kind: 'tunnel' as const, id: `tunnel-${i}` });
/** A launch fired while charges are still on the rail (joins the epoch). */
const J = (i: number) => ({ kind: 'tunnel' as const, id: `tunnel-${i}`, join: true });

const rawLaunch = (color: OrbColor, capacity: number, i: number): EpochLaunch => ({
  chargeId: `c${i}`, source: 'tunnel', originId: `tunnel-${i}`, color, capacity,
  insertionTime: i * LAUNCH_SPACING, launchSequence: i,
});

// A board whose only white pixels are buried behind red, so a white tunnel
// charge misses and parks with its capacity intact.
const buriedWhite = level(
  ['RRRRR', 'RWWWR', 'RRRRR'],
  [
    [{ color: 'white', capacity: 1 }],
    [{ color: 'red', capacity: 12 }, { color: 'red', capacity: 12 }],
    [{ color: 'white', capacity: 3 }],
  ],
);

function parkOneWhite(): { state: GameState; heldId: string } {
  const outcome = resolveAction(createGame(buriedWhite), T(0));
  expect(outcome.heldCharge).not.toBeNull();
  expect(outcome.state.holding).toHaveLength(1);
  return { state: outcome.state, heldId: outcome.state.holding[0]!.id };
}

describe('a held charge stays held', () => {
  test('does not auto-launch when a useful target becomes exposed by another charge', () => {
    const { state, heldId } = parkOneWhite();
    const held = { ...state.holding[0]! };

    // Red clears the whole shell, exposing every white pixel.
    const after = resolveAction(state, T(1)).state;
    expect(after.pixels.filter((p) => p.color === 'red' && !p.cleared)).toHaveLength(0);
    expect(after.pixels.filter((p) => p.color === 'white' && !p.cleared).length).toBeGreaterThan(0);

    // The held white charge is untouched despite now having exposed targets.
    expect(after.holding).toEqual([held]);
    expect(after.holding[0]!.id).toBe(heldId);
    expect(after.activeCharges.some((c) => c.id === heldId)).toBe(false);
    expect(after.epoch!.launches.some((l) => l.chargeId === heldId)).toBe(false);
    expect(after.status).toBe('playing');

    // Only an explicit holding action moves it.
    const relaunch = resolveHoldingLaunch(after, heldId);
    expect(relaunch.accepted).toBe(true);
    expect(relaunch.launchedCharge).toEqual(held);
    expect(relaunch.state.holding).toHaveLength(0);
  });

  test('survives unrelated tunnel launches (reference-identical Holding)', () => {
    // Park a blue charge on an all-white board — blue never has a target.
    const def = level(
      ['WWWWW', 'WWWWW', 'WWWWW'],
      [
        [{ color: 'blue', capacity: 1 }],
        [{ color: 'white', capacity: 5 }, { color: 'white', capacity: 5 }],
        [{ color: 'white', capacity: 5 }],
      ],
    );
    let state = resolveAction(createGame(def), T(0)).state;
    expect(state.holding).toHaveLength(1);
    const parkedRef = state.holding;
    const heldId = state.holding[0]!.id;

    // Three unrelated white launches, each clearing pixels.
    for (const action of [T(1), T(2), T(1)]) {
      const outcome = resolveAction(state, action);
      expect(outcome.accepted).toBe(true);
      state = outcome.state;
      // Nothing new parked and no holding charge launched → same array instance.
      expect(state.holding).toBe(parkedRef);
    }
    expect(state.holding[0]!.id).toBe(heldId);
  });

  test('survives epoch settlement — a full concurrent epoch flushing around it', () => {
    const def = level(
      ['WWWWWWW', 'WWWWWWW', 'WWWWWWW'],
      [
        [{ color: 'pink', capacity: 1 }],
        [{ color: 'white', capacity: 4 }, { color: 'white', capacity: 4 }, { color: 'white', capacity: 4 }],
        [{ color: 'white', capacity: 4 }, { color: 'white', capacity: 4 }],
      ],
    );
    // Park a pink charge (no pink pixels anywhere — it can never be consumed).
    let state = resolveAction(createGame(def), T(0)).state;
    const heldId = state.holding[0]!.id;
    const held = { ...state.holding[0]! };

    // Open and grow one concurrent epoch of four more charges, then let it flush.
    for (const action of [T(1), J(1), J(1), J(2)]) {
      state = resolveAction(state, action).state;
    }
    expect(state.epoch!.launches.length).toBeGreaterThanOrEqual(4);
    expect(state.activeCharges.some((c) => c.id === heldId)).toBe(false);
    expect(state.epoch!.launches.some((l) => l.chargeId === heldId)).toBe(false);
    // The pink charge is exactly as it was parked — no relaunch, no mutation.
    expect(state.holding.filter((c) => c.id === heldId)).toEqual([held]);
  });

  test('remains held through several independent concurrent epochs', () => {
    const def = level(
      ['CCCCCC', 'CCCCCC', 'CCCCCC'],
      [
        [{ color: 'gold', capacity: 1 }],
        [{ color: 'cyan', capacity: 3 }, { color: 'cyan', capacity: 3 }, { color: 'cyan', capacity: 3 }],
        [{ color: 'cyan', capacity: 3 }, { color: 'cyan', capacity: 3 }, { color: 'cyan', capacity: 3 }],
      ],
    );
    let state = resolveAction(createGame(def), T(0)).state;
    const heldId = state.holding[0]!.id;
    const held = { ...state.holding[0]! }; // gold — never has a target

    // Epoch 1: two joined charges. Epoch 2 (fresh): two joined charges.
    for (const action of [T(1), J(1), T(2), J(2)]) {
      const outcome = resolveAction(state, action);
      expect(outcome.accepted).toBe(true);
      state = outcome.state;
      expect(state.holding.filter((c) => c.id === heldId)).toEqual([held]);
      expect(state.activeCharges.some((c) => c.id === heldId)).toBe(false);
    }
  });

  test('only an explicit holding action removes a charge from Holding', () => {
    const { state, heldId } = parkOneWhite();

    // Every non-holding legal action leaves the held charge exactly where it is.
    for (const action of legalActions(state)) {
      if (action.kind === 'holding') continue;
      const next = resolveAction(state, action).state;
      expect(next.holding.some((c) => c.id === heldId)).toBe(true);
    }

    // The holding action is the sole path that consumes it.
    const removed = resolveHoldingLaunch(
      resolveAction(state, T(1)).state, // expose targets first so it is legal
      heldId,
    );
    expect(removed.accepted).toBe(true);
    expect(removed.state.holding.some((c) => c.id === heldId)).toBe(false);
  });

  test('simulateEpoch never reads or mutates Holding', () => {
    const base = createGame(level(['WW'], [[], [], []]));
    const res = simulateEpoch(base, [rawLaunch('white', 1, 0), rawLaunch('white', 1, 1)]);
    // The resolution describes only the epoch's own charges — there is no channel
    // for a held charge to be relaunched by the arbitration itself.
    expect(res.charges.map((c) => c.id)).toEqual(['c0', 'c1']);
    expect(res.charges.every((c) => c.source === 'tunnel')).toBe(true);
  });
});

describe('the solver models manual Holding', () => {
  test('never implicitly relaunches a held charge — a state with Holding still has it after any non-holding move', () => {
    // Craft a mid-game state with a parked charge and multiple options.
    const { state } = parkOneWhite();
    const withOptions: GameState = {
      ...resolveAction(state, T(1)).state,
      holding: [
        { id: 'h-white', color: 'white', capacity: 2 },
        { id: 'h-pink', color: 'pink', capacity: 1 },
      ],
    };
    expect(computeStatus(withOptions)).toBe('playing');
    for (const action of legalActions(withOptions)) {
      if (action.kind === 'holding') continue;
      const next = resolveAction(withOptions, action).state;
      expect(next.holding.some((c) => c.id === 'h-white')).toBe(true);
      expect(next.holding.some((c) => c.id === 'h-pink')).toBe(true);
    }
  });

  test('Holding relaunches on a witness are always explicit holding actions', () => {
    for (const level of LEVEL_DEFINITIONS) {
      const result = solve(level);
      expect(result.solved).toBe(true);
      const heldMoves = result.moves.filter((a) => a.kind === 'holding');
      expect(heldMoves.length).toBe(result.heldLaunches);
    }
    // The production campaign does exercise manual Holding within World 1.
    const w1NeedsHolding = LEVEL_DEFINITIONS
      .filter((l) => l.themeId === 'first-light')
      .some((l) => solve(l).heldLaunches > 0);
    expect(w1NeedsHolding).toBe(true);
  }, 120_000);
});
