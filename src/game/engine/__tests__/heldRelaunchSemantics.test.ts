import { actionRejection, legalActions } from '../actions';
import { createGame } from '../createGame';
import { resolveAction } from '../resolveLaunch';
import { solve, stateKey } from '../solver';
import type { GameRuleset, GameState, LevelDefinition, OrbColor } from '../types';
import { computeStatus, isLost, isProductiveAction } from '../winState';

/**
 * APPROVED SEMANTICS (ruleset-independent): a held Pal may relaunch whether or
 * not a matching target is exposed right now. Admission no longer asks about
 * current exposure; `isLost` asks whether anything can still change instead.
 *
 * These two rules are a pair. Dropping the old Legacy V1 `noTargets` admission
 * rule on its own would have made a no-target tray infinitely "playable", so
 * every test here checks both halves together.
 */

const T = (i: number) => ({ kind: 'tunnel' as const, id: `tunnel-${i}` });
const H = (id: string) => ({ kind: 'holding' as const, id });

function level(
  ruleset: GameRuleset,
  extra: Partial<LevelDefinition> & Pick<LevelDefinition, 'id' | 'pixelArt' | 'tunnels'>,
): LevelDefinition {
  const tunnels = [...extra.tunnels];
  while (tunnels.length < 3) tunnels.push([]);
  return {
    title: `held-${extra.id}`, themeId: 'fixture', difficulty: 'easy', holdingCapacity: 3,
    ...extra, tunnels, ruleset,
  };
}

const RULESETS: GameRuleset[] = ['legacyV1', 'coreV2'];

/** Blue ring around a buried red core; red Pals can never reach it from outside. */
const buriedCore = (ruleset: GameRuleset, id: number) => level(ruleset, {
  id,
  pixelArt: ['BBBBB', 'BBBBB', 'BBRBB', 'BBBBB', 'BBBBB'],
  tunnels: [
    Array.from({ length: 4 }, () => ({ color: 'red' as OrbColor, capacity: 1 })),
    Array.from({ length: 4 }, () => ({ color: 'blue' as OrbColor, capacity: 1 })),
    [],
  ],
});

/** Park `n` misses into Holding. */
function park(state: GameState, n: number, tunnel = 0): GameState {
  let s = state;
  for (let i = 0; i < n; i++) {
    const out = resolveAction(s, T(tunnel));
    expect(out.accepted).toBe(true);
    s = out.state;
  }
  return s;
}

describe('PART 5 — the device scenario', () => {
  test.each(RULESETS)('%s: HOLDING 3/3 with free Active slots relaunches a buried Pal', (ruleset) => {
    const game = createGame(buriedCore(ruleset, ruleset === 'legacyV1' ? 9771 : 9772));
    const full = park(game, 3);
    expect(full.holding).toHaveLength(3);
    expect(full.holding.length).toBe(full.holdingCapacity);
    expect(full.status).toBe('playing');
    // None of the held Pals has an exposed match — the old Legacy V1 trap.
    for (const held of full.holding) {
      expect(isProductiveAction(full, H(held.id))).toBe(false);
      expect(actionRejection(full, H(held.id))).toBeNull();
    }
    // ...and each one is admitted anyway, freeing its slot.
    const out = resolveAction(full, H(full.holding[0]!.id));
    expect(out.accepted).toBe(true);
    expect(out.rejection).toBeUndefined();
    expect(out.pass!.encounters).toEqual([]);
    // The tray still has room for it to come back to; nothing is stranded.
    expect(out.state.holding).toHaveLength(3);
    expect(out.state.status).toBe('playing');
  });

  test.each(RULESETS)('%s: a tunnel Pal still left keeps the level alive, not the tray', (ruleset) => {
    const game = createGame(buriedCore(ruleset, ruleset === 'legacyV1' ? 9773 : 9774));
    const full = park(game, 3);
    expect(full.tunnels.some((t) => t.queue.length > 0)).toBe(true);
    expect(isLost(full)).toBe(false);
    expect(legalActions(full).some((a) => a.kind === 'holding')).toBe(true);
  });
});

describe('PART 6 — a tray of no-op Pals is a deadlock, not a loop', () => {
  test.each(RULESETS)('%s: every action loops, so the state is lost', (ruleset) => {
    // Red Pals only, on a board with no reachable red: once the queues are
    // drained every remaining action is a lap that meets nothing.
    const def = level(ruleset, {
      id: ruleset === 'legacyV1' ? 9775 : 9776,
      pixelArt: ['BBB', 'BRB', 'BBB'],
      tunnels: [[{ color: 'red', capacity: 1 }, { color: 'red', capacity: 1 }], [], []],
    });
    let s = createGame(def);
    s = park(s, 2);
    expect(s.holding).toHaveLength(2);
    expect(s.tunnels.every((t) => t.queue.length === 0)).toBe(true);

    // Judge the position as `isLost` does, before the verdict is stamped on it:
    // the relaunches ARE admitted, they simply cannot change anything.
    const playing: GameState = { ...s, status: 'playing' };
    const actions = legalActions(playing);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((a) => !isProductiveAction(playing, a))).toBe(true);
    expect(isLost(playing)).toBe(true);
    expect(computeStatus(playing)).toBe('lost');
    // The engine reached that verdict on its own at the commit that filled the tray.
    expect(s.status).toBe('lost');
  });

  test.each(RULESETS)('%s: relaunching forever cannot keep a dead state alive', (ruleset) => {
    const def = level(ruleset, {
      id: ruleset === 'legacyV1' ? 9777 : 9778,
      pixelArt: ['BBB', 'BRB', 'BBB'],
      tunnels: [[{ color: 'red', capacity: 1 }], [], []],
    });
    let s = park(createGame(def), 1);
    expect(s.status).toBe('lost');
    // Because the level is over, the loop is not even admitted any more.
    expect(actionRejection(s, H(s.holding[0]!.id))).toBe('gameOver');
    const out = resolveAction(s, H(s.holding[0]!.id));
    expect(out.accepted).toBe(false);
  });
});

