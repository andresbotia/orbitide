import type { LevelDifficulty } from '../engine/types';

/**
 * Shared difficulty representation. This is the hook the Home screen's badge and
 * the future Difficulty Gate intro both read — one place, no second system.
 */
export interface DifficultyMeta {
  key: LevelDifficulty;
  label: string;
  /** 1..5, for pip / gate rendering. */
  tier: number;
  /** Token name in the arcade palette family. */
  accent: 'accent' | 'warn' | 'danger';
}

const META: Record<LevelDifficulty, DifficultyMeta> = {
  easy: { key: 'easy', label: 'EASY', tier: 1, accent: 'accent' },
  medium: { key: 'medium', label: 'MEDIUM', tier: 2, accent: 'accent' },
  hard: { key: 'hard', label: 'HARD', tier: 3, accent: 'warn' },
  'super-hard': { key: 'super-hard', label: 'SUPER HARD', tier: 4, accent: 'danger' },
  extreme: { key: 'extreme', label: 'EXTREME', tier: 5, accent: 'danger' },
};

export function difficultyMeta(difficulty: LevelDifficulty): DifficultyMeta {
  return META[difficulty] ?? META.easy;
}

export const MAX_DIFFICULTY_TIER = 5;
