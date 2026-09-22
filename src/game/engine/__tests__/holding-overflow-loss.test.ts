import { actionRejection, legalActions, type GameAction } from '../actions';
import { createGame } from '../createGame';
import { resolveAction } from '../resolveLaunch';
import { DEFAULT_HOLDING_CAPACITY_V2, defaultHoldingCapacity } from '../ruleset';
import type { LevelDefinition } from '../types';
import { computeStatus, isLost, isWon } from '../winState';
import { resolveArrival } from '../holdingArrival';
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
      [{ color: 'blue', capacity: 1 }, { color: 'white', capacity: 9 }],
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

test('C — a fourth unresolved Pal waits for the Gate; it replaces nothing and vanishes nowhere', () => {
  const state = fillHolding();
  const heldBefore = state.holding.map((c) => ({ ...c }));
  const outcome = resolveAction(state, T(0));
  expect(outcome.accepted).toBe(true);
  // Not lost at launch any more: the Pal is inbound and still rescuable.
  expect(outcome.state.status).toBe('playing');
  expect(outcome.state.pendingHolding.map((p) => p.charge.id)).toEqual([outcome.launchedCharge!.id]);
  // It commits at the Gate, and with no rescue that is the loss.
  const arrival = resolveArrival(outcome.state);
  expect(arrival.rejected?.id).toBe(outcome.launchedCharge!.id);
  expect(arrival.admitted).toBeNull();
  expect(arrival.state.status).toBe('lost');
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

  // Presentation slots come from truth order: an inbound Pal has none yet, and
  // still has none after a rejected arrival.
  expect(holdingSlotFor(outcome.state.holding, outcome.launchedCharge!.id)).toBe(-1);
  const rejected = resolveArrival(outcome.state).state;
  expect(rejected.holding).toEqual([slot0Before, slot1Before, slot2Before]);
  expect(holdingSlotFor(rejected.holding, outcome.launchedCharge!.id)).toBe(-1);
});

test('E — full holding launch may still succeed if Pal fully resolves', () => {
  const state = fillHolding();
  const ids = state.holding.map((c) => c.id);
  const outcome = resolveAction(state, T(2));
  expect(outcome.accepted).toBe(true);
  expect(outcome.state.status).toBe('won');
  expect(outcome.heldCharge).toBeNull();
  expect(outcome.state.holding.map((c) => c.id)).toEqual(ids);
});

test('F — a full-tray launch that needs a slot loses only when it lands', () => {
  const state = fillHolding();
  expect(actionRejection(state, T(0))).toBeNull();
  expect(legalActions(state).some((a) => a.kind === 'tunnel' && a.id === 'tunnel-0')).toBe(true);
  const outcome = resolveAction(state, T(0));
  expect(outcome.accepted).toBe(true);
  expect(outcome.heldCharge).not.toBeNull();
  // Playing while it travels...
  expect(outcome.state.status).toBe('playing');
  // ...and lost on the arrival beat if nothing freed a slot in the meantime.
  expect(resolveArrival(outcome.state).state.status).toBe('lost');
});

test('F2 — RESCUE: a relaunch during the flight frees the slot, and the Pal lands', () => {
  const state = fillHolding();
  const inbound = resolveAction(state, T(0));
  const pendingId = inbound.state.pendingHolding[0]!.charge.id;
  expect(inbound.state.status).toBe('playing');

  // The player spends an Active slot on a held Pal: it leaves the tray at once.
  const freed = resolveAction(inbound.state, { kind: 'holding', id: inbound.state.holding[0]!.id });
  expect(freed.accepted).toBe(true);
  expect(freed.state.holding).toHaveLength(2);
  // The rescuing Pal queues BEHIND the inbound one, so it cannot steal the slot.
  expect(freed.state.pendingHolding.map((p) => p.charge.id)[0]).toBe(pendingId);

  // The inbound Pal reaches the Gate: there is room now.
  const arrival = resolveArrival(freed.state);
  expect(arrival.admitted?.id).toBe(pendingId);
  expect(arrival.rejected).toBeNull();
  expect(arrival.state.status).toBe('playing');
  expect(arrival.state.holding.map((c) => c.id)).toContain(pendingId);
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
  expect(overflowJoin.state.status).toBe('playing');
  expect(overflowJoin.state.holding).toHaveLength(3);
  expect(priorHeld.every((id) => overflowJoin.state.holding.some((c) => c.id === id))).toBe(true);
  // The ordering still decides it — the last Pal is the one that finds no slot.
  const arrival = resolveArrival(overflowJoin.state);
  expect(arrival.rejected?.id).toBe(overflowJoin.launchedCharge!.id);
  expect(arrival.state.status).toBe('lost');
});

