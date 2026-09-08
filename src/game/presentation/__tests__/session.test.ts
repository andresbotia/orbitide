import { act, createElement, useEffect, type ReactElement } from 'react';
import { AppState } from 'react-native';
import { useGameSession, type GameSession } from '@/hooks/useGameSession';
import { feedback } from '@/game/feedback';
import { eventCountAt } from '../motion';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const renderer = require('react-test-renderer') as { create: (element: ReactElement) => { unmount: () => void } };
jest.mock('react-native', () => ({ AppState: { addEventListener: jest.fn() } }));
jest.mock('@/game/feedback', () => ({ feedback: { emit: jest.fn(), cancelPending: jest.fn() } }));
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
function finish() {
  const pass = session.flightPass!;
  act(() => { session.presentThrough(pass.passId, pass.events.length); });
}
test('press acknowledges immediately, with no JS animation timers; rapid taps do not duplicate', () => {
  const root = mount();
  act(() => { session.launch('tunnel-0'); session.launch('tunnel-0'); });
  expect(feedback.emit).toHaveBeenCalledTimes(2);
  expect(feedback.emit).toHaveBeenCalledWith('select');
  expect(session.engineState.movesApplied).toBe(1);
  expect(session.locked).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
  act(() => root.unmount());
});
test('UI clock clear boundary commits presentation and haptic exactly once', () => {
  const root = mount();
  act(() => session.launch('tunnel-0'));
  const pass = session.flightPass!;
  const shot = pass.shots[0]!;
  act(() => session.presentThrough(pass.passId, eventCountAt(pass, shot.clearAt - 0.01)));
  expect(session.state.pixels.find((p) => p.id === shot.pixelId)!.cleared).toBe(false);
  expect(session.engineState.pixels.find((p) => p.id === shot.pixelId)!.cleared).toBe(true);
  act(() => session.presentThrough(pass.passId, eventCountAt(pass, shot.clearAt)));
  expect(session.state.pixels.find((p) => p.id === shot.pixelId)!.cleared).toBe(true);
  const count = (feedback.emit as jest.Mock).mock.calls.length;
  act(() => session.presentThrough(pass.passId, eventCountAt(pass, shot.clearAt)));
  expect(feedback.emit).toHaveBeenCalledTimes(count);
  act(() => root.unmount());
});
test.each(['background', 'restart', 'unmount'])('%s retires the pass and ignores stale UI callbacks', (kind) => {
  const root = mount();
  act(() => session.launch('tunnel-0'));
  const pass = session.flightPass!;
  act(() => { if (kind === 'background') background('background'); else if (kind === 'restart') session.restart(); else root.unmount(); });
  const count = (feedback.emit as jest.Mock).mock.calls.length;
  act(() => session.presentThrough(pass.passId, pass.events.length));
  expect(feedback.emit).toHaveBeenCalledTimes(count);
  expect(feedback.cancelPending).toHaveBeenCalled();
  if (kind !== 'unmount') {
    expect(session.flightPass).toBeNull();
    expect(session.locked).toBe(false);
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
  expect(session.flightPass).toBeNull();
  expect(session.message).toBe('No exposed matching pixels yet.');
  act(() => session.launch('tunnel-0')); finish();
  expect(session.state.holding.some((c) => c.id === held.id)).toBe(true);
  act(() => session.launchHeld(held.id));
  expect(session.flightPass!.origin).toBe('holding');
  expect(session.flightPass!.charge).toEqual(held);
  expect(feedback.emit).toHaveBeenCalledWith('heldRelaunch');
  act(() => root.unmount());
});
test('backgrounding a resolved win still records progress once, without replaying haptics', () => {
  const root = mount();
  act(() => session.launch('tunnel-0')); finish();
  act(() => session.launch('tunnel-1')); finish();
  act(() => session.launch('tunnel-2'));
  const pass = session.flightPass!;
  act(() => background('background'));
  expect(won).toHaveBeenCalledTimes(1);
  act(() => session.presentThrough(pass.passId, pass.events.length));
  expect(won).toHaveBeenCalledTimes(1);
  act(() => root.unmount());
});

test('last clear preserves sound hook but uses only the consumed impact', () => {
  const root = mount();
  act(() => session.launch('tunnel-0')); finish();
  expect(feedback.emit).toHaveBeenCalledWith('pixelPop', { haptic: false });
  expect(feedback.emit).toHaveBeenCalledWith('chargeConsumed', { haptic: true });
  act(() => root.unmount());
});
