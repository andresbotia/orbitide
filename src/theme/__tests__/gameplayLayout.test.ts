import {
  activePalBadge, BAY_PAD, GAMEPLAY, orbitingPalVisual, QUEUE_GAP, QUEUE_SCALE, QUEUE_TUCK,
  queueColumnHeight, queueSizes, queueSlotMargin, queueSlotOpacity, queueSlotY,
} from '../gameplayLayout';

/**
 * Device-QA geometry locks (M5.8B follow-up):
 *  - the in-flight count plate is big enough to read at arm's length,
 *  - the tunnel queue has a real size hierarchy,
 *  - nothing overlaps the ready Pal's own badge,
 *  - and the column did not grow enough to steal board space.
 */

const READY = GAMEPLAY.readyPalMax; // 76pt — the widest tunnel column
const UPCOMING = 2;

describe('active count plate', () => {
  test('is 15-17pt with a 10-11pt numeral on a ~34pt Pal', () => {
    const b = activePalBadge(34);
    expect(b.height).toBeGreaterThanOrEqual(15);
    expect(b.height).toBeLessThanOrEqual(17);
    expect(b.fontSize).toBeGreaterThanOrEqual(10);
    expect(b.fontSize).toBeLessThanOrEqual(11.5);
  });

  test('never shrinks below the readable floor on the smallest board Pal', () => {
    const smallest = orbitingPalVisual(240);
    expect(activePalBadge(smallest).height).toBeGreaterThanOrEqual(15);
    expect(activePalBadge(smallest).fontSize).toBeGreaterThanOrEqual(10);
  });

  test('grows with the Pal, and the numeral stays proportionate', () => {
    const small = activePalBadge(32);
    const large = activePalBadge(GAMEPLAY.orbitingPalMax);
    expect(large.height).toBeGreaterThanOrEqual(small.height);
    expect(large.fontSize / large.height).toBeCloseTo(0.66, 1);
  });
});

describe('tunnel queue hierarchy', () => {
  const sizes = queueSizes(READY, UPCOMING);

  test('ready > next > next+1, each step clearly smaller', () => {
    expect(sizes[0]!).toBeLessThan(READY * 0.8);
    expect(sizes[1]!).toBeLessThan(sizes[0]!);
    // Each step is a visible drop, not a rounding difference.
    expect(sizes[0]! - sizes[1]!).toBeGreaterThanOrEqual(6);
    expect(READY - sizes[0]!).toBeGreaterThanOrEqual(12);
  });

  test('emphasis falls with depth', () => {
    expect(queueSlotOpacity(0)).toBeLessThan(1);
    expect(queueSlotOpacity(1)).toBeLessThan(queueSlotOpacity(0));
  });

  test('the first chip clears the bay instead of tucking under the ready Pal', () => {
    expect(QUEUE_TUCK[0]).toBe(0);
    expect(queueSlotMargin(0, sizes[0]!)).toBe(QUEUE_GAP);
    expect(QUEUE_GAP).toBeGreaterThanOrEqual(2);
    // The ready badge hangs ~12% of its height below the Pal; bay padding must
    // absorb that, so the badge can never reach the chip below the bay.
    const readyBadgeDrop = READY * 0.34 * 0.12;
    expect(BAY_PAD).toBeGreaterThan(readyBadgeDrop);
  });

  test('a deeper chip tucks, but stays more than half visible', () => {
    expect(QUEUE_TUCK[1]!).toBeGreaterThan(0);
    expect(QUEUE_TUCK[1]!).toBeLessThan(0.5);
  });

  test('slot tops are ordered and match the margins', () => {
    expect(queueSlotY(0, sizes)).toBe(QUEUE_GAP);
    expect(queueSlotY(1, sizes)).toBeGreaterThan(queueSlotY(0, sizes));
    // Slot 1 starts before slot 0 ends — that overlap is the tuck.
    expect(queueSlotY(1, sizes)).toBeLessThan(queueSlotY(0, sizes) + sizes[0]!);
  });

  test('the column does not grow enough to steal board space', () => {
    // Pre-QA layout: one 0.68x size for both chips, tucked 0.38 / 0.48, +4 top.
    const oldChip = Math.round(READY * 0.68);
    const previous = 4 + (oldChip - oldChip * 0.38) + (oldChip - oldChip * 0.48);
    const now = queueColumnHeight(READY, UPCOMING);
    // Bay padding shrank by 2pt per side, which pays for most of the growth.
    const baySaving = (7 - BAY_PAD) * 2;
    expect(now - previous - baySaving).toBeLessThanOrEqual(8);
  });

  test('scale table is the single source of truth and is ordered', () => {
    expect(QUEUE_SCALE.length).toBeGreaterThanOrEqual(UPCOMING);
    for (let i = 1; i < QUEUE_SCALE.length; i++) {
      expect(QUEUE_SCALE[i]!).toBeLessThan(QUEUE_SCALE[i - 1]!);
    }
    expect(QUEUE_SCALE[0]!).toBeLessThan(1);
  });
});
