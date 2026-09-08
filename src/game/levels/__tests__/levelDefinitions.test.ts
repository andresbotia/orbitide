import { createGame } from '../../engine/createGame';
import { resolveMove } from '../../engine/resolveMove';
import { solve } from '../../engine/__tests__/solver';
import { LEVEL_DEFINITIONS } from '../levelDefinitions';
import { TOTAL_LEVELS, getLevel, nextLevelId } from '../levels';

describe('M1 level campaign', () => {
  it('contains exactly 10 levels numbered 1..10', () => {
    expect(TOTAL_LEVELS).toBe(10);
    expect(LEVEL_DEFINITIONS.map((l) => l.id)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it('every level keeps the 3-slot holding tray', () => {
    for (const level of LEVEL_DEFINITIONS) {
      expect(level.holdingCapacity).toBe(3);
    }
  });

  it('every level has orb counts that exactly match its Core targets', () => {
    for (const level of LEVEL_DEFINITIONS) {
      const laneCounts = new Map<string, number>();
      for (const lane of level.lanes) {
        for (const color of lane) {
          laneCounts.set(color, (laneCounts.get(color) ?? 0) + 1);
        }
      }
      const targetCounts = new Map<string, number>();
      for (const target of level.coreTargets) {
        targetCounts.set(
          target.color,
          (targetCounts.get(target.color) ?? 0) + target.count,
        );
      }
      expect(Object.fromEntries(laneCounts)).toEqual(
        Object.fromEntries(targetCounts),
      );
    }
  });

  it.each(LEVEL_DEFINITIONS.map((l) => l.id))(
    'level %i is solvable',
    (id) => {
      const level = getLevel(id);
      expect(level).toBeDefined();
      const result = solve(level!);
      expect(result.solved).toBe(true);
      expect(result.moves.length).toBeGreaterThan(0);
    },
  );

  it('replaying a solver line on a fresh game reaches "won"', () => {
    for (const level of LEVEL_DEFINITIONS) {
      const { moves } = solve(level);
      let state = createGame(level);
      for (const orbId of moves) {
        const outcome = resolveMove(state, orbId);
        expect(outcome.accepted).toBe(true);
        state = outcome.state;
      }
      expect(state.status).toBe('won');
    }
  });

  it('progression links level N to level N+1, ending after 10', () => {
    expect(nextLevelId(1)).toBe(2);
    expect(nextLevelId(9)).toBe(10);
    expect(nextLevelId(10)).toBeUndefined();
  });
});
