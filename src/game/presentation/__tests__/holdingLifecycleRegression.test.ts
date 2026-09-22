import { act, createElement, useEffect, type ReactElement } from 'react';
import { AppState } from 'react-native';

import type { LevelDefinition } from '@/game/engine/types';
import { useGameSession, type GameSession } from '@/hooks/useGameSession';
import { eventCountAt } from '../motion';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const renderer = require('react-test-renderer') as { create: (element: ReactElement) => { unmount: () => void } };
jest.mock('react-native', () => ({ AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) } }));
jest.mock('@/game/feedback', () => ({ feedback: { emit: jest.fn(), cancelPending: jest.fn() } }));
jest.mock('@/game/hapticArbiter', () => ({ registerHit: jest.fn(), cancelHits: jest.fn() }));

let session: GameSession;
function Probe({ levelId, level }: { levelId: number; level?: LevelDefinition }) {
  const current = useGameSession(levelId, { level, completedTutorials: [] });
  useEffect(() => { session = current; });
  return null;
}

function mount(levelId: number, level?: LevelDefinition) {
  let root!: ReturnType<typeof renderer.create>;
  act(() => { root = renderer.create(createElement(Probe, { levelId, level })); });
  return root;
}

let devErrors: string[] = [];
beforeEach(() => {
  jest.useFakeTimers({ now: 0 });
  jest.clearAllMocks();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as { __DEV__?: boolean }).__DEV__ = true;
  (AppState.addEventListener as jest.Mock).mockImplementation(() => ({ remove: jest.fn() }));
  devErrors = [];
  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const msg = args.map(String).join(' ');
    if (msg.includes('[PA_LIFECYCLE]')) {
      devErrors.push(msg);
    }
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

/** Step clock forward in 16ms increments, presenting every frame like on device. */
function stepTime(targetMs: number, onStep?: (now: number) => void) {
  const stepMs = 16;
  const start = Date.now();
  for (let t = start + stepMs; t <= targetMs; t += stepMs) {
    jest.setSystemTime(t);
    // Advance each flight's presentation based on eventCountAt
    for (const pass of [...session.flights, ...session.landingFlights]) {
      const flightTime = t - pass.launchedAtMs;
      const count = flightTime >= pass.totalMs ? Number.MAX_SAFE_INTEGER : eventCountAt(pass, flightTime);
      if (count > 0) {
        act(() => { session.presentThrough(pass.passId, count); });
      }
    }
    onStep?.(t);
  }
}

/**
 * LIFECYCLE STATE ENUM & ALLOWED TRANSITION GRAPH
 *
 * For any non-consumed Pal:
 *
 * 1. ACTIVE_PENDING:
 *    - in session.flights (terminal.kind === 'pendingHolding')
 *    - in engineState.pendingHolding
 *    - NOT in engineState.holding
 *    - NOT in state.holding
 *    - NOT in session.landingFlights
 *
 * 2. ACTIVE_HELD_GLIDING (Gate arrival decision beat passed, gliding Gate -> Slot):
 *    - in session.flights (terminal.kind === 'toHolding')
 *    - in engineState.holding (authoritative admission committed at Gate)
 *    - NOT in engineState.pendingHolding
 *    - NOT in state.holding (visual tray not yet reached)
 *    - NOT in session.landingFlights
 *
 * 3. ACTIVE_HELD_LANDED (holdingLanded beat passed):
 *    - in session.flights (terminal.kind === 'toHolding')
 *    - in engineState.holding
 *    - in state.holding (committed to visual tray)
 *    - NOT in session.landingFlights
 *
 * 4. LANDING_HANDOFF (complete beat passed, visual overlap window):
 *    - NOT in session.flights
 *    - in session.landingFlights
 *    - in engineState.holding
 *    - in state.holding
 *
 * 5. HELD_SETTLED (handoff window expired):
 *    - NOT in session.flights
 *    - NOT in session.landingFlights
 *    - in engineState.holding
 *    - in state.holding
 *
 * 6. REJECTED_ACTIVE (tray full at Gate, bursting):
 *    - in session.flights (terminal.kind === 'reject')
 *    - NOT in engineState.pendingHolding
 *    - NOT in engineState.holding
 *    - NOT in state.holding
 *    - NOT in session.landingFlights
 *    - engineState.status === 'lost'
 *
 * 7. RETIRED_LOST (level lost, flights cleared):
 *    - NOT in session.flights
 *    - NOT in session.landingFlights
 *    - NOT in engineState.holding
 *    - NOT in state.holding
 *    - engineState.status === 'lost'
 */
type PalLifecycleState =
  | 'ACTIVE_PENDING'
  | 'ACTIVE_HELD_GLIDING'
  | 'ACTIVE_HELD_LANDED'
  | 'LANDING_HANDOFF'
  | 'HELD_SETTLED'
  | 'REJECTED_ACTIVE'
  | 'RETIRED_LOST'
  | 'INVALID_ORPHAN'
  | 'INVALID_CONFLICT';

function classifyPalState(chargeId: string, s: GameSession): PalLifecycleState {
  const inActive = s.flights.find((f) => f.charge.id === chargeId);
  const inLanding = s.landingFlights.find((f) => f.charge.id === chargeId);
  const inEnginePending = s.engineState.pendingHolding.some((p) => p.charge.id === chargeId);
  const inEngineHolding = s.engineState.holding.some((c) => c.id === chargeId);
  const inViewHolding = s.state.holding.some((c) => c.id === chargeId);

  // Invariant: cannot be pending and in engine holding simultaneously
  if (inEnginePending && inEngineHolding) return 'INVALID_CONFLICT';

  if (inActive) {
    if (inActive.terminal.kind === 'pendingHolding') {
      if (inEnginePending && !inEngineHolding && !inViewHolding && !inLanding) return 'ACTIVE_PENDING';
      return 'INVALID_CONFLICT';
    }
    if (inActive.terminal.kind === 'toHolding') {
      if (inEngineHolding && !inEnginePending && !inLanding) {
        if (!inViewHolding) return 'ACTIVE_HELD_GLIDING';
        return 'ACTIVE_HELD_LANDED';
      }
      return 'INVALID_CONFLICT';
    }
    if (inActive.terminal.kind === 'reject') {
      if (!inEnginePending && !inEngineHolding && !inViewHolding && !inLanding) return 'REJECTED_ACTIVE';
      return 'INVALID_CONFLICT';
    }
  }

  if (inLanding) {
    if (inEngineHolding && inViewHolding && !inActive && !inEnginePending) return 'LANDING_HANDOFF';
    return 'INVALID_CONFLICT';
  }

  if (inEngineHolding) {
    if (inViewHolding && !inActive && !inLanding && !inEnginePending) return 'HELD_SETTLED';
    return 'INVALID_CONFLICT';
  }

  if (s.engineState.status === 'lost') return 'RETIRED_LOST';

  return 'INVALID_ORPHAN';
}

// -----------------------------------------------------------------------------
// 1. EXACT REPRODUCTION & TRACE OF L8-t2-c0
// -----------------------------------------------------------------------------
describe('EXACT FORENSIC REPRODUCTION: Pal L8-t2-c0', () => {
  const l8Synthetic: LevelDefinition = {
    id: 8, title: 'Falling Star (Synthetic)', themeId: 'fixture', difficulty: 'easy',
    ruleset: 'coreV2', holdingCapacity: 3, activeCapacity: 5,
    pixelArt: ['WWW', 'WWW', 'WWW'],
    tunnels: [
      [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
      [{ color: 'blue', capacity: 1 }],
      [{ color: 'red', capacity: 13 }],
    ],
  };

  test('reproduces L8-t2-c0 through its 15 lifecycle steps without lifecycle assertion error', () => {
    const root = mount(8, l8Synthetic);

    // Step 0: Fill Holding to 3/3
    act(() => { session.launch('tunnel-0'); });
    let f = session.flights[session.flights.length - 1]!;
    stepTime(Date.now() + f.totalMs + 400);

    act(() => { session.launch('tunnel-0'); });
    f = session.flights[session.flights.length - 1]!;
    stepTime(Date.now() + f.totalMs + 400);

    act(() => { session.launch('tunnel-1'); });
    f = session.flights[session.flights.length - 1]!;
    stepTime(Date.now() + f.totalMs + 400);

    // Tray is full: 3/3
    expect(session.state.holding).toHaveLength(3);
    expect(session.engineState.holding).toHaveLength(3);

    let launchSuccess = false;
    act(() => { launchSuccess = session.launch('tunnel-2'); });
    expect(launchSuccess).toBe(true);

    const targetPal = session.flights.find((fl) => fl.charge.id === 'L8-t2-c0')!;
    expect(targetPal).toBeDefined();

    // Step 2 & 3 & 4: Combat resolution, survivor result, pendingHolding enqueue
    expect(targetPal.terminal.kind).toBe('pendingHolding');
    expect(session.engineState.pendingHolding.map((p) => p.charge.id)).toContain('L8-t2-c0');
    expect(classifyPalState('L8-t2-c0', session)).toBe('ACTIVE_PENDING');

    // Advance mid-flight (before Gate)
    const launchTime = targetPal.launchedAtMs;
    stepTime(launchTime + 600);
    expect(classifyPalState('L8-t2-c0', session)).toBe('ACTIVE_PENDING');

    // Free a slot before Gate: relaunch held Pal in slot 0
    const heldToRelaunch = session.state.holding[0]!;
    act(() => { session.launchHeld(heldToRelaunch.id); });
    expect(session.engineState.holding.some((c) => c.id === heldToRelaunch.id)).toBe(false);
    expect(session.engineState.holding.length).toBe(2); // 1 slot free now!

    // Step 5 - 15: Step through Gate arrival and landing to completion
    stepTime(launchTime + targetPal.totalMs + 1000, (now) => {
      const cls = classifyPalState('L8-t2-c0', session);
      expect(['ACTIVE_PENDING', 'ACTIVE_HELD_GLIDING', 'ACTIVE_HELD_LANDED', 'LANDING_HANDOFF', 'HELD_SETTLED']).toContain(cls);
    });

    // Target Pal must be settled in holding
    expect(session.engineState.holding.map((c) => c.id)).toContain('L8-t2-c0');
    expect(session.state.holding.map((c) => c.id)).toContain('L8-t2-c0');
    expect(classifyPalState('L8-t2-c0', session)).toBe('HELD_SETTLED');

    // CRITICAL DEV ASSERTION: Absolutely no lifecycleProblem logged!
    expect(devErrors).toEqual([]);

    act(() => root.unmount());
  });
});

// -----------------------------------------------------------------------------
// 2. DETERMINISTIC REGRESSION: FAILURE CASE & MULTIPLE PENDING
// -----------------------------------------------------------------------------
describe('DETERMINISTIC REGRESSION: Failure and Multiple Pending', () => {
  const missFixture: LevelDefinition = {
    id: 9801, title: 'lifecycle regression', themeId: 'fixture', difficulty: 'easy',
    ruleset: 'coreV2', holdingCapacity: 2, activeCapacity: 4,
    pixelArt: ['RRR', 'RRR'],
    tunnels: [
      [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
      [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
      [{ color: 'blue', capacity: 1 }],
    ],
  };

  test('FAILURE CASE: pending Pal arrives while tray is full -> rejects cleanly and never enters holding', () => {
    const root = mount(9801, missFixture);

    // Fill tray to 2/2
    act(() => { session.launch('tunnel-0'); });
    let f = session.flights[session.flights.length - 1]!;
    stepTime(Date.now() + f.totalMs + 400);

    act(() => { session.launch('tunnel-1'); });
    f = session.flights[session.flights.length - 1]!;
    stepTime(Date.now() + f.totalMs + 400);

    expect(session.state.holding).toHaveLength(2);

    // Launch third Pal: pendingHolding
    act(() => { session.launch('tunnel-2'); });
    const pendingPal = session.flights[session.flights.length - 1]!;
    expect(pendingPal.terminal.kind).toBe('pendingHolding');
    expect(classifyPalState(pendingPal.charge.id, session)).toBe('ACTIVE_PENDING');

    // Do NOT free a slot: advance clock through Gate arrival to completion
    stepTime(Date.now() + pendingPal.totalMs + 800);

    // Result: level is lost, Pal rejected, never entered Holding or landing queue
    expect(session.engineState.status).toBe('lost');
    expect(session.state.status).toBe('lost');
    expect(session.engineState.holding.some((c) => c.id === pendingPal.charge.id)).toBe(false);
    expect(session.state.holding.some((c) => c.id === pendingPal.charge.id)).toBe(false);
    expect(session.landingFlights.some((fl) => fl.charge.id === pendingPal.charge.id)).toBe(false);

    expect(devErrors).toEqual([]);
    act(() => root.unmount());
  });

  test('MULTIPLE PENDING: first captures freed slot, second rejects -> no ownership ambiguity', () => {
    const root = mount(9801, missFixture);

    // Fill tray to 2/2
    act(() => { session.launch('tunnel-0'); });
    let f = session.flights[session.flights.length - 1]!;
    stepTime(Date.now() + f.totalMs + 400);

    act(() => { session.launch('tunnel-1'); });
    f = session.flights[session.flights.length - 1]!;
    stepTime(Date.now() + f.totalMs + 400);

    expect(session.state.holding).toHaveLength(2);

    // Launch two pending Pals
    act(() => { session.launch('tunnel-0'); });
    const p1 = session.flights[session.flights.length - 1]!;
    stepTime(Date.now() + 100);

    act(() => { session.launch('tunnel-1'); });
    const p2 = session.flights[session.flights.length - 1]!;

    expect(session.engineState.pendingHolding.map((p) => p.charge.id))
      .toEqual([p1.charge.id, p2.charge.id]);
    expect(classifyPalState(p1.charge.id, session)).toBe('ACTIVE_PENDING');
    expect(classifyPalState(p2.charge.id, session)).toBe('ACTIVE_PENDING');

    // Free exactly ONE slot from holding
    const held = session.state.holding[0]!;
    act(() => { session.launchHeld(held.id); });
    expect(session.engineState.holding).toHaveLength(1);

    // Step through both arrivals
    stepTime(Date.now() + Math.max(p1.totalMs, p2.totalMs) + 1200);

    // p1 captured the free slot
    expect(session.engineState.holding.map((c) => c.id)).toContain(p1.charge.id);
    expect(session.state.holding.map((c) => c.id)).toContain(p1.charge.id);

    // p2 was rejected
    expect(session.engineState.holding.map((c) => c.id)).not.toContain(p2.charge.id);
    expect(session.state.holding.map((c) => c.id)).not.toContain(p2.charge.id);
    expect(session.engineState.status).toBe('lost');

    expect(devErrors).toEqual([]);
    act(() => root.unmount());
  });
});

// -----------------------------------------------------------------------------
// 3. LIFECYCLE PROPERTY TEST
// -----------------------------------------------------------------------------
describe('LIFECYCLE PROPERTY INVARIANT', () => {
  const propertyLevel: LevelDefinition = {
    id: 9802, title: 'property level', themeId: 'fixture', difficulty: 'easy',
    ruleset: 'coreV2', holdingCapacity: 2, activeCapacity: 4,
    pixelArt: ['RR', 'RR'],
    tunnels: [
      [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
      [{ color: 'blue', capacity: 1 }],
      [],
    ],
  };

  test('every Pal from launch to retirement belongs to exactly one valid state at every frame', () => {
    const root = mount(9802, propertyLevel);

    // Launch Pal 1 -> fills slot 0
    act(() => { session.launch('tunnel-0'); });
    // Launch Pal 2 -> fills slot 1
    act(() => { session.launch('tunnel-1'); });
    // Launch Pal 3 -> enters pendingHolding
    act(() => { session.launch('tunnel-0'); });

    const launchedIds = session.flights.map((fl) => fl.charge.id);
    expect(launchedIds).toHaveLength(3);

    // Free 1 slot mid-flight
    let freed = false;

    // Advance 3000ms frame by frame (16ms) and verify invariant at every single frame
    stepTime(Date.now() + 3000, (now) => {
      if (!freed && now > 500 && session.state.holding.length > 0) {
        const h = session.state.holding[0]!;
        act(() => { session.launchHeld(h.id); });
        freed = true;
      }

      for (const id of launchedIds) {
        const state = classifyPalState(id, session);
        expect(state).not.toBe('INVALID_ORPHAN');
        expect(state).not.toBe('INVALID_CONFLICT');
      }
    });

    expect(devErrors).toEqual([]);
    act(() => root.unmount());
  });
});
