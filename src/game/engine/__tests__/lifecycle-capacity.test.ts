import { DEFAULT_ACTIVE_CAPACITY } from '../concurrency';
import { actionRejection, legalActions } from '../actions';
import { createGame } from '../createGame';
import { activeCapacity, activeCount } from '../selectors';
import { resolveAction } from '../resolveLaunch';
import { resolveHoldingLaunch } from '../resolveHolding';
import { resolvePass } from '../pass';
import { isProductiveAction } from '../winState';
import type { LevelDefinition } from '../types';

const v2 = (
  pixelArt: string[],
  tunnels: LevelDefinition['tunnels'],
  extra: Partial<LevelDefinition> = {},
): LevelDefinition => {
  const queues = [...(extra.tunnels ?? tunnels)];
  while (queues.length < 4) queues.push([]);
  return {
    id: extra.id ?? 8300,
    title: extra.title ?? 'Lifecycle',
    themeId: 'test',
    difficulty: 'easy',
    holdingCapacity: extra.holdingCapacity ?? 4,
    pixelArt,
    ...extra,
    tunnels: queues,
    ruleset: extra.ruleset ?? 'coreV2',
  };
};

const T = (i: number, join = false) => ({
  kind: 'tunnel' as const,
  id: `tunnel-${i}`,
  ...(join ? { join: true } : {}),
});
const J = (i: number) => T(i, true);
const missTunnels = (): LevelDefinition['tunnels'] => [
  [{ color: 'blue', capacity: 2 }, { color: 'blue', capacity: 2 }, { color: 'blue', capacity: 2 }],
  [{ color: 'blue', capacity: 2 }, { color: 'blue', capacity: 2 }, { color: 'blue', capacity: 2 }],
  [{ color: 'blue', capacity: 2 }, { color: 'blue', capacity: 2 }, { color: 'blue', capacity: 2 }],
];

describe('active capacity defaults', () => {
  test('new Core V2 game gets activeCapacity 5 and activeCount 0', () => {
    const state = createGame(v2(['R'], [[{ color: 'red', capacity: 1 }], [], []]));
    expect(state.activeCapacity).toBe(DEFAULT_ACTIVE_CAPACITY);
    expect(state.activeCapacity).toBe(5);
    expect(activeCapacity(state)).toBe(5);
    expect(activeCount(state)).toBe(0);
    expect(state.epoch).toBeNull();
  });
});

describe('capacity admission', () => {
  const def = v2(['WWW', 'WWW', 'WWW'], missTunnels(), { id: 8301, holdingCapacity: 8 });

  test('launches 1..5 join; the sixth concurrent join is denied with no mutation', () => {
    let state = createGame(def);
    const first = resolveAction(state, T(0));
    expect(first.accepted).toBe(true);
    state = first.state;
    for (const a of [J(1), J(2), J(0), J(1)]) {
      const out = resolveAction(state, a);
      expect(out.accepted).toBe(true);
      state = out.state;
    }
    expect(activeCount(state)).toBe(5);
    expect(state.epoch!.launches).toHaveLength(5);

    const before = state;
    const queue = state.tunnels[2]!.queue.slice();
    const sixth = resolveAction(state, J(2));
    expect(sixth.accepted).toBe(false);
    expect(sixth.rejection).toBe('activeSlotsFull');
    expect(sixth.state).toBe(before);
    expect(sixth.state.tunnels[2]!.queue).toEqual(queue);
    expect(sixth.state.movesApplied).toBe(before.movesApplied);
    expect(activeCount(sixth.state)).toBe(5);
  });

  test('denied Holding relaunch does not free the Holding slot', () => {
    const full = v2(['WWW', 'WWW', 'WWW'], missTunnels(), { id: 8303, holdingCapacity: 8 });
    let busy = resolveAction(createGame(full), T(0)).state;
    for (const a of [J(1), J(2), J(0), J(1)]) busy = resolveAction(busy, a).state;
    expect(activeCount(busy)).toBe(5);
    busy = { ...busy, holding: [{ id: 'held-blue', color: 'blue', capacity: 2 }] };
    const before = busy;
    const denied = resolveAction(busy, { kind: 'holding', id: 'held-blue', join: true });
    expect(denied.accepted).toBe(false);
    expect(denied.rejection).toBe('activeSlotsFull');
    expect(denied.state).toBe(before);
    expect(denied.state.holding.map((c) => c.id)).toEqual(['held-blue']);
  });
});

