import { act, createElement, useEffect, type ReactElement } from 'react';
import { AppState } from 'react-native';

import { DEFAULT_ACTIVE_CAPACITY } from '@/game/engine/concurrency';
import type { LevelDefinition } from '@/game/engine/types';
import { useGameSession, type GameSession } from '@/hooks/useGameSession';
import { eventCountAt } from '../motion';

/**
 * PROVISIONAL HOLDING OVERFLOW — the rescue window, through the real session.
 *
 * A survivor that finds the tray full is no longer a loss at launch. It flies
 * its lap as a `pendingHolding` Pal and its admission is decided when it
 * reaches the GateTerminal. While it travels the level is still playing and
 * every control still works, so the player can relaunch a held Pal and free the
 * slot that saves it.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const renderer = require('react-test-renderer') as { create: (element: ReactElement) => { unmount: () => void } };
jest.mock('react-native', () => ({ AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) } }));
jest.mock('@/game/feedback', () => ({ feedback: { emit: jest.fn(), cancelPending: jest.fn() } }));
jest.mock('@/game/hapticArbiter', () => ({ registerHit: jest.fn(), cancelHits: jest.fn() }));

let session: GameSession;
function Probe({ level }: { level: LevelDefinition }) {
  const current = useGameSession(level.id, { level, completedTutorials: [] });
  useEffect(() => { session = current; });
  return null;
}
function mount(level: LevelDefinition) {
  let root!: ReturnType<typeof renderer.create>;
  act(() => { root = renderer.create(createElement(Probe, { level })); });
  return root;
}
beforeEach(() => {
  jest.useFakeTimers({ now: 0 });
  jest.clearAllMocks();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (AppState.addEventListener as jest.Mock).mockImplementation(() => ({ remove: jest.fn() }));
});
afterEach(() => { jest.useRealTimers(); });

const cursors = new Map<number, number>();
beforeEach(() => cursors.clear());
/** Present every live flight up to `now`, exactly as the UI clock does. */
function presentTo(now: number) {
  jest.setSystemTime(now);
  for (const pass of [...session.flights, ...session.landingFlights]) {
    const t = now - pass.launchedAtMs;
    const count = t >= pass.totalMs ? Number.MAX_SAFE_INTEGER : eventCountAt(pass, t);
    if (count > 0 && cursors.get(pass.passId) !== count) {
      cursors.set(pass.passId, count);
      act(() => { session.presentThrough(pass.passId, count); });
    }
  }
}
function tap(kind: 'tunnel' | 'holding', id: string) {
  const before = session.lastDenial?.seq ?? 0;
  let accepted = false;
  act(() => { accepted = kind === 'tunnel' ? session.launch(id) : session.launchHeld(id); });
  const refused = (session.lastDenial?.seq ?? 0) > before ? session.lastDenial!.reason : null;
  return { accepted, refused };
}

