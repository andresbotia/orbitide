import * as Native from 'expo-haptics';
import { haptics, setHapticsEnabled, cancelPendingHaptics } from '../haptics';
import { feedback } from '../feedback';
jest.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()), notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Rigid: 'rigid' },
  NotificationFeedbackType: { Warning: 'warning', Error: 'error', Success: 'success' },
}));
beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(0); jest.clearAllMocks(); setHapticsEnabled(true); });
afterEach(() => { cancelPendingHaptics(); feedback.setSoundHandler(null); jest.useRealTimers(); });
test.each([
  ['select', 'medium'], ['heldRelaunch', 'rigid'], ['orbitEnter', 'light'],
  ['pixelPop', 'rigid'], ['chargeConsumed', 'medium'], ['holdingLand', 'rigid'],
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
test('win produces success plus one controlled medium impact after 120ms', () => {
  haptics.win();
  expect(Native.notificationAsync).toHaveBeenCalledWith('success');
  expect(Native.impactAsync).not.toHaveBeenCalled();
  jest.advanceTimersByTime(120);
  expect(Native.impactAsync).toHaveBeenCalledTimes(1);
  expect(Native.impactAsync).toHaveBeenCalledWith('medium');
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
  expect(sound).toHaveBeenCalledWith('select');
});
test('suppressed coincident haptics still invoke the semantic sound hook', () => {
  const sound = jest.fn(); feedback.setSoundHandler(sound);
  feedback.emit('pixelPop', { haptic: false });
  expect(Native.impactAsync).not.toHaveBeenCalled();
  expect(sound).toHaveBeenCalledWith('pixelPop');
});
test('native feedback or optional sound failure cannot throw into gameplay', () => {
  (Native.impactAsync as jest.Mock).mockImplementationOnce(() => { throw new Error('unavailable'); });
  feedback.setSoundHandler(() => { throw new Error('audio unavailable'); });
  expect(() => feedback.emit('select')).not.toThrow();
});
