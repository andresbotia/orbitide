/**
 * Concurrent stress (Test C, permanent): random 5-Pal cadences on real
 * campaign levels. Whenever no join contradicted presented history, the
 * session must converge to truth before settleAll, every Pal must terminate
 * exactly once, and no DEV lifecycle assert may fire.
 */
import { requireLevel } from '@/game/levels/levels';
import { drive, expectConverged, mountSession, type DriveLaunch } from './sessionDriver';

jest.mock('react-native', () => ({ AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) } }));
jest.mock('@/game/feedback', () => ({ feedback: { emit: jest.fn(), cancelPending: jest.fn() } }));
jest.mock('@/game/hapticArbiter', () => ({ registerHit: jest.fn(), cancelHits: jest.fn() }));

beforeEach(() => {
  jest.useFakeTimers({ now: 0 });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => { jest.useRealTimers(); });

function schedule(seed: number, tunnels: number): DriveLaunch[] {
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  let at = 0;
  return Array.from({ length: 5 }, () => {
    at += 150 + Math.floor(rnd() * 1800);
    return { at, tunnel: `tunnel-${Math.floor(rnd() * tunnels)}` };
  });
}

const CASES: [number, number][] = [];
for (const level of [3, 5, 7, 9, 12]) for (const seed of [1, 2, 3, 4]) CASES.push([level, seed]);

test.each(CASES)('level %i, seed %i', (levelId, seed) => {
  const level = requireLevel(levelId);
  const s = mountSession(level);
  const plan = schedule(seed * 7919 + levelId, level.tunnels.length).filter((l) => {
    const t = level.tunnels[Number(l.tunnel!.split('-')[1])];
    return t && t.length > 0;
  });
  const log = drive(s.get, plan);
  s.unmount();
  const lifecycle = log.devMessages.filter((m) => m.startsWith('[PA_LIFECYCLE]'));
  expect(lifecycle).toEqual([]);
  for (const id of log.launched) expect({ id, n: log.terminals.get(id)?.length ?? 0 }).toEqual({ id, n: 1 });
  if (log.divergences.length === 0) {
    expect(log.violations.filter((v) => !v.includes('rejected'))).toEqual([]);
    expectConverged(log.preSettle!.view, log.preSettle!.truth);
  }
});
