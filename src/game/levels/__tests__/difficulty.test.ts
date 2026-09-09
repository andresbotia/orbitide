import { difficultyMeta, MAX_DIFFICULTY_TIER } from '../difficulty';
import { LEVEL_DEFINITIONS } from '../levelDefinitions';
import type { LevelDifficulty } from '../../engine/types';

const ALL: LevelDifficulty[] = ['easy', 'medium', 'hard', 'super-hard', 'extreme'];

test('every difficulty maps to an ascending tier within range and a valid accent', () => {
  let last = 0;
  for (const key of ALL) {
    const meta = difficultyMeta(key);
    expect(meta.key).toBe(key);
    expect(meta.tier).toBeGreaterThan(last);
    expect(meta.tier).toBeLessThanOrEqual(MAX_DIFFICULTY_TIER);
    expect(['accent', 'warn', 'danger']).toContain(meta.accent);
    last = meta.tier;
  }
});

test('unknown difficulty falls back to easy rather than throwing', () => {
  expect(difficultyMeta('bogus' as LevelDifficulty).key).toBe('easy');
});

test('every campaign level has a resolvable difficulty', () => {
  for (const level of LEVEL_DEFINITIONS) {
    expect(() => difficultyMeta(level.difficulty)).not.toThrow();
    expect(difficultyMeta(level.difficulty).tier).toBeGreaterThanOrEqual(1);
  }
});