describe('variable capacity', () => {
  test('activeCapacity 6 makes the sixth concurrent join legal', () => {
    const def = v2(['WWW', 'WWW', 'WWW'], missTunnels(), {
      id: 8304, holdingCapacity: 8, activeCapacity: 6,
    });
    let state = resolveAction(createGame(def), T(0)).state;
    expect(state.activeCapacity).toBe(6);
    for (const a of [J(1), J(2), J(0), J(1)]) state = resolveAction(state, a).state;
    expect(activeCount(state)).toBe(5);
    const sixth = resolveAction(state, J(2));
    expect(sixth.accepted).toBe(true);
    expect(activeCount(sixth.state)).toBe(6);
    const seventh = resolveAction(sixth.state, J(0));
    expect(seventh.accepted).toBe(false);
    expect(seventh.rejection).toBe('activeSlotsFull');
  });
});

describe('slot release', () => {
  test('a consumed or Holding landing still occupies the epoch slot until a new epoch', () => {
    const def = v2(['R'], [[{ color: 'red', capacity: 1 }], [{ color: 'blue', capacity: 2 }], []], { id: 8305 });
    const consumed = resolveAction(createGame(def), T(0));
    expect(consumed.heldCharge).toBeNull();
    expect(consumed.state.activeCharges[0]!.landed).toBe('consumed');
    expect(activeCount(consumed.state)).toBe(1);

    const parked = resolveAction(createGame(def), T(1));
    expect(parked.heldCharge?.capacity).toBe(2);
    expect(parked.state.activeCharges[0]!.landed).toBe('holding');
    expect(activeCount(parked.state)).toBe(1);
  });

  test('a no-target mid-pass does not free the join slot early', () => {
    const def = v2(['WWW', 'WWW', 'WWW'], missTunnels(), { id: 8306, holdingCapacity: 8 });
    let state = resolveAction(createGame(def), T(0)).state;
    expect(state.holding).toHaveLength(1);
    expect(activeCount(state)).toBe(1);
    state = resolveAction(state, J(1)).state;
    expect(activeCount(state)).toBe(2);
  });

  test('a settle-first launch after a full epoch is a new epoch (slots opened)', () => {
    const def = v2(['WWW', 'WWW', 'WWW'], missTunnels(), { id: 8307, holdingCapacity: 8 });
    let state = resolveAction(createGame(def), T(0)).state;
    for (const a of [J(1), J(2), J(0), J(1)]) state = resolveAction(state, a).state;
    expect(activeCount(state)).toBe(5);
    expect(actionRejection(state, J(2))).toBe('activeSlotsFull');
    const next = resolveAction(state, T(2));
    expect(next.accepted).toBe(true);
    expect(next.joinedEpoch).toBe(false);
    expect(activeCount(next.state)).toBe(1);
  });
});

describe('Core V2 tunnel launch with no current target', () => {
  test('launch is accepted, completes a zero-hit pass, and parks full capacity', () => {
    const def = v2(['RRR'], [[{ color: 'blue', capacity: 3 }], [], []], { id: 8308 });
    expect(actionRejection(createGame(def), T(0))).toBeNull();
    const out = resolveAction(createGame(def), T(0));
    expect(out.accepted).toBe(true);
    expect(out.pass!.encounters).toEqual([]);
    expect(out.heldCharge).toEqual({ id: 'L8308-t0-c0', color: 'blue', capacity: 3 });
    expect(out.state.holding).toEqual([out.heldCharge]);
    expect(out.state.tunnels[0]!.queue).toEqual([]);
  });
});

describe('Holding relaunch with no current target', () => {
  test('is accepted while the level is still alive, and re-parks identity/capacity', () => {
    // A second tunnel Pal keeps a productive action available, so the level is
    // alive and the no-target relaunch is admitted (both rulesets).
    const def = v2(
      ['RRR'],
      [[{ color: 'blue', capacity: 2 }], [{ color: 'red', capacity: 1 }], []],
      { id: 8309 },
    );
    const parked = resolveAction(createGame(def), T(0));
    const id = parked.heldCharge!.id;
    expect(parked.state.holding).toHaveLength(1);
    expect(parked.state.status).toBe('playing');
    const relaunch = resolveHoldingLaunch(parked.state, id);
    expect(relaunch.accepted).toBe(true);
    expect(relaunch.rejection).toBeUndefined();
    expect(relaunch.launchedCharge).toEqual({ id, color: 'blue', capacity: 2 });
    expect(relaunch.pass!.encounters).toEqual([]);
    expect(relaunch.state.holding).toEqual([{ id, color: 'blue', capacity: 2 }]);
    expect(relaunch.state.holding[0]!.id).toBe(id);
  });

  test('but a tray of no-op Pals with nothing else left is a deadlock, not a loop', () => {
    // Same board, no second tunnel Pal: once the blue parks, every remaining
    // action is a lap that meets nothing and returns to the same logical
    // state. That is lost, not infinitely playable.
    const def = v2(['RRR'], [[{ color: 'blue', capacity: 2 }], [], []], { id: 8319 });
    const parked = resolveAction(createGame(def), T(0));
    expect(parked.state.holding).toHaveLength(1);
    expect(parked.state.status).toBe('lost');
  });
});

