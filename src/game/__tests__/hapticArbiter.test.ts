import { registerHit, cancelHits, flushHitsNow, COALESCE_WINDOW_MS } from '../hapticArbiter';
import { haptics } from '../haptics';

jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('../haptics', () => ({
  haptics: {
    pixelPop: jest.fn(), pixelCombo: jest.fn(), pixelBurst: jest.fn(), finalClear: jest.fn(),
  },
}));

beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); cancelHits(); });
afterEach(() => { cancelHits(); jest.useRealTimers(); });

test('a lone hit fires one normal pixel impact after the coalesce window', () => {
  registerHit();
  expect(haptics.pixelPop).not.toHaveBeenCalled();
  jest.advanceTimersByTime(COALESCE_WINDOW_MS);
  expect(haptics.pixelPop).toHaveBeenCalledTimes(1);
  expect(haptics.pixelCombo).not.toHaveBeenCalled();
  expect(haptics.pixelBurst).not.toHaveBeenCalled();
});

test('two hits inside the window collapse to one stronger impact', () => {
  registerHit();
  jest.advanceTimersByTime(COALESCE_WINDOW_MS - 5);
  registerHit();
  jest.advanceTimersByTime(COALESCE_WINDOW_MS);
  expect(haptics.pixelCombo).toHaveBeenCalledTimes(1);
  expect(haptics.pixelPop).not.toHaveBeenCalled();
});

test('three or more hits collapse to one capped burst', () => {
  registerHit(); registerHit(); registerHit(); registerHit();
  jest.advanceTimersByTime(COALESCE_WINDOW_MS);
  expect(haptics.pixelBurst).toHaveBeenCalledTimes(1);
  expect(haptics.pixelCombo).not.toHaveBeenCalled();
  expect(haptics.pixelPop).not.toHaveBeenCalled();
});

test('a final clear in the cluster wins — heavy, never a routine pop', () => {
  registerHit(); registerHit({ final: true }); registerHit();
  jest.advanceTimersByTime(COALESCE_WINDOW_MS);
  expect(haptics.finalClear).toHaveBeenCalledTimes(1);
  expect(haptics.pixelBurst).not.toHaveBeenCalled();
});

test('never fires five separate buzzes for five near-simultaneous impacts', () => {
  for (let i = 0; i < 5; i++) registerHit();
  jest.advanceTimersByTime(COALESCE_WINDOW_MS);
  const total = (haptics.pixelPop as jest.Mock).mock.calls.length
    + (haptics.pixelCombo as jest.Mock).mock.calls.length
    + (haptics.pixelBurst as jest.Mock).mock.calls.length;
  expect(total).toBe(1);
});

test('cancelHits drops a buffered pulse (backgrounded / restarted)', () => {
  registerHit(); registerHit();
  cancelHits();
  jest.runAllTimers();
  expect(haptics.pixelPop).not.toHaveBeenCalled();
  expect(haptics.pixelCombo).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

test('flushHitsNow fires without waiting for the window', () => {
  registerHit();
  flushHitsNow();
  expect(haptics.pixelPop).toHaveBeenCalledTimes(1);
});
