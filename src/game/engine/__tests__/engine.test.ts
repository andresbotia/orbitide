import { createGame, restartGame } from '../createGame';
import {
  clearOrder,
  reachablePixels,
  reachableTargets,
  remainingPixelCount,
} from '../pixels';
import { resolveLaunch } from '../resolveLaunch';
import { frontCharge, visibleCharges } from '../selectors';
import type { GameState, LevelDefinition } from '../types';

/** A 3x3 solid green square with a single blue centre pixel behind it. */
const squareLevel: LevelDefinition = {
  id: 900,
  title: 'Test Square',
  themeId: 'test',
  difficulty: 'easy',
  holdingCapacity: 3,
  pixelArt: ['GGG', 'GBG', 'GGG'],
  tunnels: [
    [{ color: 'green', capacity: 8 }, { color: 'blue', capacity: 1 }],
    [{ color: 'green', capacity: 4 }],
    [{ color: 'blue', capacity: 1 }],
  ],
};

function frontOf(state: GameState, tunnelIndex: number) {
  const tunnel = state.tunnels[tunnelIndex];
  if (!tunnel) throw new Error(`no tunnel ${tunnelIndex}`);
  return tunnel;
}

describe('tunnel selection', () => {
  it('1. launching a tunnel removes its front charge', () => {
    const state = createGame(squareLevel);
    expect(frontCharge(frontOf(state, 0))?.capacity).toBe(8);

    const { state: next, accepted, launchedCharge } = resolveLaunch(state, 'tunnel-0');
    expect(accepted).toBe(true);
    expect(launchedCharge?.color).toBe('green');
    expect(next.tunnels[0]?.queue).toHaveLength(1);
    // input state untouched
    expect(state.tunnels[0]?.queue).toHaveLength(2);
  });

  it('2. the next authored charge becomes the visible front charge', () => {
    const state = createGame(squareLevel);
    const outcome = resolveLaunch(state, 'tunnel-0');
    expect(outcome.revealedCharge?.color).toBe('blue');
    expect(frontCharge(frontOf(outcome.state, 0))?.color).toBe('blue');
  });
});

describe('pixel clearing', () => {
  it('3. a charge clears matching reachable pixels', () => {
    const state = createGame(squareLevel);
    const outcome = resolveLaunch(state, 'tunnel-0'); // green:8
    expect(outcome.primaryClearedPixelIds).toHaveLength(8);
    expect(outcome.primaryConsumed).toBe(true);
    expect(remainingPixelCount(outcome.state)).toBe(1); // only the blue centre
  });

  it('4. interior pixels do not clear until an outer layer exposes them', () => {
    const state = createGame(squareLevel);
    // The blue centre is enclosed by the 8 green pixels.
    expect(reachablePixels(state).some((p) => p.color === 'blue')).toBe(false);

    // A blue charge launched now finds nothing and parks.
    const blueFirst = resolveLaunch(state, 'tunnel-2'); // blue:1
    expect(blueFirst.primaryClearedPixelIds).toHaveLength(0);
    expect(blueFirst.heldCharge?.color).toBe('blue');
    expect(blueFirst.heldCharge?.capacity).toBe(1);

    // Independently: once the green shell is cleared the blue is reachable.
    const afterGreen = resolveLaunch(state, 'tunnel-0'); // green:8, no held blue
    expect(afterGreen.state.status).toBe('playing');
    expect(
      reachablePixels(afterGreen.state).some((p) => p.color === 'blue'),
    ).toBe(true);
  });

  it('5. charge capacity decreases by the number of pixels cleared', () => {
    const level: LevelDefinition = {
      ...squareLevel,
      id: 901,
      tunnels: [
        [{ color: 'green', capacity: 5 }],
        [{ color: 'green', capacity: 3 }],
        [{ color: 'blue', capacity: 1 }],
      ],
    };
    const state = createGame(level);
    const outcome = resolveLaunch(state, 'tunnel-0'); // green:5, 8 reachable
    expect(outcome.primaryClearedPixelIds).toHaveLength(5);
    expect(outcome.primaryConsumed).toBe(true);
    expect(outcome.heldCharge).toBeNull();
  });

  it('6. a charge that reaches zero capacity disappears (not held)', () => {
    const state = createGame(squareLevel);
    const outcome = resolveLaunch(state, 'tunnel-1'); // green:4, clears 4, consumed
    expect(outcome.primaryConsumed).toBe(true);
    expect(outcome.state.holding).toHaveLength(0);
  });
});

