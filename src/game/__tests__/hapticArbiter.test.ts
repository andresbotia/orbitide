import { registerHit, cancelHits, flushHitsNow, GROUP_WINDOW_MS } from '../hapticArbiter';
import { haptics } from '../haptics';

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('../haptics', () => ({
  haptics: {
    pixelPop: jest.fn(), pixelCombo: jest.fn(), pixelBurst: jest.fn(), finalClear: jest.fn(),
  },
}));

const calls = () => ({
  pop: (haptics.pixelPop as jest.Mock).mock.calls.length,
  combo: (haptics.pixelCombo as jest.Mock).mock.calls.length,
  burst: (haptics.pixelBurst as jest.Mock).mock.calls.length,
  final: (haptics.finalClear as jest.Mock).mock.calls.length,
});
const total = () => { const c = calls(); return c.pop + c.combo + c.burst + c.final; };

beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); cancelHits(); });
afterEach(() => { cancelHits(); jest.useRealTimers(); });

test('a lone hit fires immediately — no added latency', () => {
  registerHit();
  expect(haptics.pixelPop).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(GROUP_WINDOW_MS);
  expect(total()).toBe(1);
});

test('hits inside an open group are counted into ONE pulse when it closes', () => {
  registerHit();
  jest.advanceTimersByTime(20); registerHit();
  jest.advanceTimersByTime(20); registerHit();
  expect(total()).toBe(1);
  jest.advanceTimersByTime(GROUP_WINDOW_MS);
  expect(calls()).toEqual({ pop: 1, combo: 1, burst: 0, final: 0 });
});

test('three or more grouped hits collapse to one capped burst', () => {
  registerHit(); registerHit(); registerHit(); registerHit();
  jest.advanceTimersByTime(GROUP_WINDOW_MS);
  expect(calls()).toEqual({ pop: 1, combo: 0, burst: 1, final: 0 });
});

test('the group window is fixed, never extended: a dense burst is never silent', () => {
  // Five Pals: a hit every ~22 ms for one second.
  for (let t = 0; t < 1000; t += 22) { registerHit(); jest.advanceTimersByTime(22); }
  jest.advanceTimersByTime(GROUP_WINDOW_MS * 2);
  const n = total();
  expect(n).toBeGreaterThanOrEqual(9); // at least one pulse per 100 ms group
  expect(n).toBeLessThanOrEqual(11); // never more than one per group
});

test('a single Pal (a hit every 110 ms) gets every hit on the beat', () => {
  for (let i = 0; i < 5; i++) { registerHit(); expect(total()).toBe(i + 1); jest.advanceTimersByTime(110); }
  expect(calls().pop).toBe(5);
});

test('a final clear fires at once — heavy — and absorbs the rest of its group', () => {
  registerHit(); registerHit({ final: true }); registerHit();
  expect(haptics.finalClear).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(GROUP_WINDOW_MS);
  expect(calls()).toEqual({ pop: 1, combo: 0, burst: 0, final: 1 });
});

test('cancelHits drops an open group and its pending pulse', () => {
  registerHit(); registerHit();
  cancelHits();
  jest.runAllTimers();
  expect(total()).toBe(1);
  expect(jest.getTimerCount()).toBe(0);
});

test('flushHitsNow fires a pending group pulse without waiting', () => {
  registerHit(); registerHit();
  flushHitsNow();
  expect(calls()).toEqual({ pop: 2, combo: 0, burst: 0, final: 0 });
  expect(jest.getTimerCount()).toBe(0);
});