/** Blue Pals on an all-red board: every one of them survives its lap and parks. */
const MISS: LevelDefinition = {
  id: 9791, title: 'pending overflow', themeId: 'fixture', difficulty: 'easy',
  ruleset: 'coreV2', holdingCapacity: 3, activeCapacity: DEFAULT_ACTIVE_CAPACITY,
  pixelArt: ['RRR', 'RRR'],
  tunnels: [
    [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
    [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
    [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
    [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
  ],
};

/** Fill the tray to 3/3 by flying three Pals to completion. */
function fillTray() {
  for (let i = 0; i < 3; i++) {
    tap('tunnel', `tunnel-${i}`);
    const f = session.flights[session.flights.length - 1]!;
    presentTo(f.launchedAtMs + f.totalMs + 30);
  }
  expect(session.state.holding).toHaveLength(3);
}

test('RESCUE: relaunching during the flight frees the slot and the inbound Pal lands', () => {
  const root = mount(MISS);
  fillTray();

  // A fourth Pal launches into a full tray: provisional, not lost.
  expect(tap('tunnel', 'tunnel-3').accepted).toBe(true);
  const inbound = session.flights[session.flights.length - 1]!;
  expect(inbound.terminal.kind).toBe('pendingHolding');
  expect(session.engineState.status).toBe('playing');
  expect(session.state.status).toBe('playing');
  expect(session.engineState.pendingHolding.map((p) => p.charge.id)).toEqual([inbound.charge.id]);

  // Mid-flight the player still has slots and the controls still answer.
  presentTo(inbound.launchedAtMs + 500);
  expect(session.activeCount).toBeLessThan(session.activeCapacity);
  const held = session.state.holding[0]!;
  const rescue = tap('holding', held.id);
  expect(rescue.accepted).toBe(true);
  expect(rescue.refused).toBeNull();
  expect(session.state.holding.some((c) => c.id === held.id)).toBe(false);

  // The inbound Pal reaches the Gate and finds the slot the player just freed.
  presentTo(inbound.launchedAtMs + inbound.totalMs + 400);
  expect(session.engineState.holding.map((c) => c.id)).toContain(inbound.charge.id);
  expect(session.engineState.status).toBe('playing');
  expect(session.state.status).toBe('playing');
  act(() => root.unmount());
});

test('FAILURE: with no rescue, the same Pal rejects at the Gate and the level is lost', () => {
  const root = mount(MISS);
  fillTray();
  expect(tap('tunnel', 'tunnel-3').accepted).toBe(true);
  const inbound = session.flights[session.flights.length - 1]!;
  expect(inbound.terminal.kind).toBe('pendingHolding');

  // The player does nothing; the tray is still full when it lands.
  presentTo(inbound.launchedAtMs + inbound.totalMs + 800);
  expect(session.engineState.status).toBe('lost');
  expect(session.engineState.holding).toHaveLength(3);
  expect(session.engineState.holding.some((c) => c.id === inbound.charge.id)).toBe(false);
  act(() => root.unmount());
});

test('INPUT: tunnel and Holding taps both work while an overflow is pending', () => {
  const root = mount(MISS);
  fillTray();
  expect(tap('tunnel', 'tunnel-3').accepted).toBe(true);
  const inbound = session.flights[session.flights.length - 1]!;
  presentTo(inbound.launchedAtMs + 300);

  expect(session.activeCount).toBeLessThan(session.activeCapacity);
  // A tunnel Pal launches normally...
  expect(tap('tunnel', 'tunnel-0').accepted).toBe(true);
  // ...and so does a held Pal, with no gameOver refusal anywhere.
  expect(tap('holding', session.state.holding[0]!.id).accepted).toBe(true);
  expect(session.lastDenial).toBeNull();
  act(() => root.unmount());
});

test('ACTIVE count still counts the pending Pal — no phantom slot release', () => {
  const root = mount(MISS);
  fillTray();
  tap('tunnel', 'tunnel-3');
  const inbound = session.flights[session.flights.length - 1]!;
  presentTo(inbound.launchedAtMs + 300);
  // It is still on the rail, so it still occupies one Active slot.
  expect(session.flights.some((f) => f.charge.id === inbound.charge.id)).toBe(true);
  expect(session.activeCount).toBe(session.flights.length);
  act(() => root.unmount());
});

test('TWO PENDING, ONE SLOT: the first arrival captures, the second rejects', () => {
  const root = mount(MISS);
  fillTray();

  // Two survivors head for a full tray.
  expect(tap('tunnel', 'tunnel-3').accepted).toBe(true);
  const firstIn = session.flights[session.flights.length - 1]!;
  presentTo(firstIn.launchedAtMs + 100);
  expect(tap('tunnel', 'tunnel-0').accepted).toBe(true);
  const secondIn = session.flights[session.flights.length - 1]!;
  expect(session.engineState.pendingHolding.map((p) => p.charge.id))
    .toEqual([firstIn.charge.id, secondIn.charge.id]);

  // The player frees exactly one slot.
  presentTo(secondIn.launchedAtMs + 200);
  expect(tap('holding', session.state.holding[0]!.id).accepted).toBe(true);

  // Both arrive, in launch order: the first takes the slot, the second cannot.
  presentTo(secondIn.launchedAtMs + secondIn.totalMs + 1200);
  expect(session.engineState.holding.map((c) => c.id)).toContain(firstIn.charge.id);
  expect(session.engineState.holding.map((c) => c.id)).not.toContain(secondIn.charge.id);
  expect(session.engineState.status).toBe('lost');
  act(() => root.unmount());
});
