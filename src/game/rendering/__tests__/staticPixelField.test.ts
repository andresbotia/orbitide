import { createGame } from '@/game/engine/createGame';
import { exteriorMask, isPixelReachable, reachablePixels } from '@/game/engine/pixels';
import { LEVEL_DEFINITIONS } from '@/game/levels/levels';
import { buildPixelBuckets, DIM_STEPS } from '../pixelField';
import type { GameState, Pixel } from '@/game/engine/types';

/**
 * The batched Skia field replaced one React subtree per cell. Its visibility and
 * reachability rules therefore have to match what the per-cell renderer drew,
 * exactly — these lock that down.
 */

const NO_DIM: ReadonlyMap<string, number> = new Map();
const NONE: ReadonlySet<string> = new Set();

function board(levelId = 100): GameState {
  return createGame(LEVEL_DEFINITIONS.find((l) => l.id === levelId)!);
}

function reachableFor(state: GameState): (p: Pixel) => boolean {
  const mask = exteriorMask(state);
  return (p) => isPixelReachable(mask, p);
}

function drawnIds(buckets: Map<string, { members: number[] }>, state: GameState): Set<string> {
  const ids = new Set<string>();
  for (const bucket of buckets.values()) {
    for (const index of bucket.members) ids.add(state.pixels[index]!.id);
  }
  return ids;
}

test('draws every uncleared pixel and nothing else', () => {
  const state = board();
  const buckets = buildPixelBuckets(state.pixels, NONE, NO_DIM, reachableFor(state));
  const drawn = drawnIds(buckets, state);
  const expected = new Set(state.pixels.filter((p) => !p.cleared).map((p) => p.id));
  expect(drawn).toEqual(expected);
});

test('a cleared pixel drops out of the field', () => {
  const state = board();
  const target = state.pixels[0]!;
  const next: GameState = {
    ...state,
    pixels: state.pixels.map((p) => (p.id === target.id ? { ...p, cleared: true } : p)),
  };
  const buckets = buildPixelBuckets(next.pixels, NONE, NO_DIM, reachableFor(next));
  expect(drawnIds(buckets, next).has(target.id)).toBe(false);
});

test('pixels an active flight is popping are left to that flight', () => {
  const state = board();
  const shot = new Set([state.pixels[3]!.id, state.pixels[9]!.id]);
  const buckets = buildPixelBuckets(state.pixels, shot, NO_DIM, reachableFor(state));
  const drawn = drawnIds(buckets, state);
  for (const id of shot) expect(drawn.has(id)).toBe(false);
  expect(drawn.size).toBe(state.pixels.filter((p) => !p.cleared).length - shot.size);
});

test('reachability matches the engine exposure rule the old renderer used', () => {
  const state = board();
  const buckets = buildPixelBuckets(state.pixels, NONE, NO_DIM, reachableFor(state));
  const engineReachable = new Set(reachablePixels(state).map((p) => p.id));

  for (const bucket of buckets.values()) {
    for (const index of bucket.members) {
      const pixel = state.pixels[index]!;
      expect(bucket.reachable).toBe(engineReachable.has(pixel.id));
    }
  }
});

test('every pixel in a bucket shares that bucket colour, reachability and dim', () => {
  const state = board();
  const dim = new Map<string, number>([[state.pixels[0]!.id, 0.5]]);
  const isReachable = reachableFor(state);
  const buckets = buildPixelBuckets(state.pixels, NONE, dim, isReachable);

  for (const bucket of buckets.values()) {
    for (const index of bucket.members) {
      const pixel = state.pixels[index]!;
      expect(pixel.color).toBe(bucket.color);
      expect(isReachable(pixel)).toBe(bucket.reachable);
      expect(Math.round((dim.get(pixel.id) ?? 0) * DIM_STEPS)).toBe(bucket.dimStep);
    }
  }
});

test('a dimmed pixel is separated from its undimmed colour twins', () => {
  const state = board();
  const target = state.pixels.find((p) => !p.cleared)!;
  const dim = new Map<string, number>([[target.id, 1]]);
  const buckets = buildPixelBuckets(state.pixels, NONE, dim, reachableFor(state));

  const owning = [...buckets.values()].find((b) => b.members.some((i) => state.pixels[i]!.id === target.id))!;
  expect(owning.dimStep).toBe(DIM_STEPS);
  expect(owning.members).toHaveLength(1);
});

test('member indices stay ascending, so membership compares cheaply', () => {
  const state = board();
  const buckets = buildPixelBuckets(state.pixels, NONE, NO_DIM, reachableFor(state));
  for (const bucket of buckets.values()) {
    for (let i = 1; i < bucket.members.length; i += 1) {
      expect(bucket.members[i]!).toBeGreaterThan(bucket.members[i - 1]!);
    }
  }
});