describe('directional exposure after relaunch', () => {
  test('first pass peels the front; relaunch clears the newly exposed rear', () => {
    const def = v2(
      ['BBB', 'BRB', 'BRB'],
      [[{ color: 'red', capacity: 2 }], [], []],
      { id: 8310 },
    );
    const first = resolveAction(createGame(def), T(0));
    expect(first.heldCharge?.capacity).toBe(1);
    expect(first.state.pixels.find((p) => p.id === 'L8310-p1-1')!.cleared).toBe(false);
    const relaunch = resolveHoldingLaunch(first.state, first.heldCharge!.id);
    expect(relaunch.accepted).toBe(true);
    expect(relaunch.pass!.encounters.map((e) => e.pixelId)).toEqual(['L8310-p1-1']);
    expect(relaunch.state.pixels.find((p) => p.id === 'L8310-p1-1')!.cleared).toBe(true);
  });
});

describe('one-pass lifecycle', () => {
  test('a Core V2 pass still finishes at progress 1 with remainder in Holding', () => {
    const def = v2(['R'], [[{ color: 'blue', capacity: 4 }], [], []], { id: 8311 });
    const pass = resolvePass(createGame(def), { id: 'c', color: 'blue', capacity: 4 });
    expect(pass.progress).toBe(1);
    expect(pass.phase).toBe('finished');
    expect(pass.encounters).toEqual([]);
    expect(pass.charge.capacity).toBe(4);
  });
});

describe('Legacy V1 compatibility', () => {
  test('held charge with no targets is admitted, exactly like Core V2', () => {
    const def: LevelDefinition = {
      id: 8312, title: 'V1', themeId: 'test', difficulty: 'easy', holdingCapacity: 3,
      pixelArt: ['WWW', 'WBW', 'WWW'],
      tunnels: [[{ color: 'white', capacity: 8 }], [{ color: 'blue', capacity: 1 }], []],
    };
    const state = resolveAction(createGame(def), T(1)).state;
    expect(state.ruleset).toBe('legacyV1');
    // The blue core is buried, and tunnel-0 still holds a white Pal, so the
    // level is alive and the held blue may take its lap anyway.
    const result = resolveHoldingLaunch(state, state.holding[0]!.id);
    expect(result.accepted).toBe(true);
    expect(result.rejection).toBeUndefined();
    expect(result.pass!.encounters).toEqual([]);
  });

  test('a sixth V1 join opens a fresh epoch instead of activeSlotsFull', () => {
    const def: LevelDefinition = {
      id: 8313, title: 'V1cap', themeId: 'test', difficulty: 'easy', holdingCapacity: 8,
      pixelArt: ['WWW', 'WWW', 'WWW'],
      tunnels: missTunnels(),
    };
    let state = resolveAction(createGame(def), T(0)).state;
    for (const a of [J(1), J(2), J(0), J(1)]) state = resolveAction(state, a).state;
    expect(activeCount(state)).toBe(5);
    const sixth = resolveAction(state, J(2));
    expect(sixth.accepted).toBe(true);
    expect(sixth.joinedEpoch).toBe(false);
    expect(activeCount(sixth.state)).toBe(1);
  });

  test('legalActions lists a V1 held relaunch even with its colour buried', () => {
    const def: LevelDefinition = {
      id: 8314, title: 'V1hold', themeId: 'test', difficulty: 'easy', holdingCapacity: 3,
      pixelArt: ['WWW', 'WBW', 'WWW'],
      tunnels: [[{ color: 'white', capacity: 8 }], [{ color: 'blue', capacity: 1 }], []],
    };
    const parked = resolveAction(createGame(def), T(1)).state;
    // Admission no longer depends on current exposure (either ruleset); the
    // deadlock check, not the admission filter, decides whether such a lap is
    // still worth anything.
    expect(legalActions(parked).some((a) => a.kind === 'holding')).toBe(true);
    expect(isProductiveAction(parked, { kind: 'holding', id: parked.holding[0]!.id })).toBe(false);
    // The white tunnel Pal is what keeps this state alive.
    expect(isProductiveAction(parked, T(0))).toBe(true);
    expect(parked.status).toBe('playing');
  });
});
