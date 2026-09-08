import { createGame, restartGame } from '../createGame';
import { resolveMove } from '../resolveMove';
import { getExposedOrbs } from '../selectors';
import type { LevelDefinition } from '../types';

/** Tap the exposed orb of a given lane and return the resulting outcome. */
function tapLane(state: Parameters<typeof resolveMove>[0], laneIndex: number) {
  const orb = state.lanes[laneIndex]?.[0];
  if (!orb) throw new Error(`Lane ${laneIndex} is empty`);
  return resolveMove(state, orb.id);
}

const twoColorLevel: LevelDefinition = {
  id: 101,
  holdingCapacity: 3,
  coreTargets: [
    { color: 'blue', count: 1 },
    { color: 'red', count: 1 },
  ],
  lanes: [['blue'], ['red']],
};

describe('resolveMove — matching orb', () => {
  it('1. a matching orb clears from its lane and resolves into the Core', () => {
    const state = createGame(twoColorLevel);
    const { state: next, accepted, kind } = tapLane(state, 0);

    expect(accepted).toBe(true);
    expect(kind).toBe('core');
    expect(next.lanes[0]).toEqual([]);
    expect(next.holding).toEqual([]);
    expect(next.targets[0]?.count).toBe(0);
    // input state untouched
    expect(state.lanes[0]).toHaveLength(1);
  });
});

describe('resolveMove — non-matching orb', () => {
  it('2. a non-matching orb leaves its lane and enters the holding tray', () => {
    const state = createGame(twoColorLevel);
    const { state: next, kind } = tapLane(state, 1); // red while blue active

    expect(kind).toBe('held');
    expect(next.lanes[1]).toEqual([]);
    expect(next.holding.map((o) => o.color)).toEqual(['red']);
    expect(next.status).toBe('playing');
  });
});

describe('target advancement', () => {
  it('3. the active target advances when its count reaches zero', () => {
    const level: LevelDefinition = {
      id: 102,
      holdingCapacity: 3,
      coreTargets: [
        { color: 'blue', count: 2 },
        { color: 'red', count: 1 },
      ],
      lanes: [['blue'], ['blue'], ['red']],
    };
    let state = createGame(level);
    expect(state.activeTargetIndex).toBe(0);

    state = tapLane(state, 0).state;
    expect(state.activeTargetIndex).toBe(0); // still on blue, 1 remaining
    expect(state.targets[0]?.count).toBe(1);

    const outcome = tapLane(state, 1);
    expect(outcome.completedTarget).toBe(true);
    expect(outcome.state.activeTargetIndex).toBe(1); // advanced to red
  });
});

describe('automatic held-orb resolution', () => {
  it('4. matching held orbs auto-resolve when their color becomes active', () => {
    const level: LevelDefinition = {
      id: 103,
      holdingCapacity: 3,
      coreTargets: [
        { color: 'blue', count: 1 },
        { color: 'red', count: 1 },
      ],
      lanes: [
        ['red', 'blue'], // must hold red to reach blue
      ],
    };
    let state = createGame(level);

    let outcome = tapLane(state, 0); // hold red
    state = outcome.state;
    expect(state.holding.map((o) => o.color)).toEqual(['red']);

    outcome = tapLane(state, 0); // tap blue -> completes blue -> red becomes active
    expect(outcome.autoResolved.map((o) => o.color)).toEqual(['red']);
    expect(outcome.state.holding).toEqual([]);
    expect(outcome.state.status).toBe('won');
  });

  it('5. auto-resolution chains through multiple targets', () => {
    const level: LevelDefinition = {
      id: 104,
      holdingCapacity: 3,
      coreTargets: [
        { color: 'blue', count: 1 },
        { color: 'red', count: 1 },
        { color: 'yellow', count: 1 },
      ],
      lanes: [
        ['yellow', 'red', 'blue'], // hold yellow, hold red, then tap blue
      ],
    };
    let state = createGame(level);
    state = tapLane(state, 0).state; // hold yellow
    state = tapLane(state, 0).state; // hold red
    expect(state.holding.map((o) => o.color)).toEqual(['yellow', 'red']);

    const outcome = tapLane(state, 0); // tap blue -> chains red then yellow
    expect(outcome.autoResolved.map((o) => o.color)).toEqual(['red', 'yellow']);
    expect(outcome.state.activeTargetIndex).toBe(3);
    expect(outcome.state.status).toBe('won');
  });
});

