import { createGame } from '../../engine/createGame';
import { resolveLaunch } from '../../engine/resolveLaunch';
import { solve } from '../../engine/__tests__/solver';
import { LEVEL_DEFINITIONS } from '../levelDefinitions';
import { TOTAL_LEVELS, getLevel, nextLevelId } from '../levels';

describe('M1 pixel-clearing campaign', () => {
  it('contains exactly 10 levels numbered 1..10', () => {
    expect(TOTAL_LEVELS).toBe(10);
    expect(LEVEL_DEFINITIONS.map((l) => l.id)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
  });

  it('every level has exactly 3 tunnels and the 3-slot Holding tray', () => {
    for (const level of LEVEL_DEFINITIONS) {
      expect(level.tunnels).toHaveLength(3);
      expect(level.holdingCapacity).toBe(3);
      expect(level.tunnels.every((t) => t.length > 0)).toBe(true);
    }
  });

  it('has the intended difficulty ramp (1-8 easy, 9 medium, 10 hard)', () => {
    const byId = Object.fromEntries(LEVEL_DEFINITIONS.map((l) => [l.id, l.difficulty]));
    for (let id = 1; id <= 8; id += 1) expect(byId[id]).toBe('easy');
    expect(byId[9]).toBe('medium');
    expect(byId[10]).toBe('hard');
  });

  it('every level carries theming metadata', () => {
    for (const level of LEVEL_DEFINITIONS) {
      expect(level.title.length).toBeGreaterThan(0);
      expect(level.themeId.length).toBeGreaterThan(0);
    }
  });

  it('every color has enough total charge capacity to clear its pixels', () => {
    for (const level of LEVEL_DEFINITIONS) {
      const state = createGame(level); // also asserts the art parses
      const pixelsByColor = new Map<string, number>();
      for (const p of state.pixels) {
        pixelsByColor.set(p.color, (pixelsByColor.get(p.color) ?? 0) + 1);
      }
      const capByColor = new Map<string, number>();
      for (const tunnel of level.tunnels) {
        for (const spec of tunnel) {
          capByColor.set(spec.color, (capByColor.get(spec.color) ?? 0) + spec.capacity);
        }
      }
      for (const [color, pixels] of pixelsByColor) {
        expect(capByColor.get(color) ?? 0).toBeGreaterThanOrEqual(pixels);
      }
    }
  });

  it.each(LEVEL_DEFINITIONS.map((l) => l.id))('level %i is solver-proven', (id) => {
    const level = getLevel(id);
    expect(level).toBeDefined();
    const result = solve(level!);
    expect(result.solved).toBe(true);
    expect(result.moves.length).toBeGreaterThan(0);
    expect(result.viableFirstMoves).toBeGreaterThanOrEqual(1);
    // M1 keeps peak Holding within the 3 slots for a correct line.
    expect(result.peakHolding).toBeLessThanOrEqual(3);
  });

  it('replaying a solver line on a fresh game reaches "won"', () => {
    for (const level of LEVEL_DEFINITIONS) {
      const { moves } = solve(level);
      let state = createGame(level);
      for (const tunnelId of moves) {
        const outcome = resolveLaunch(state, tunnelId);
        expect(outcome.accepted).toBe(true);
        state = outcome.state;
      }
      expect(state.status).toBe('won');
    }
  });

  it('the Satellite level (7) has a genuinely reachable failure state', () => {
    // Launch every buried front charge before opening the shell -> Holding full.
    let state = createGame(getLevel(7)!);
    state = resolveLaunch(state, 'tunnel-0').state;
    state = resolveLaunch(state, 'tunnel-1').state;
    const dead = resolveLaunch(state, 'tunnel-2');
    expect(dead.state.status).toBe('lost');
  });

  it('progression links level N to level N+1, ending after 10', () => {
    expect(nextLevelId(1)).toBe(2);
    expect(nextLevelId(9)).toBe(10);
    expect(nextLevelId(10)).toBeUndefined();
  });
});