describe('holding', () => {
  it('7. a charge with leftover capacity enters Holding', () => {
    const level: LevelDefinition = {
      ...squareLevel,
      id: 902,
      tunnels: [
        [{ color: 'green', capacity: 12 }], // 8 reachable -> 4 leftover
        [{ color: 'green', capacity: 4 }],
        [{ color: 'blue', capacity: 1 }],
      ],
    };
    const state = createGame(level);
    const outcome = resolveLaunch(state, 'tunnel-0');
    expect(outcome.primaryClearedPixelIds).toHaveLength(8);
    expect(outcome.primaryConsumed).toBe(false);
    expect(outcome.state.holding.map((c) => `${c.color}:${c.capacity}`)).toEqual([
      'green:4',
    ]);
  });

  it('8. a held charge auto-reactivates once matching pixels are exposed', () => {
    const level: LevelDefinition = {
      id: 903,
      title: 'Test Held',
      themeId: 'test',
      difficulty: 'easy',
      holdingCapacity: 3,
      // green ring, red centre
      pixelArt: ['GGG', 'GRG', 'GGG'],
      tunnels: [
        [{ color: 'red', capacity: 1 }], // parks: red centre is buried
        [{ color: 'green', capacity: 8 }], // opens the shell -> red auto-clears
        [{ color: 'green', capacity: 1 }],
      ],
    };
    let state = createGame(level);
    const held = resolveLaunch(state, 'tunnel-0');
    state = held.state;
    expect(state.holding.map((c) => c.color)).toEqual(['red']);

    const opened = resolveLaunch(state, 'tunnel-1'); // green:8
    expect(opened.autoResolutions).toHaveLength(1);
    expect(opened.autoResolutions[0]?.color).toBe('red');
    expect(opened.autoResolutions[0]?.consumed).toBe(true);
    expect(opened.state.holding).toHaveLength(0);
    expect(opened.state.status).toBe('won');
  });

  it('9. auto-resolution chains safely through several layers', () => {
    const level: LevelDefinition = {
      id: 904,
      title: 'Test Chain',
      themeId: 'test',
      difficulty: 'easy',
      holdingCapacity: 3,
      // blue shell / green ring / red core
      pixelArt: ['BBBBB', 'BGGGB', 'BGRGB', 'BGGGB', 'BBBBB'],
      tunnels: [
        [{ color: 'red', capacity: 1 }, { color: 'green', capacity: 8 }],
        [{ color: 'blue', capacity: 16 }],
        [{ color: 'green', capacity: 8 }],
      ],
    };
    let state = createGame(level);
    state = resolveLaunch(state, 'tunnel-0').state; // park red:1
    state = resolveLaunch(state, 'tunnel-2').state; // park green:8 (still buried)
    expect(state.holding.map((c) => c.color).sort()).toEqual(['green', 'red']);

    const boom = resolveLaunch(state, 'tunnel-1'); // blue:16 opens everything
    // green resolves first (exposed by the blue), then red (exposed by green)
    expect(boom.autoResolutions.map((r) => r.color)).toEqual(['green', 'red']);
    expect(boom.state.holding).toHaveLength(0);
    expect(boom.state.status).toBe('won');
  });

  it('10. a full Holding tray with no possible resolution loses the level', () => {
    const level: LevelDefinition = {
      id: 905,
      title: 'Test Overflow',
      themeId: 'test',
      difficulty: 'easy',
      holdingCapacity: 3,
      // blue shell around a pink hull — every tunnel front is buried pink
      pixelArt: ['BBBBB', 'BKKKB', 'BKWKB', 'BKKKB', 'BBBBB'],
      tunnels: [
        [{ color: 'pink', capacity: 3 }, { color: 'blue', capacity: 8 }],
        [{ color: 'pink', capacity: 3 }, { color: 'blue', capacity: 8 }],
        [{ color: 'pink', capacity: 2 }],
      ],
    };
    let state = createGame(level);
    state = resolveLaunch(state, 'tunnel-0').state; // park pink:3
    state = resolveLaunch(state, 'tunnel-1').state; // park pink:3
    expect(state.status).toBe('playing');
    const dead = resolveLaunch(state, 'tunnel-2'); // park pink:2 -> 3/3, stuck
    expect(dead.state.holding).toHaveLength(3);
    expect(dead.state.status).toBe('lost');
  });

  it('11. a full tray does NOT fail when auto-resolution frees a slot the same move', () => {
    const level: LevelDefinition = {
      id: 907,
      title: 'Test Rescue 2',
      themeId: 'test',
      difficulty: 'easy',
      holdingCapacity: 3,
      pixelArt: ['BBBBB', 'BKKKB', 'BKWKB', 'BKKKB', 'BBBBB'],
      tunnels: [
        [{ color: 'blue', capacity: 16 }, { color: 'pink', capacity: 4 }],
        [{ color: 'pink', capacity: 3 }],
        [{ color: 'pink', capacity: 3 }],
      ],
    };
    let state = createGame(level);
    state = resolveLaunch(state, 'tunnel-1').state; // park pink:3 (1/3)
    state = resolveLaunch(state, 'tunnel-2').state; // park pink:3 (2/3)
    expect(state.holding).toHaveLength(2);

    const opened = resolveLaunch(state, 'tunnel-0'); // blue:16 clears the shell
    // both parked pink charges now find work; tray drains, not a loss
    expect(opened.autoResolutions.length).toBeGreaterThan(0);
    expect(opened.state.holding.length).toBeLessThan(3);
    expect(opened.state.status).toBe('playing');
  });
});