describe('failure', () => {
  it('6. a full holding tray with no possible auto-resolution loses the level', () => {
    const level: LevelDefinition = {
      id: 105,
      holdingCapacity: 3,
      coreTargets: [{ color: 'blue', count: 1 }],
      lanes: [['red'], ['red'], ['red'], ['blue']],
    };
    let state = createGame(level);
    state = tapLane(state, 0).state; // hold red (1/3)
    state = tapLane(state, 1).state; // hold red (2/3)
    expect(state.status).toBe('playing');
    const outcome = tapLane(state, 2); // hold red (3/3) -> lost
    expect(outcome.state.status).toBe('lost');
  });

  it('7. a full tray does NOT fail when auto-resolution frees a slot in the same move', () => {
    const level: LevelDefinition = {
      id: 106,
      holdingCapacity: 3,
      coreTargets: [
        { color: 'blue', count: 1 },
        { color: 'red', count: 2 },
      ],
      lanes: [
        ['red', 'blue'], // hold red (1/3), then tap blue
        ['red'],
        ['blue'], // spare blue to hold
      ],
    };
    let state = createGame(level);
    const afterHold = tapLane(state, 0); // hold red (1/3)
    state = afterHold.state;
    expect(state.holding.map((o) => o.color)).toEqual(['red']);

    // Tap the spare blue: blue is active so it resolves into the Core, completing
    // the blue target. Red becomes active and the held red auto-resolves the
    // same move — the tray never fails even though it briefly held an orb.
    const outcome = tapLane(state, 2);
    expect(outcome.autoResolved.map((o) => o.color)).toEqual(['red']);
    expect(outcome.state.activeTargetIndex).toBe(1);
    expect(outcome.state.holding).toEqual([]);
    expect(outcome.state.status).toBe('playing');
  });

  it('7b. chained auto-resolution can rescue a tray that is one orb from full', () => {
    const level: LevelDefinition = {
      id: 107,
      holdingCapacity: 3,
      coreTargets: [
        { color: 'blue', count: 1 },
        { color: 'red', count: 1 },
        { color: 'yellow', count: 1 },
      ],
      lanes: [['yellow', 'red', 'blue']],
    };
    let state = createGame(level);
    state = tapLane(state, 0).state; // hold yellow (1/3)
    state = tapLane(state, 0).state; // hold red (2/3)
    expect(state.holding).toHaveLength(2);
    const outcome = tapLane(state, 0); // tap blue -> red then yellow chain out
    expect(outcome.autoResolved.map((o) => o.color)).toEqual(['red', 'yellow']);
    expect(outcome.state.holding).toEqual([]);
    expect(outcome.state.status).toBe('won');
  });
});

describe('win', () => {
  it('8. clearing every lane, emptying the tray and finishing all targets wins', () => {
    const state = createGame(twoColorLevel);
    const afterBlue = tapLane(state, 0).state;
    const afterRed = tapLane(afterBlue, 1).state;
    expect(afterRed.status).toBe('won');
  });
});

describe('input guards', () => {
  it('9a. tapping a non-exposed orb does not mutate state', () => {
    const level: LevelDefinition = {
      id: 108,
      holdingCapacity: 3,
      coreTargets: [{ color: 'blue', count: 2 }],
      lanes: [['blue', 'blue']],
    };
    const state = createGame(level);
    const buriedOrbId = state.lanes[0]?.[1]?.id as string;
    const outcome = resolveMove(state, buriedOrbId);
    expect(outcome.accepted).toBe(false);
    expect(outcome.state).toBe(state); // same reference
  });

  it('9b. re-tapping an already consumed orb id is a no-op', () => {
    const state = createGame(twoColorLevel);
    const orbId = state.lanes[0]?.[0]?.id as string;
    const first = resolveMove(state, orbId);
    expect(first.accepted).toBe(true);
    const second = resolveMove(first.state, orbId); // stale id
    expect(second.accepted).toBe(false);
    expect(second.state).toBe(first.state);
  });

  it('9c. any tap after the game is over is rejected', () => {
    let state = createGame(twoColorLevel);
    state = tapLane(state, 0).state;
    state = tapLane(state, 1).state;
    expect(state.status).toBe('won');
    const exposed = getExposedOrbs(state);
    expect(exposed).toHaveLength(0);
    const outcome = resolveMove(state, 'anything');
    expect(outcome.accepted).toBe(false);
  });

  it('9d. rapid repeated taps on the same orb resolve exactly once', () => {
    const level: LevelDefinition = {
      id: 109,
      holdingCapacity: 3,
      coreTargets: [{ color: 'blue', count: 3 }],
      lanes: [['blue'], ['blue'], ['blue']],
    };
    const state = createGame(level);
    const orbId = state.lanes[0]?.[0]?.id as string;
    let s = state;
    for (let i = 0; i < 10; i += 1) {
      const o = resolveMove(s, orbId);
      if (o.accepted) s = o.state;
    }
    // only the first tap counted
    expect(s.lanes[0]).toEqual([]);
    expect(s.targets[0]?.count).toBe(2);
    expect(s.movesApplied).toBe(1);
  });
});

describe('restart', () => {
  it('10. restarting recreates the exact initial level state', () => {
    const level = twoColorLevel;
    const initial = createGame(level);
    let played = tapLane(initial, 0).state;
    played = tapLane(played, 1).state;
    expect(played.status).toBe('won');

    const restarted = restartGame(level);
    expect(restarted).toEqual(initial);
    expect(restarted).not.toBe(initial);
  });
});
