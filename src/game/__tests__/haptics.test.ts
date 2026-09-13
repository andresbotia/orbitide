import * as Native from 'expo-haptics';
import { haptics, setHapticsEnabled, cancelPendingHaptics } from '../haptics';
import { feedback } from '../feedback';
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()), notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy', Rigid: 'rigid' },
  NotificationFeedbackType: { Warning: 'warning', Error: 'error', Success: 'success' },
}));
beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(0); jest.clearAllMocks(); setHapticsEnabled(true); });
afterEach(() => { cancelPendingHaptics(); feedback.setSoundHandler(null); jest.useRealTimers(); });
test.each([
  ['select', 'medium'], ['heldRelaunch', 'rigid'], ['denied', 'light'], ['orbitEnter', 'light'],
  ['pixelPop', 'rigid'], ['pixelCombo', 'medium'], ['pixelBurst', 'heavy'],
  ['iceCrack', 'light'], ['shieldBreak', 'light'], ['chargeConsumed', 'medium'], ['holdingLand', 'rigid'],
  ['finalClear', 'heavy'], ['nextPress', 'medium'], ['gateLock', 'rigid'],
] as const)('%s has its intended impact weight', (event, weight) => {
  haptics[event](); expect(Native.impactAsync).toHaveBeenCalledWith(weight);
});
test.each([['holdingCritical', 'warning'], ['holdingFull', 'error'], ['fail', 'error']] as const)(
  '%s has its intended notification', (event, kind) => {
    haptics[event](); expect(Native.notificationAsync).toHaveBeenCalledWith(kind);
  });
test('pixel throttle prevents duplicate impacts but preserves 110ms clear cadence', () => {
  haptics.pixelPop(); haptics.pixelPop();
  expect(Native.impactAsync).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(110); haptics.pixelPop();
  expect(Native.impactAsync).toHaveBeenCalledTimes(2);
});
test.each(['win', 'discoveryResolve'] as const)('%s produces success plus one controlled medium impact after 120ms', (event) => {
  haptics[event]();
  expect(Native.notificationAsync).toHaveBeenCalledWith('success');
  expect(Native.impactAsync).not.toHaveBeenCalled();
  jest.advanceTimersByTime(120);
  expect(Native.impactAsync).toHaveBeenCalledTimes(1);
  expect(Native.impactAsync).toHaveBeenCalledWith('medium');
});

test('capstoneWin produces success plus one heavier impact after 160ms (redesign Milestone 1 addition)', () => {
  haptics.capstoneWin();
  expect(Native.notificationAsync).toHaveBeenCalledWith('success');
  expect(Native.impactAsync).not.toHaveBeenCalled();
  jest.advanceTimersByTime(160);
  expect(Native.impactAsync).toHaveBeenCalledTimes(1);
  expect(Native.impactAsync).toHaveBeenCalledWith('heavy');
});

test('finalClear and the discovery success buzz do not stack into one another', () => {
  haptics.finalClear();
  expect(Native.impactAsync).toHaveBeenCalledWith('heavy');
  jest.advanceTimersByTime(400);
  haptics.discoveryResolve();
  jest.advanceTimersByTime(120);
  // one heavy (final clear) + one medium (discovery bloom); no extra buzzes
  expect(Native.impactAsync).toHaveBeenCalledTimes(2);
  expect(Native.notificationAsync).toHaveBeenCalledTimes(1);
});
test.each(['cancel', 'disable'])('%s removes pending win impact', (action) => {
  haptics.win();
  if (action === 'cancel') cancelPendingHaptics(); else setHapticsEnabled(false);
  jest.runAllTimers(); expect(Native.impactAsync).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});
test('global off disables impacts/notifications without breaking future sound hooks', () => {
  setHapticsEnabled(false);
  const sound = jest.fn(); feedback.setSoundHandler(sound);
  feedback.emit('select'); feedback.emit('win');
  expect(Native.impactAsync).not.toHaveBeenCalled();
  expect(Native.notificationAsync).not.toHaveBeenCalled();
  expect(sound).toHaveBeenCalledWith('select', expect.any(Object));
});
test('suppressed coincident haptics still invoke the semantic sound hook', () => {
  const sound = jest.fn(); feedback.setSoundHandler(sound);
  feedback.emit('pixelPop', { haptic: false });
  expect(Native.impactAsync).not.toHaveBeenCalled();
  expect(sound).toHaveBeenCalledWith('pixelPop', expect.objectContaining({ haptic: false }));
});
test('native feedback or optional sound failure cannot throw into gameplay', () => {
  (Native.impactAsync as jest.Mock).mockImplementationOnce(() => { throw new Error('unavailable'); });
  feedback.setSoundHandler(() => { throw new Error('audio unavailable'); });
  expect(() => feedback.emit('select')).not.toThrow();
});