describe('win', () => {
  it('12. clearing every pixel produces a win', () => {
    let state = createGame(squareLevel);
    state = resolveLaunch(state, 'tunnel-0').state; // green:8
    expect(state.status).toBe('playing');
    const done = resolveLaunch(state, 'tunnel-2'); // blue:1 on the now-exposed centre
    expect(remainingPixelCount(done.state)).toBe(0);
    expect(done.state.status).toBe('won');
  });
});

describe('input guards', () => {
  it('13a. launching an empty tunnel does not mutate state', () => {
    let state = createGame(squareLevel);
    state = resolveLaunch(state, 'tunnel-2').state; // empties tunnel-2 (blue:1)
    const outcome = resolveLaunch(state, 'tunnel-2');
    expect(outcome.accepted).toBe(false);
    expect(outcome.state).toBe(state); // same reference
  });

  it('13b. an unknown tunnel id is rejected', () => {
    const state = createGame(squareLevel);
    const outcome = resolveLaunch(state, 'tunnel-9');
    expect(outcome.accepted).toBe(false);
    expect(outcome.state).toBe(state);
  });

  it('13c. any launch after the game is over is rejected', () => {
    let state = createGame(squareLevel);
    state = resolveLaunch(state, 'tunnel-0').state;
    state = resolveLaunch(state, 'tunnel-2').state;
    expect(state.status).toBe('won');
    const outcome = resolveLaunch(state, 'tunnel-1');
    expect(outcome.accepted).toBe(false);
  });

  it('13d. rapid repeated launches on one tunnel each consume exactly one charge', () => {
    const state = createGame(squareLevel);
    let s = state;
    let applied = 0;
    for (let i = 0; i < 8; i += 1) {
      const o = resolveLaunch(s, 'tunnel-1'); // only 1 charge in tunnel-1
      if (o.accepted) {
        s = o.state;
        applied += 1;
      }
    }
    expect(applied).toBe(1);
    expect(s.tunnels[1]?.queue).toHaveLength(0);
    expect(s.movesApplied).toBe(1);
  });
});

describe('restart', () => {
  it('14. restarting recreates the exact initial state', () => {
    const initial = createGame(squareLevel);
    let played = resolveLaunch(initial, 'tunnel-0').state;
    played = resolveLaunch(played, 'tunnel-2').state;
    expect(played.status).toBe('won');

    const restarted = restartGame(squareLevel);
    expect(restarted).toEqual(initial);
    expect(restarted).not.toBe(initial);
  });
});

