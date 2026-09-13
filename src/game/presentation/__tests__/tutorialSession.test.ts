import { act, createElement, useEffect, type ReactElement } from 'react';
import { AppState } from 'react-native';
import { useGameSession, type GameSession } from '@/hooks/useGameSession';
import { feedback } from '@/game/feedback';
import type { LevelDefinition } from '@/game/engine/types';
import { TUTORIAL_IDS } from '@/game/tutorial';
import { LEVEL_DEFINITIONS } from '@/game/levels/levelDefinitions';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const renderer = require('react-test-renderer') as { create: (element: ReactElement) => { unmount: () => void } };

jest.mock('react-native', () => ({ AppState: { addEventListener: jest.fn() } }));
jest.mock('@/game/feedback', () => ({ feedback: { emit: jest.fn(), cancelPending: jest.fn() } }));
jest.mock('@/game/hapticArbiter', () => ({ registerHit: jest.fn(), cancelHits: jest.fn() }));

let session: GameSession;
const won = jest.fn();
const tutorialComplete = jest.fn();

function coreV2Level1(extra: Partial<LevelDefinition> = {}): LevelDefinition {
  return {
    id: 1,
    title: 'First Light',
    themeId: 'first-light',
    difficulty: 'easy',
    holdingCapacity: 4,
    pixelArt: ['BBB', 'BRB', 'BRB'],
    tunnels: [
      [{ color: 'red', capacity: 2 }],
      [{ color: 'blue', capacity: 8 }],
      [],
      [],
    ],
    ruleset: 'coreV2',
    ...extra,
  };
}

function Probe({
  id, level, completed,
}: {
  id: number;
  level?: LevelDefinition;
  completed?: Iterable<string> | null;
}) {
  const current = useGameSession(id, {
    onWin: won,
    level,
    completedTutorials: completed,
    onTutorialComplete: tutorialComplete,
  });
  useEffect(() => { session = current; });
  return null;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (AppState.addEventListener as jest.Mock).mockImplementation(() => ({ remove: jest.fn() }));
});
afterEach(() => { jest.useRealTimers(); });

function mount(
  level: LevelDefinition,
  completed: Iterable<string> | null = [],
) {
  let root!: ReturnType<typeof renderer.create>;
  act(() => {
    root = renderer.create(createElement(Probe, { id: level.id, level, completed }));
  });
  return root;
}

function finish(passId = session.flights[session.flights.length - 1]!.passId) {
  const flight = session.flights.find((f) => f.passId === passId)!;
  act(() => { session.presentThrough(passId, flight.events.length); });
}

test('session activates the Core V2 Level 1 tutorial and follows presentation events', () => {
  const root = mount(coreV2Level1());
  expect(session.tutorial.active).toBe(true);
  expect(session.tutorial.stage).toBe('launch');

  const moves = session.engineState.movesApplied;
  act(() => { session.launch('tunnel-1'); });
  expect(session.engineState.movesApplied).toBe(moves);
  expect(feedback.emit).toHaveBeenCalledWith('denied');
  expect(session.tutorial.stage).toBe('launch');

  act(() => { session.launch('tunnel-0'); });
  expect(session.tutorial.stage).toBe('observeHit');
  expect(session.engineState.movesApplied).toBe(moves + 1);

  const orbiting = session.engineState.movesApplied;
  act(() => { session.launch('tunnel-1'); });
  expect(session.engineState.movesApplied).toBe(orbiting);
  expect(session.tutorial.stage).toBe('observeHit');

  finish();
  expect(session.tutorial.flags.sawHit).toBe(true);
  expect(session.tutorial.flags.sawCountDecrement).toBe(true);
  expect(session.tutorial.stage).toBe('relaunchHeld');
  expect(session.state.holding).toHaveLength(1);

  const heldId = session.state.holding[0]!.id;
  expect(session.tutorial.highlight).toEqual({ kind: 'heldCharge', chargeId: heldId });
  act(() => { session.launch('tunnel-1'); });
  expect(session.flights).toHaveLength(0);

  act(() => { session.launchHeld(heldId); });
  expect(session.tutorial.stage).toBe('freePlay');
  expect(session.tutorial.gating).toEqual({ tunnelIds: 'all', holdingIds: 'all' });
  finish();

  const afterRelaunch = session.engineState.movesApplied;
  act(() => { session.launch('tunnel-1'); });
  expect(session.engineState.movesApplied).toBeGreaterThan(afterRelaunch);
  act(() => root.unmount());
});

test('completed tutorial does not replay when Level 1 is mounted again', () => {
  const root = mount(coreV2Level1(), [TUTORIAL_IDS.coreLevel1]);
  expect(session.tutorial.active).toBe(false);
  expect(session.tutorial.completed).toBe(true);
  act(() => { session.launch('tunnel-1'); });
  expect(session.engineState.movesApplied).toBe(1);
  expect(session.tutorial.active).toBe(false);
  act(() => root.unmount());
});

test('Legacy V1 campaign Level 1 is ungated', () => {
  const root = mount(LEVEL_DEFINITIONS[0]!, []);
  expect(session.tutorial.active).toBe(false);
  act(() => { session.launch('tunnel-1'); });
  expect(session.engineState.movesApplied).toBe(1);
  act(() => root.unmount());
});

test('Core V2 Level 2 is ungated', () => {
  const root = mount(coreV2Level1({ id: 2, title: 'Two' }), []);
  expect(session.tutorial.active).toBe(false);
  act(() => { session.launch('tunnel-1'); });
  expect(session.engineState.movesApplied).toBe(1);
  act(() => root.unmount());
});

test('winning marks the tutorial complete once', () => {
  const root = mount(coreV2Level1({
    pixelArt: ['R'],
    tunnels: [[{ color: 'red', capacity: 2 }], [], [], []],
  }));
  act(() => { session.launch('tunnel-0'); });
  finish();
  expect(session.engineState.status).toBe('won');
  expect(session.tutorial.completed).toBe(true);
  expect(session.tutorial.active).toBe(false);
  expect(tutorialComplete).toHaveBeenCalledWith(TUTORIAL_IDS.coreLevel1);
  expect(tutorialComplete).toHaveBeenCalledTimes(1);
  act(() => root.unmount());
});
