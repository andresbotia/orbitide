/**
 * Holding handoff (presentation only): a toHolding Pal that completed keeps
 * being drawn at its slot until its UI clock ends, but it is logically gone —
 * no occupancy, no reconciliation — and it can never duplicate a tray Pal.
 */
import { act, createElement, useEffect, type ReactElement } from 'react';
import { AppState } from 'react-native';
import { useGameSession, type GameSession } from '@/hooks/useGameSession';
import type { LevelDefinition } from '@/game/engine/types';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const renderer = require('react-test-renderer') as { create: (element: ReactElement) => { unmount: () => void } };
jest.mock('react-native', () => ({ AppState: { addEventListener: jest.fn() } }));
jest.mock('@/game/feedback', () => ({ feedback: { emit: jest.fn(), cancelPending: jest.fn() } }));
jest.mock('@/game/hapticArbiter', () => ({ registerHit: jest.fn(), cancelHits: jest.fn() }));

const END_OF_CLOCK = Number.MAX_SAFE_INTEGER;
// The blue Pal has no exposed blue pixel, so it laps and lands in Holding; the
// white Pal clears the ring and is consumed.
const level: LevelDefinition = {
  id: 8451, title: 'Handoff', themeId: 'test', difficulty: 'easy', holdingCapacity: 3,
  pixelArt: ['WWW', 'WBW', 'WWW'],
  tunnels: [[{ color: 'blue', capacity: 1 }], [{ color: 'white', capacity: 8 }], []],
};

let session: GameSession;
let background: (state: string) => void;
function Probe() {
  const current = useGameSession(level.id, { level });
  useEffect(() => { session = current; });
  return null;
}
beforeEach(() => {
  jest.useFakeTimers();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (AppState.addEventListener as jest.Mock).mockImplementation((_kind, callback) => { background = callback; return { remove: jest.fn() }; });
});
afterEach(() => { jest.useRealTimers(); });
function mount() {
  let root!: ReturnType<typeof renderer.create>;
  act(() => { root = renderer.create(createElement(Probe)); });
  return root;
}
/** The reaction path: every scripted event, delivered as the UI clock passes it. */
function playScript(passId: number) {
  const pass = session.flights.find((f) => f.passId === passId)!;
  act(() => { session.presentThrough(passId, pass.events.length); });
}
function landBlue(): number {
  act(() => { session.launch('tunnel-0'); });
  const pass = session.flights[0]!;
  expect(pass.terminal.kind).toBe('toHolding');
  playScript(pass.passId);
  return pass.passId;
}

test('a landed Pal lingers for presentation only, then releases when its clock ends', () => {
  const root = mount();
  const passId = landBlue();
  expect(session.flights).toHaveLength(0);
  expect(session.landingFlights.map((p) => p.passId)).toEqual([passId]);
  // Logically gone: no occupancy, and the tray already holds the Pal.
  expect(session.activeCount).toBe(0);
  expect(session.canLaunch).toBe(true);
  expect(session.state.holding).toHaveLength(1);
  act(() => { session.presentThrough(passId, END_OF_CLOCK); });
  expect(session.landingFlights).toHaveLength(0);
  act(() => root.unmount());
});

test('reaction calls after completion never release early; only the end of clock does', () => {
  const root = mount();
  const passId = landBlue();
  act(() => { session.presentThrough(passId, 3); });
  expect(session.landingFlights).toHaveLength(1);
  act(() => root.unmount());
});

test('a pass completed only by its end-of-clock call does not linger', () => {
  const root = mount();
  act(() => { session.launch('tunnel-0'); });
  const pass = session.flights[0]!;
  act(() => { session.presentThrough(pass.passId, END_OF_CLOCK); });
  expect(session.flights).toHaveLength(0);
  expect(session.landingFlights).toHaveLength(0);
  expect(session.state.holding).toHaveLength(1);
  act(() => root.unmount());
});

test('consumed Pals never linger', () => {
  const root = mount();
  act(() => { session.launch('tunnel-1'); });
  const pass = session.flights[0]!;
  expect(pass.terminal.kind).toBe('consumed');
  playScript(pass.passId);
  expect(session.landingFlights).toHaveLength(0);
  act(() => root.unmount());
});

test('relaunching from Holding drops lingering Pals so the tray never shows a duplicate', () => {
  const root = mount();
  landBlue();
  const held = session.state.holding[0]!;
  act(() => { session.launch('tunnel-1'); }); // expose the blue pixel
  playScript(session.flights[0]!.passId);
  expect(session.landingFlights).toHaveLength(1);
  let accepted = false;
  act(() => { accepted = session.launchHeld(held.id); });
  expect(accepted).toBe(true);
  expect(session.flights.some((f) => f.charge.id === held.id)).toBe(true);
  expect(session.landingFlights).toHaveLength(0);
  act(() => root.unmount());
});

test.each(['restart', 'background'])('%s clears lingering Pals', (kind) => {
  const root = mount();
  landBlue();
  expect(session.landingFlights).toHaveLength(1);
  act(() => { if (kind === 'restart') session.restart(); else background('background'); });
  expect(session.landingFlights).toHaveLength(0);
  act(() => root.unmount());
});