describe('deterministic clear order', () => {
  it('16. the clockwise clear order is stable and starts from the top', () => {
    const level: LevelDefinition = {
      id: 908,
      title: 'Test Ring',
      themeId: 'test',
      difficulty: 'easy',
      holdingCapacity: 3,
      pixelArt: ['.G.', 'G.G', '.G.'],
      tunnels: [
        [{ color: 'green', capacity: 1 }],
        [{ color: 'green', capacity: 1 }],
        [{ color: 'green', capacity: 2 }],
      ],
    };
    const state = createGame(level);
    const order = reachableTargets(state, 'green');
    // top, right, bottom, left
    expect(order.map((p) => `${p.x},${p.y}`)).toEqual(['1,0', '2,1', '1,2', '0,1']);

    // Sorting is a pure comparator; applying it twice is idempotent.
    const twice = [...order].sort(clearOrder(state));
    expect(twice).toEqual(order);

    // A capacity-1 green charge always clears the top pixel first.
    const outcome = resolveLaunch(state, 'tunnel-0');
    expect(outcome.primaryClearedPixelIds).toEqual([order[0]?.id]);
  });

  it('is fully deterministic — the same launch sequence yields identical state', () => {
    const run = () => {
      let s = createGame(squareLevel);
      for (const t of ['tunnel-0', 'tunnel-1', 'tunnel-2', 'tunnel-0']) {
        s = resolveLaunch(s, t).state;
      }
      return s;
    };
    expect(run()).toEqual(run());
  });

  it('survives rapid random launches without corrupting state', () => {
    const level: LevelDefinition = {
      id: 909,
      title: 'Test Stress',
      themeId: 'test',
      difficulty: 'easy',
      holdingCapacity: 3,
      pixelArt: ['BBBBB', 'BKGKB', 'BGWGB', 'BKGKB', 'BBBBB'],
      tunnels: [
        [
          { color: 'blue', capacity: 4 },
          { color: 'pink', capacity: 2 },
          { color: 'green', capacity: 3 },
          { color: 'white', capacity: 1 },
        ],
        [
          { color: 'blue', capacity: 8 },
          { color: 'green', capacity: 2 },
          { color: 'pink', capacity: 2 },
        ],
        [{ color: 'blue', capacity: 4 }, { color: 'green', capacity: 1 }],
      ],
    };

    // Deterministic pseudo-random tap stream.
    let seed = 12345;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    let state = createGame(level);
    const totalPixels = state.pixels.length;

    for (let i = 0; i < 300; i += 1) {
      const target = `tunnel-${Math.floor(rnd() * 4)}`; // sometimes tunnel-3 (invalid)
      const before = state;
      const outcome = resolveLaunch(state, target);
      state = outcome.state;

      if (!outcome.accepted) {
        expect(state).toBe(before); // rejected launches never change state
      }

      // Invariants that must always hold.
      expect(state.pixels).toHaveLength(totalPixels);
      const clearedCount = state.pixels.filter((p) => p.cleared).length;
      expect(clearedCount).toBeGreaterThanOrEqual(0);
      expect(state.holding.length).toBeLessThanOrEqual(state.holdingCapacity + 1);
      for (const c of state.holding) expect(c.capacity).toBeGreaterThan(0);
      const ids = state.holding.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length); // no duplicate held charges
      for (const t of state.tunnels) {
        for (const c of t.queue) expect(c.capacity).toBeGreaterThan(0);
      }

      if (state.status !== 'playing') break;
    }

    expect(['playing', 'won', 'lost']).toContain(state.status);
  });

  it('visibleCharges reports one entry per tunnel, front first', () => {
    const state = createGame(squareLevel);
    expect(visibleCharges(state)).toEqual([
      { tunnelId: 'tunnel-0', charge: state.tunnels[0]?.queue[0] },
      { tunnelId: 'tunnel-1', charge: state.tunnels[1]?.queue[0] },
      { tunnelId: 'tunnel-2', charge: state.tunnels[2]?.queue[0] },
    ]);
  });
});
