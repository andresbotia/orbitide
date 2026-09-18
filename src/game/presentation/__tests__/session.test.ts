import { act, createElement, useEffect, type ReactElement } from 'react';
import { AppState } from 'react-native';
import { useGameSession, type GameSession } from '@/hooks/useGameSession';
import { feedback } from '@/game/feedback';
import { registerHit } from '@/game/hapticArbiter';
import { eventCountAt } from '../motion';
import type { LevelDefinition } from '@/game/engine/types';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const renderer = require('react-test-renderer') as { create: (element: ReactElement) => { unmount: () => void } };
jest.mock('react-native', () => ({ AppState: { addEventListener: jest.fn() } }));
jest.mock('@/game/feedback', () => ({ feedback: { emit: jest.fn(), cancelPending: jest.fn() } }));
jest.mock('@/game/hapticArbiter', () => ({ registerHit: jest.fn(), cancelHits: jest.fn() }));
let session: GameSession;
let background: (state: string) => void;
let remove: jest.Mock;
const won = jest.fn();
const lost = jest.fn();
function Probe({ id, level }: { id: number; level?: LevelDefinition }) {
  const current = useGameSession(id, { onWin: won, onLose: lost, level });
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
function mount(id = 1, level?: LevelDefinition) {
  let root!: ReturnType<typeof renderer.create>;
  act(() => { root = renderer.create(createElement(Probe, { id, level })); });
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
  expect(session.activeCapacity).toBe(5);
  expect(session.engineState.epoch!.launches).toHaveLength(2);
  expect(session.engineState.movesApplied).toBe(2);
  act(() => root.unmount());
});

