import { actionRejection, legalActions, type GameAction } from '../actions';
import { createGame } from '../createGame';
import { resolveAction } from '../resolveLaunch';
import { DEFAULT_HOLDING_CAPACITY_V2, defaultHoldingCapacity } from '../ruleset';
import type { LevelDefinition } from '../types';
import { computeStatus, isLost, isWon } from '../winState';
import { reserveHoldingSlot } from '../../presentation/holdingSlot';

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

  // Presentation reservation also rejects slot reuse
  expect(reserveHoldingSlot(state.holding, [], state.holdingCapacity)).toBe(-1);
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