test('H — terminal lock: once the arrival rejects, nothing more may happen', () => {
  const lostState = resolveArrival(resolveAction(fillHolding(), T(0)).state).state;
  expect(lostState.status).toBe('lost');

  // No additional normal launches
  const tunnelAttempt = resolveAction(lostState, T(2));
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
      [{ color: 'blue', capacity: 1 }, { color: 'green', capacity: 9 }],
      [{ color: 'yellow', capacity: 11 }],
      [{ color: 'yellow', capacity: 13 }],
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

  // Launch Green 9 (tunnel-0)
  const outcome = resolveAction(state, T(0));
  expect(outcome.accepted).toBe(true);
  expect(outcome.launchedCharge).toMatchObject({ color: 'green', capacity: 9 });
  // It hit 1 pixel and has 8 remaining capacity
  expect(outcome.heldCharge).toMatchObject({ color: 'green', capacity: 8 });

  // Invariant 1: provisional — playing while it flies, lost when it lands with
  // the tray still full. Its combat above is already fixed and unchanged.
  expect(outcome.state.status).toBe('playing');
  expect(outcome.state.pendingHolding.map((p) => p.charge.id)).toEqual([outcome.launchedCharge!.id]);
  expect(resolveArrival(outcome.state).state.status).toBe('lost');

  // Invariant 2: Green 8 must NOT enter holding
  expect(outcome.state.holding.some((c) => c.color === 'green')).toBe(false);

  // Invariant 3: Blue 1, Yellow 11, Yellow 13 must remain strictly unchanged and intact
  expect(outcome.state.holding).toHaveLength(3);
  expect(outcome.state.holding).toEqual(occupantsBefore);

  // Invariant 4: Presentation script must NOT have holdingLanded, must burst at terminal point
  const script = buildLaunchScript(outcome, state, 1);
  // Provisional: it flies the full lap and is judged at the Gate.
  expect(script.pass.terminal).toEqual({ kind: 'pendingHolding' });
  expect(script.pass.events.some((e) => e.kind === 'holdingArrival')).toBe(true);
  expect(script.pass.events.some((e) => e.kind === 'holdingLanded')).toBe(false);
  // No outcome is baked in at launch any more: the loss belongs to the arrival.
  expect(script.pass.events.some((e) => e.kind === 'fail')).toBe(false);
  // The lap still completes to the Gate, and the decision sits exactly there.
  expect(script.pass.endProgress).toBe(1);
  expect(script.pass.events.find((e) => e.kind === 'holdingArrival')!.at)
    .toBe(script.pass.orbitEndAt);
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
      [{ color: 'blue', capacity: 1 }, { color: 'green', capacity: 9 }],
      [{ color: 'yellow', capacity: 11 }],
      [{ color: 'yellow', capacity: 13 }],
    ],
  };

  let state = createGame(level);
  state = resolveAction(state, T(0)).state;
  state = resolveAction(state, T(1)).state;
  state = resolveAction(state, T(2)).state;
  expect(state.holding).toHaveLength(3);
  const occupantsBefore = state.holding.map((c) => ({ ...c }));

  // Launch Green 9 (tunnel-0)
  const outcome = resolveAction(state, T(0));
  expect(outcome.accepted).toBe(true);
  expect(outcome.launchedCharge).toMatchObject({ color: 'green', capacity: 9 });
  expect(outcome.heldCharge).toMatchObject({ color: 'green', capacity: 9 });

  // Invariants
  expect(outcome.state.status).toBe('playing');
  expect(resolveArrival(outcome.state).state.status).toBe('lost');
  expect(outcome.state.holding.some((c) => c.color === 'green')).toBe(false);
  expect(outcome.state.holding).toEqual(occupantsBefore);

  const script = buildLaunchScript(outcome, state, 1);
  // Provisional: it flies the full lap and is judged at the Gate.
  expect(script.pass.terminal).toEqual({ kind: 'pendingHolding' });
  expect(script.pass.events.some((e) => e.kind === 'holdingArrival')).toBe(true);
  expect(script.pass.events.some((e) => e.kind === 'holdingLanded')).toBe(false);
  expect(script.pass.events.some((e) => e.kind === 'fail')).toBe(false);
  expect(script.pass.endProgress).toBe(1);
  expect(script.pass.events.find((e) => e.kind === 'holdingArrival')!.at)
    .toBe(script.pass.orbitEndAt);
});