const slotLevel = (): LevelDefinition => ({
  id: 8400, title: 'Slots', themeId: 'test', difficulty: 'easy', holdingCapacity: 8,
  pixelArt: ['WWW', 'WWW', 'WWW'],
  tunnels: [
    [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
    [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
    [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
  ],
});

test('the rail caps at five flights; a sixth launch is denied cleanly', () => {
  const root = mount(8400, slotLevel());
  for (const t of ['tunnel-0', 'tunnel-0', 'tunnel-0', 'tunnel-1', 'tunnel-2']) {
    act(() => { session.launch(t); });
  }
  expect(session.flights).toHaveLength(5);
  expect(session.activeCount).toBe(5);
  expect(session.activeCapacity).toBe(5);
  expect(session.canLaunch).toBe(false);
  expect(session.engineState.status).toBe('playing');
  const applied = session.engineState.movesApplied;
  act(() => { session.launch('tunnel-1'); });
  expect(session.engineState.movesApplied).toBe(applied); // no queue / state mutation
  expect(session.flights).toHaveLength(5);
  expect(feedback.emit).toHaveBeenCalledWith('denied');
  expect(session.message).toContain('Rail is full');
  act(() => root.unmount());
});

test('after one of five flights lands, a slot opens and a launch is accepted', () => {
  const root = mount(8400, slotLevel());
  for (const t of ['tunnel-0', 'tunnel-0', 'tunnel-0', 'tunnel-1', 'tunnel-2']) {
    act(() => { session.launch(t); });
  }
  expect(session.activeCount).toBe(5);
  const first = session.flights[0]!;
  act(() => { session.presentThrough(first.passId, first.events.length); });
  expect(session.activeCount).toBe(4);
  expect(session.canLaunch).toBe(true);
  const applied = session.engineState.movesApplied;
  act(() => { session.launch('tunnel-1'); });
  expect(session.engineState.movesApplied).toBeGreaterThan(applied);
  expect(session.activeCount).toBe(5);
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
  const level: LevelDefinition = {
    id: 8401, title: 'Park', themeId: 'test', difficulty: 'easy', holdingCapacity: 3,
    pixelArt: ['WWW', 'WBW', 'WWW'],
    tunnels: [[{ color: 'blue', capacity: 1 }], [{ color: 'white', capacity: 8 }], []],
  };
  const root = mount(8401, level);
  act(() => session.launch('tunnel-0')); finish();
  const held = session.state.holding[0]!;
  expect(held).toBeTruthy();
  act(() => session.launchHeld(held.id));
  expect(session.flights).toHaveLength(0);
  expect(session.message).toBe('No exposed matching pixels yet.');
  act(() => session.launch('tunnel-1')); finish();
  expect(session.state.holding.some((c) => c.id === held.id)).toBe(true);
  act(() => session.launchHeld(held.id));
  expect(session.flights[0]!.origin).toBe('holding');
  expect(session.flights[0]!.charge).toEqual(held);
  expect(feedback.emit).toHaveBeenCalledWith('heldRelaunch');
  act(() => root.unmount());
});

test('backgrounding a resolved win still records progress once, without replaying haptics', () => {
  const level: LevelDefinition = {
    id: 8402, title: 'Win', themeId: 'test', difficulty: 'easy', holdingCapacity: 3,
    pixelArt: ['WRB'],
    tunnels: [[{ color: 'white', capacity: 1 }], [{ color: 'red', capacity: 1 }], [{ color: 'blue', capacity: 1 }]],
  };
  const root = mount(8402, level);
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
  const level: LevelDefinition = {
    id: 8403, title: 'Consume', themeId: 'test', difficulty: 'easy', holdingCapacity: 3,
    pixelArt: ['WW', 'BB'],
    tunnels: [[{ color: 'white', capacity: 2 }], [], []],
  };
  const root = mount(8403, level);
  act(() => session.launch('tunnel-0')); finish();
  expect(feedback.emit).toHaveBeenCalledWith('pixelPop', { haptic: false, voice: 'shot' });
  expect(feedback.emit).toHaveBeenCalledWith('chargeConsumed', { haptic: true });
  act(() => root.unmount());
});

const overflowLevel: LevelDefinition = {
  id: 9610, title: 'Session overflow', themeId: 'test', difficulty: 'easy',
  holdingCapacity: 2, ruleset: 'coreV2',
  pixelArt: ['WWW', 'WWW', 'WWW'],
  tunnels: [
    [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
    [{ color: 'blue', capacity: 1 }],
    [{ color: 'blue', capacity: 1 }],
    [{ color: 'white', capacity: 9 }],
  ],
};

test('full holding still launches a ready Pal; overflow loses without eating holds', () => {
  const root = mount(9610, overflowLevel);
  act(() => session.launch('tunnel-0')); finish();
  act(() => session.launch('tunnel-1')); finish();
  const held = session.state.holding.map((c) => c.id);
  expect(held).toHaveLength(2);
  act(() => session.launch('tunnel-2'));
  expect(session.flights.length).toBeGreaterThan(0);
  expect(session.message).not.toBe('Free a Holding slot first.');
  finish();
  expect(session.engineState.status).toBe('lost');
  expect(session.state.holding.map((c) => c.id)).toEqual(held);
  act(() => root.unmount());
});

test('full holding can still win with a fully consuming Pal', () => {
  const root = mount(9610, overflowLevel);
  act(() => session.launch('tunnel-0')); finish();
  act(() => session.launch('tunnel-1')); finish();
  expect(session.state.holding).toHaveLength(2);
  act(() => session.launch('tunnel-3')); finish();
  expect(session.engineState.status).toBe('won');
  expect(session.state.holding).toHaveLength(2);
  act(() => root.unmount());
});

test('overflow loss timing: engine knows loss immediately, but presented state stays playing until terminal flight fail event', () => {
  lost.mockClear();
  const root = mount(9610, overflowLevel);
  act(() => session.launch('tunnel-0')); finish();
  act(() => session.launch('tunnel-1')); finish();
  const held = session.state.holding.map((c) => c.id);
  expect(held).toHaveLength(2);

  // Launch the third Pal that overflows Holding
  act(() => session.launch('tunnel-2'));
  expect(session.flights).toHaveLength(1);
  const flight = session.flights[0]!;

  // 1. Engine truth immediately knows loss is inevitable
  expect(session.engineState.status).toBe('lost');

  // 2. New launches are locked immediately
  expect(session.canLaunch).toBe(false);

  // 3. BUT presentation status remains playing during the flight!
  expect(session.state.status).toBe('playing');
  expect(lost).not.toHaveBeenCalled();

  // 4. Holding occupants remain completely untouched
  expect(session.state.holding.map((c) => c.id)).toEqual(held);

  // 5. Flight pass never enters holding
  expect(flight.endKind).toBe('burst');
  expect(flight.holdingTarget).toBeUndefined();
  expect(flight.holdingSlotIndex).toBeUndefined();
  expect(flight.events.some((e) => e.kind === 'holdingLanded')).toBe(false);

  const failIndex = flight.events.findIndex((e) => e.kind === 'fail');
  expect(failIndex).toBeGreaterThan(0);

  // 6. As Pal travels and reaches terminal point before fail: presentation remains playing
  act(() => session.presentThrough(flight.passId, failIndex));
  expect(session.state.status).toBe('playing');
  expect(lost).not.toHaveBeenCalled();
  expect(session.state.holding.map((c) => c.id)).toEqual(held);

  // 7. Only when the terminal fail event fires is the loss committed to presentation
  act(() => session.presentThrough(flight.passId, failIndex + 1));
  expect(session.state.status).toBe('lost');
  expect(lost).toHaveBeenCalledTimes(1);
  expect(session.state.holding.map((c) => c.id)).toEqual(held);

  // 8. Flight completes cleanly
  act(() => session.presentThrough(flight.passId, flight.events.length));
  expect(session.flights).toHaveLength(0);
  expect(session.state.status).toBe('lost');
  expect(session.state.holding.map((c) => c.id)).toEqual(held);

  act(() => root.unmount());
});

test('exact repro: holding full 3/3, two active Pals: first consumes, second hits partial and overflows', () => {
  lost.mockClear();
  const reproLevel: LevelDefinition = {
    id: 9611, title: 'Holding full 3/3 partial overflow', themeId: 'test', difficulty: 'easy',
    holdingCapacity: 3, ruleset: 'coreV2',
    pixelArt: [
      'P..',
      'G..',
      'WWW',
    ],
    tunnels: [
      [{ color: 'blue', capacity: 1 }, { color: 'purple', capacity: 1 }],
      [{ color: 'yellow', capacity: 11 }, { color: 'green', capacity: 9 }],
      [{ color: 'yellow', capacity: 13 }],
      [],
    ],
  };
  const root = mount(9611, reproLevel);
  // Launch tunnel-0, tunnel-1, tunnel-2
  act(() => session.launch('tunnel-0'));
  act(() => session.launch('tunnel-1'));
  act(() => session.launch('tunnel-2'));
  expect(session.flights).toHaveLength(3);

  // Land blue 1 and yellow 11 completely, but leave yellow 13 active before complete
  const f0 = session.flights[0]!;
  const f1 = session.flights[1]!;
  const f2 = session.flights[2]!;

  act(() => session.presentThrough(f0.passId, f0.events.length));
  act(() => session.presentThrough(f1.passId, f1.events.length));
  // f2 emits holdingLanded but not complete
  const landed2 = f2.events.findIndex((e) => e.kind === 'holdingLanded');
  act(() => session.presentThrough(f2.passId, landed2 + 1));

  // Holding now has all 3 in presentation
  expect(session.state.holding).toHaveLength(3);
  const heldBefore = session.state.holding.map((c) => ({ id: c.id, color: c.color, capacity: c.capacity }));

  // Now launch purple 1 and green 9 while f2 is still active
  act(() => session.launch('tunnel-0'));
  act(() => session.launch('tunnel-1'));

  // Complete f2
  act(() => session.presentThrough(f2.passId, f2.events.length));

  const purpleFlight = session.flights.find((f) => f.passId === f0.passId + 3)!;
  const greenFlight = session.flights.find((f) => f.passId === f0.passId + 4)!;

  // Finish purple 1
  act(() => session.presentThrough(purpleFlight.passId, purpleFlight.events.length));

  // Holding must still be untouched: blue 1, yellow 11, yellow 13
  expect(session.state.holding.map((c) => c.id)).toEqual(heldBefore.map((c) => c.id));

  // Finish green 9
  act(() => session.presentThrough(greenFlight.passId, greenFlight.events.length));

  // Loss presentation
  expect(session.state.status).toBe('lost');
  expect(session.state.holding.map((c) => c.id)).toEqual(heldBefore.map((c) => c.id));

  act(() => root.unmount());
});

