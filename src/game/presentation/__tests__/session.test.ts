import { act, createElement, useEffect, type ReactElement } from 'react';
import { AppState } from 'react-native';
import { useGameSession, type GameSession } from '@/hooks/useGameSession';
import { feedback } from '@/game/feedback';
import { registerHit } from '@/game/hapticArbiter';
import { eventCountAt } from '../motion';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const renderer = require('react-test-renderer') as { create: (element: ReactElement) => { unmount: () => void } };
jest.mock('react-native', () => ({ AppState: { addEventListener: jest.fn() } }));
jest.mock('@/game/feedback', () => ({ feedback: { emit: jest.fn(), cancelPending: jest.fn() } }));
jest.mock('@/game/hapticArbiter', () => ({ registerHit: jest.fn(), cancelHits: jest.fn() }));
let session: GameSession;
let background: (state: string) => void;
let remove: jest.Mock;
const won = jest.fn();
function Probe({ id }: { id: number }) {
  const current = useGameSession(id, { onWin: won });
  useEffect(() => { session = current; });
  return null;
}
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  remove = jest.fn();
  (AppState.addEventListener as jest.Mock).mockImplementation((_kind, callback) => { background = callback; return { remove }; });
});
afterEach(() => { jest.useRealTimers(); });
function mount(id = 1) {
  let root!: ReturnType<typeof renderer.create>;
  act(() => { root = renderer.create(createElement(Probe, { id })); });
  return root;
}
function finish(passId = session.flights[session.flights.length - 1]!.passId) {
  const flight = session.flights.find((f) => f.passId === passId)!;
  act(() => { session.presentThrough(passId, flight.events.length); });
}

test('press acknowledges immediately, with no JS animation timers', () => {
  const root = mount();
  act(() => { session.launch('tunnel-0'); });
  expect(feedback.emit).toHaveBeenCalledWith('select');
  expect(feedback.emit).toHaveBeenCalledWith('launch', { haptic: false });
  expect(session.engineState.movesApplied).toBe(1);
  expect(session.flights).toHaveLength(1);
  expect(jest.getTimerCount()).toBe(0);
  act(() => root.unmount());
});

test('a second launch while the first orbits joins as a concurrent flight', () => {
  const root = mount(3); // three cyan tunnels
  act(() => { session.launch('tunnel-0'); });
  act(() => { session.launch('tunnel-1'); });
  expect(session.flights).toHaveLength(2);
  expect(session.activeCount).toBe(2);
  expect(session.engineState.epoch!.launches).toHaveLength(2);
  expect(session.engineState.movesApplied).toBe(2);
  act(() => root.unmount());
});

test('the rail caps at five flights; a sixth launch is denied cleanly', () => {
  const root = mount(10); // tunnel-0 has three queued charges
  for (const t of ['tunnel-0', 'tunnel-0', 'tunnel-0', 'tunnel-1', 'tunnel-2']) {
    act(() => { session.launch(t); });
  }
  expect(session.flights).toHaveLength(5);
  expect(session.canLaunch).toBe(false);
  const applied = session.engineState.movesApplied;
  act(() => { session.launch('tunnel-0'); });
  expect(session.engineState.movesApplied).toBe(applied); // no queue / state mutation
  expect(session.flights).toHaveLength(5);
  expect(feedback.emit).toHaveBeenCalledWith('denied');
  expect(session.message).toContain('Rail is full');
  act(() => root.unmount());
});

test('UI clock clear boundary commits presentation and coalesced haptic exactly once', () => {
  const root = mount();
  act(() => session.launch('tunnel-0'));
  const pass = session.flights[0]!;
  const shot = pass.shots[0]!;
  act(() => session.presentThrough(pass.passId, eventCountAt(pass, shot.clearAt - 0.01)));
  expect(session.state.pixels.find((p) => p.id === shot.pixelId)!.cleared).toBe(false);
  expect(session.engineState.pixels.find((p) => p.id === shot.pixelId)!.cleared).toBe(true);
  act(() => session.presentThrough(pass.passId, eventCountAt(pass, shot.clearAt)));
  expect(session.state.pixels.find((p) => p.id === shot.pixelId)!.cleared).toBe(true);
  const hits = (registerHit as jest.Mock).mock.calls.length;
  act(() => session.presentThrough(pass.passId, eventCountAt(pass, shot.clearAt)));
  expect((registerHit as jest.Mock).mock.calls.length).toBe(hits);
  act(() => root.unmount());
});

test.each(['background', 'restart', 'unmount'])('%s retires all flights and ignores stale UI callbacks', (kind) => {
  const root = mount();
  act(() => session.launch('tunnel-0'));
  const pass = session.flights[0]!;
  act(() => { if (kind === 'background') background('background'); else if (kind === 'restart') session.restart(); else root.unmount(); });
  const count = (feedback.emit as jest.Mock).mock.calls.length;
  act(() => session.presentThrough(pass.passId, pass.events.length));
  expect(feedback.emit).toHaveBeenCalledTimes(count);
  expect(feedback.cancelPending).toHaveBeenCalled();
  if (kind !== 'unmount') {
    expect(session.flights).toHaveLength(0);
    if (kind === 'background') expect(session.state).toEqual(session.engineState);
    else expect(session.state.movesApplied).toBe(0);
    act(() => root.unmount());
  }
  expect(remove).toHaveBeenCalledTimes(1);
});

test('Holding stays parked; useless tap explains itself; useful tap starts a manual flight', () => {
  const root = mount(4);
  act(() => session.launch('tunnel-0')); finish();
  const held = session.state.holding[0]!;
  expect(session.message).toContain('Tap a held charge');
  act(() => session.launchHeld(held.id));
  expect(session.flights).toHaveLength(0);
  expect(session.message).toBe('No exposed matching pixels yet.');
  act(() => session.launch('tunnel-0')); finish();
  expect(session.state.holding.some((c) => c.id === held.id)).toBe(true);
  act(() => session.launchHeld(held.id));
  expect(session.flights[0]!.origin).toBe('holding');
  expect(session.flights[0]!.charge).toEqual(held);
  expect(feedback.emit).toHaveBeenCalledWith('heldRelaunch');
  act(() => root.unmount());
});

test('backgrounding a resolved win still records progress once, without replaying haptics', () => {
  const root = mount();
  act(() => session.launch('tunnel-0')); finish();
  act(() => session.launch('tunnel-1')); finish();
  act(() => session.launch('tunnel-2'));
  const pass = session.flights[0]!;
  act(() => background('background'));
  expect(won).toHaveBeenCalledTimes(1);
  act(() => session.presentThrough(pass.passId, pass.events.length));
  expect(won).toHaveBeenCalledTimes(1);
  act(() => root.unmount());
});

test('last clear keeps its sound hook and its consumed impact', () => {
  const root = mount();
  act(() => session.launch('tunnel-0')); finish();
  expect(feedback.emit).toHaveBeenCalledWith('pixelPop', { haptic: false, voice: 'shot' });
  expect(feedback.emit).toHaveBeenCalledWith('chargeConsumed', { haptic: true });
  act(() => root.unmount());
});