describe('PART 7 — exposure changes, which is why the rule matters', () => {
  test.each(RULESETS)('%s: a Pal parked with nothing to hit becomes useful once the board opens', (ruleset) => {
    // A single red behind one blue: while the blue stands, red has no reachable
    // target. Clearing the blue exposes it, and the SAME held Pal then hits.
    const def = level(ruleset, {
      id: ruleset === 'legacyV1' ? 9779 : 9780,
      pixelArt: ['BBB', 'BRB', 'BBB'],
      tunnels: [
        [{ color: 'red', capacity: 1 }],
        [{ color: 'blue', capacity: 8 }],
        [],
      ],
    });
    let s = park(createGame(def), 1);
    const heldId = s.holding[0]!.id;
    expect(isProductiveAction(s, H(heldId))).toBe(false);
    expect(s.status).toBe('playing'); // the blue Pal keeps it alive

    // Spend the blue Pal: it peels the shell and exposes the red core.
    s = resolveAction(s, T(1)).state;
    if (s.status !== 'playing') return; // board fully cleared — nothing left to prove
    // Now the very same held Pal is productive, without ever having been
    // re-admitted or re-created.
    expect(isProductiveAction(s, H(heldId))).toBe(true);
    const out = resolveAction(s, H(heldId));
    expect(out.accepted).toBe(true);
    expect(out.pass!.encounters.length).toBeGreaterThan(0);
  });
});

describe('PART 4 — solver and runtime agree', () => {
  /**
   * The solver calls a state lost when every move loops back onto its own line
   * (`stateKey` unchanged); the runtime calls it lost when no admitted action is
   * productive. For a tray of no-op Pals both must say lost, and neither may
   * declare a state dead while a productive action exists.
   */
  test.each(RULESETS)('%s: no-op tray is lost for both; a live board is live for both', (ruleset) => {
    const dead = level(ruleset, {
      id: ruleset === 'legacyV1' ? 9781 : 9782,
      pixelArt: ['BBB', 'BRB', 'BBB'],
      tunnels: [[{ color: 'red', capacity: 1 }], [], []],
    });
    const parked = park(createGame(dead), 1);
    expect(isLost(parked)).toBe(true);
    // The solver agrees: it cannot win, and it never hits the "runtime failed to
    // mark a deadlock" guard (which would throw).
    expect(solve(dead).solved).toBe(false);

    const alive = level(ruleset, {
      id: ruleset === 'legacyV1' ? 9783 : 9784,
      pixelArt: ['BB'],
      tunnels: [[{ color: 'blue', capacity: 2 }], [], []],
    });
    expect(solve(alive).solved).toBe(true);
    expect(isLost(createGame(alive))).toBe(false);
  });

  test.each(RULESETS)('%s: a no-op relaunch returns to the same solver state key', (ruleset) => {
    const def = level(ruleset, {
      id: ruleset === 'legacyV1' ? 9785 : 9786,
      pixelArt: ['BBB', 'BRB', 'BBB'],
      tunnels: [[{ color: 'red', capacity: 1 }], [{ color: 'blue', capacity: 1 }], []],
    });
    const parked = park(createGame(def), 1);
    const held = parked.holding[0]!;
    expect(isProductiveAction(parked, H(held.id))).toBe(false);
    const after = resolveAction(parked, H(held.id)).state;
    // Identical committed logical state: that is exactly what makes it a loop,
    // and it is the same fact the solver's loop check reads.
    expect(stateKey(after)).toBe(stateKey(parked));
  });

  test.each(RULESETS)('%s: runtime admission and solver enumeration never disagree', (ruleset) => {
    const def = buriedCore(ruleset, ruleset === 'legacyV1' ? 9787 : 9788);
    const seen = new Set<string>();
    const stack: GameState[] = [createGame(def)];
    let checked = 0;
    while (stack.length && checked < 250) {
      const s = stack.pop()!;
      const key = stateKey(s);
      if (seen.has(key) || s.status !== 'playing') continue;
      seen.add(key);
      checked += 1;
      const actions = legalActions(s);
      // A playing state must be able to go somewhere: either a move that
      // changes the committed state, or a Pal inbound to an undecided Holding
      // admission whose arrival will.
      if (s.pendingHolding.length === 0) {
        expect(actions.length).toBeGreaterThan(0);
        expect(actions.some((a) => isProductiveAction(s, a))).toBe(true);
      }
      for (const a of actions) {
        const out = resolveAction(s, a);
        expect(out.accepted).toBe(true);
        if (stack.length < 200) stack.push(out.state);
      }
    }
    expect(checked).toBeGreaterThan(5);
  });
});
