/** Screen coordinates: positive angles turn clockwise. At bottom, velocity is leftward. */
export const ORBIT_ENTRY_FRACTION = 0.5;
export const ORBIT_DIRECTION = 1;
export function clockwiseGap(from: number, to: number): number {
  return ((to - from) % 1 + 1) % 1;
}
export function orbitFraction(progress: number): number {
  'worklet';
  return ORBIT_ENTRY_FRACTION + ORBIT_DIRECTION * progress;
}
