import { assignLaneSlots, laneOffset } from '../laneAssignment';

test('first five Pals get the same lanes the index-based layout gave them', () => {
  const slots = assignLaneSlots(new Map(), [1, 2, 3, 4, 5]);
  expect([1, 2, 3, 4, 5].map((id) => laneOffset(slots.get(id)!, 3))).toEqual([-0, 3, -3, 6, -6]);
});

test('a Pal keeps its lane when an earlier Pal leaves', () => {
  const five = assignLaneSlots(new Map(), [1, 2, 3, 4, 5]);
  const after = assignLaneSlots(five, [2, 3, 4, 5]);
  for (const id of [2, 3, 4, 5]) expect(after.get(id)).toBe(five.get(id));
});

test('a newcomer takes the lowest free lane, never a lane still in use', () => {
  const four = assignLaneSlots(assignLaneSlots(new Map(), [1, 2, 3, 4]), [2, 3, 4]);
  const next = assignLaneSlots(four, [2, 3, 4, 6]);
  expect(next.get(6)).toBe(0);
  expect(new Set([2, 3, 4, 6].map((id) => next.get(id))).size).toBe(4);
});

test('an unchanged flight set returns the same map', () => {
  const a = assignLaneSlots(new Map(), [1, 2]);
  expect(assignLaneSlots(a, [1, 2])).toBe(a);
});
