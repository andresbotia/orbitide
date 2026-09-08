import { act, createElement, useEffect, type ReactElement } from 'react';
import { useGameSession, type GameSession } from '@/hooks/useGameSession';
import { feedback } from '@/game/feedback';
import { AppState } from 'react-native';

// The renderer is supplied by jest-expo; keep this Node-only suite free of native imports.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const renderer = require('react-test-renderer') as {
  create: (element: ReactElement) => { unmount: () => void };
};
jest.mock('react-native', () => ({ AppState: { addEventListener: jest.fn() } }));
jest.mock('@/game/feedback', () => ({ feedback: { emit: jest.fn() } }));

let session: GameSession;
let background: (state: string) => void;
let remove: jest.Mock;
function Probe() {
  const current = useGameSession(1);
  useEffect(() => { session = current; });
  return null;
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  remove = jest.fn();
  (AppState.addEventListener as jest.Mock).mockImplementation((_kind, callback) => {
    background = callback;
    return { remove };
  });
});
afterEach(() => { jest.useRealTimers(); });

function beginShot() {
  let root!: ReturnType<typeof renderer.create>;
  act(() => { root = renderer.create(createElement(Probe)); });
  act(() => { session.launch('tunnel-0'); });
  // Step to the first shot, before its clear. Never depend on a pixel's angle.
  for (let i = 0; i < 250 && session.shots.length === 0; i++) {
    act(() => { jest.advanceTimersByTime(10); });
  }
  expect(session.shots).toHaveLength(1);
  return root;
}

test('a shot does not clear or spend capacity until its clear event', () => {
  const root = beginShot();
  const capacity = session.flyingCapacity;
  const shot = session.shots[0]!;
  expect(session.state.pixels.find((p) => p.id === shot.pixelId)!.cleared).toBe(false);
  expect(session.engineState.pixels.find((p) => p.id === shot.pixelId)!.cleared).toBe(true);
  act(() => { jest.advanceTimersByTime(100); });
  expect(session.state.pixels.find((p) => p.id === shot.pixelId)!.cleared).toBe(true);
  expect(session.flyingCapacity).toBe(capacity! - 1);
  expect(feedback.emit).toHaveBeenCalledWith('pixelPop');
  act(() => { root.unmount(); });
});

test.each(['background', 'restart', 'unmount'])('%s cancels pending shot/clear/haptic timers', (action) => {
  const root = beginShot();
  act(() => {
    if (action === 'background') background('background');
    else if (action === 'restart') session.restart();
    else root.unmount();
  });
  expect(jest.getTimerCount()).toBe(0);
  const calls = (feedback.emit as jest.Mock).mock.calls.length;
  act(() => { jest.runAllTimers(); });
  expect(feedback.emit).toHaveBeenCalledTimes(calls);
  if (action !== 'unmount') {
    expect(session.shots).toEqual([]);
    expect(session.flightPass).toBeNull();
    expect(session.locked).toBe(false);
    if (action === 'background') expect(session.state).toEqual(session.engineState);
    else expect(session.state.movesApplied).toBe(0);
    act(() => { root.unmount(); });
  }
  expect(remove).toHaveBeenCalledTimes(1);
});
