import { actionRejection, legalActions, type GameAction } from '../actions';
import { createGame } from '../createGame';
import { resolveAction } from '../resolveLaunch';
import { DEFAULT_HOLDING_CAPACITY_V2, defaultHoldingCapacity } from '../ruleset';
import type { LevelDefinition } from '../types';
import { computeStatus, isLost, isWon } from '../winState';
import { holdingSlotFor } from '../../presentation/holdingSlot';
import { buildLaunchScript } from '../../presentation/buildScript';

const T = (i: number): GameAction => ({ kind: 'tunnel', id: `tunnel-${i}` });

function missLevel(extra: Partial<LevelDefinition> = {}): LevelDefinition {
  return {
    id: 9600,
    title: 'Holding overflow',
    themeId: 'test',
    difficulty: 'easy',
    holdingCapacity: 3,
    ruleset: 'coreV2',
    pixelArt: ['WWW', 'WWW', 'WWW'],
    tunnels: [
      [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
      [{ color: 'blue', capacity: 1 }],
      [{ color: 'blue', capacity: 1 }],
      [{ color: 'white', capacity: 9 }],
    ],
    ...extra,
  };
}

function fillHolding() {
  let state = createGame(missLevel());
  state = resolveAction(state, T(0)).state;
  state = resolveAction(state, T(1)).state;
  state = resolveAction(state, T(2)).state;
  expect(state.holding).toHaveLength(3);
  expect(state.status).toBe('playing');
  return state;
}

test('A — capacity is 3: Core V2 holdingCapacity === 3', () => {
  expect(DEFAULT_HOLDING_CAPACITY_V2).toBe(3);
  expect(defaultHoldingCapacity('coreV2')).toBe(3);
  const state = createGame(missLevel());
  expect(state.holdingCapacity).toBe(3);
});

test('B — fill all three slots: A, B, C enter holding, remain present and distinct', () => {
  const state = fillHolding();
  expect(state.holding).toHaveLength(3);
  const ids = new Set(state.holding.map((c) => c.id));
  expect(ids.size).toBe(3);
  expect(state.status).toBe('playing');
});

test('C — fourth unresolved Pal causes loss without replacing existing or silently disappearing', () => {
  const state = fillHolding();
  const heldBefore = state.holding.map((c) => ({ ...c }));
  const outcome = resolveAction(state, T(0));
  expect(outcome.accepted).toBe(true);
  expect(outcome.state.status).toBe('lost');
  // A, B, C remain unchanged
  expect(outcome.state.holding).toEqual(heldBefore);
  // D does not replace any of them
  expect(outcome.state.holding.some((c) => c.id === outcome.launchedCharge!.id)).toBe(false);
  // D does not silently disappear
  expect(outcome.launchedCharge).toBeDefined();
  expect(outcome.heldCharge?.id).toBe(outcome.launchedCharge!.id);
  expect(outcome.heldCharge!.capacity).toBeGreaterThan(0);
  expect(outcome.epochCharges?.some((c) => c.id === outcome.launchedCharge!.id)).toBe(true);
});

test('D — no slot reuse: exact same occupants before and after overflow attempt', () => {
  const state = fillHolding();
  const slot0Before = state.holding[0];
  const slot1Before = state.holding[1];
  const slot2Before = state.holding[2];

  const outcome = resolveAction(state, T(0));
  expect(outcome.state.holding[0]).toEqual(slot0Before);
  expect(outcome.state.holding[1]).toEqual(slot1Before);
  expect(outcome.state.holding[2]).toEqual(slot2Before);

  // Presentation slots come from truth order: the overflow Pal has none.
  expect(holdingSlotFor(outcome.state.holding, outcome.launchedCharge!.id)).toBe(-1);
});

test('E — full holding launch may still succeed if Pal fully resolves', () => {
  const state = fillHolding();
  const ids = state.holding.map((c) => c.id);
  const outcome = resolveAction(state, T(3));
  expect(outcome.accepted).toBe(true);
  expect(outcome.state.status).toBe('won');
  expect(outcome.heldCharge).toBeNull();
  expect(outcome.state.holding.map((c) => c.id)).toEqual(ids);
});

test('F — full holding launch requiring park loses', () => {
  const state = fillHolding();
  expect(actionRejection(state, T(0))).toBeNull();
  expect(legalActions(state).some((a) => a.kind === 'tunnel' && a.id === 'tunnel-0')).toBe(true);
  const outcome = resolveAction(state, T(0));
  expect(outcome.accepted).toBe(true);
  expect(outcome.state.status).toBe('lost');
  expect(outcome.heldCharge).not.toBeNull();
});

test('G — concurrent overflow: final slot taken by ordering, next needing holding causes loss', () => {
  let state = createGame(missLevel());
  state = resolveAction(state, T(0)).state;
  state = resolveAction(state, T(1)).state;
  expect(state.holding).toHaveLength(2);
  const priorHeld = state.holding.map((c) => c.id);

  const joinOutcome = resolveAction(state, { ...T(2), join: true });
  expect(joinOutcome.accepted).toBe(true);
  expect(joinOutcome.state.status).toBe('playing');
  expect(joinOutcome.state.holding).toHaveLength(3);

  const overflowJoin = resolveAction(joinOutcome.state, { ...T(0), join: true });
  expect(overflowJoin.accepted).toBe(true);
  expect(overflowJoin.state.status).toBe('lost');
  expect(overflowJoin.state.holding).toHaveLength(3);
  expect(priorHeld.every((id) => overflowJoin.state.holding.some((c) => c.id === id))).toBe(true);
});

test('H — terminal lock: once lost, no additional launches, insertions, or win transitions', () => {
  const lostState = resolveAction(fillHolding(), T(0)).state;
  expect(lostState.status).toBe('lost');

  // No additional normal launches
  const tunnelAttempt = resolveAction(lostState, T(3));
  expect(tunnelAttempt.accepted).toBe(false);
  expect(tunnelAttempt.rejection).toBe('gameOver');

  // No additional holding insertions
  const holdingAttempt = resolveAction(lostState, { kind: 'holding', id: lostState.holding[0]!.id });
  expect(holdingAttempt.accepted).toBe(false);
  expect(holdingAttempt.rejection).toBe('gameOver');

  // No accidental win transition
  expect(computeStatus(lostState)).toBe('lost');
  expect(isLost(lostState)).toBe(true);
  expect(isWon(lostState)).toBe(false);
});

test('I — authoritative regression: full holding [A, B, C] + launching Pal D with partial hits and overflow preserves [A, B, C] and timing', () => {
  // Exact scenario: Holding is full at 3/3 with Blue 1, Yellow 11, Yellow 13.
  // Board has 1 Green pixel. Green 9 launches, hits 1 green pixel, becomes Green 8.
  // Green 8 must NOT enter holding; Blue 1 / Yellow 11 / Yellow 13 must remain unchanged;
  // Green 8 bursts at terminal point; status is lost.
  const level: LevelDefinition = {
    id: 9620,
    title: 'Partial Overflow Regression',
    themeId: 'test',
    difficulty: 'easy',
    holdingCapacity: 3,
    ruleset: 'coreV2',
    pixelArt: [
      'G..',
      'WWW',
      'WWW',
    ],
    tunnels: [
      [{ color: 'blue', capacity: 1 }],
      [{ color: 'yellow', capacity: 11 }],
      [{ color: 'yellow', capacity: 13 }],
      [{ color: 'green', capacity: 9 }],
    ],
  };

  let state = createGame(level);
  // Fill holding to 3/3 with slots 0, 1, 2
  state = resolveAction(state, T(0)).state;
  state = resolveAction(state, T(1)).state;
  state = resolveAction(state, T(2)).state;
  expect(state.holding).toHaveLength(3);
  expect(state.holding[0]).toMatchObject({ color: 'blue', capacity: 1 });
  expect(state.holding[1]).toMatchObject({ color: 'yellow', capacity: 11 });
  expect(state.holding[2]).toMatchObject({ color: 'yellow', capacity: 13 });
  const occupantsBefore = state.holding.map((c) => ({ ...c }));

  // Launch Green 9 (tunnel-3)
  const outcome = resolveAction(state, T(3));
  expect(outcome.accepted).toBe(true);
  expect(outcome.launchedCharge).toMatchObject({ color: 'green', capacity: 9 });
  // It hit 1 pixel and has 8 remaining capacity
  expect(outcome.heldCharge).toMatchObject({ color: 'green', capacity: 8 });

  // Invariant 1: outcome.state.status must be 'lost'
  expect(outcome.state.status).toBe('lost');

  // Invariant 2: Green 8 must NOT enter holding
  expect(outcome.state.holding.some((c) => c.color === 'green')).toBe(false);

  // Invariant 3: Blue 1, Yellow 11, Yellow 13 must remain strictly unchanged and intact
  expect(outcome.state.holding).toHaveLength(3);
  expect(outcome.state.holding).toEqual(occupantsBefore);

  // Invariant 4: Presentation script must NOT have holdingLanded, must burst at terminal point
  const script = buildLaunchScript(outcome, state, 1);
  expect(script.pass.terminal).toEqual({ kind: 'reject' }); // no slot, no target
  expect(script.pass.events.some((e) => e.kind === 'holdingLanded')).toBe(false);
  const failEvent = script.pass.events.find((e) => e.kind === 'fail');
  expect(failEvent).toBeDefined();
  // Lap completes to the terminal point before bursting
  expect(script.pass.endProgress).toBe(1);
  expect(script.pass.landingAt).toBeGreaterThan(script.pass.orbitEndAt);
});

test('J — authoritative regression: full holding [A, B, C] + launching Pal D with 0 hits and overflow preserves [A, B, C] and timing', () => {
  // Exact scenario: Holding is full at 3/3 with Blue 1, Yellow 11, Yellow 13.
  // Board has NO Green pixels (only Purple). Green 9 launches, hits 0 pixels, remains Green 9.
  // Green 9 must NOT enter holding; Blue 1 / Yellow 11 / Yellow 13 remain intact;
  // Green 9 bursts at terminal point; status is lost.
  const level: LevelDefinition = {
    id: 9621,
    title: 'Zero Hit Overflow Regression',
    themeId: 'test',
    difficulty: 'easy',
    holdingCapacity: 3,
    ruleset: 'coreV2',
    pixelArt: [
      'P..',
      '...',
      '...',
    ],
    tunnels: [
      [{ color: 'blue', capacity: 1 }],
      [{ color: 'yellow', capacity: 11 }],
      [{ color: 'yellow', capacity: 13 }],
      [{ color: 'green', capacity: 9 }],
    ],
  };

  let state = createGame(level);
  state = resolveAction(state, T(0)).state;
  state = resolveAction(state, T(1)).state;
  state = resolveAction(state, T(2)).state;
  expect(state.holding).toHaveLength(3);
  const occupantsBefore = state.holding.map((c) => ({ ...c }));

  // Launch Green 9 (tunnel-3)
  const outcome = resolveAction(state, T(3));
  expect(outcome.accepted).toBe(true);
  expect(outcome.launchedCharge).toMatchObject({ color: 'green', capacity: 9 });
  expect(outcome.heldCharge).toMatchObject({ color: 'green', capacity: 9 });

  // Invariants
  expect(outcome.state.status).toBe('lost');
  expect(outcome.state.holding.some((c) => c.color === 'green')).toBe(false);
  expect(outcome.state.holding).toEqual(occupantsBefore);

  const script = buildLaunchScript(outcome, state, 1);
  expect(script.pass.terminal).toEqual({ kind: 'reject' }); // no slot, no target
  expect(script.pass.events.some((e) => e.kind === 'holdingLanded')).toBe(false);
  expect(script.pass.events.some((e) => e.kind === 'fail')).toBe(true);
  expect(script.pass.endProgress).toBe(1);
});
