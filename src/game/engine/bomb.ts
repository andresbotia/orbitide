import type { GameState, Pixel } from './types';
import { settleStatus } from './winState';

export interface BombTarget {
  x: number;
  y: number;
}

export interface BombOutcome {
  accepted: boolean;
  state: GameState;
  clearedPixels: Pixel[];
  clearedPixelIds: string[];
  rejection?: 'invalidTarget' | 'zeroCleared' | 'gameOver';
}

/**
 * Checks if target (x, y) is a valid, uncleared pixel on the board.
 */
export function isValidBombTarget(state: GameState, target: BombTarget): boolean {
  if (state.status !== 'playing') return false;
  return state.pixels.some((p) => p.x === target.x && p.y === target.y && !p.cleared);
}

/**
 * Returns all pixels that would be cleared if a bomb was dropped at (target.x, target.y).
 * A pixel is affected if:
 *   abs(px.x - target.x) <= 1 && abs(px.y - target.y) <= 1 && !px.cleared
 */
export function prospectiveBombPixels(state: GameState, target: BombTarget): Pixel[] {
  return state.pixels.filter(
    (p) => !p.cleared && Math.abs(p.x - target.x) <= 1 && Math.abs(p.y - target.y) <= 1,
  );
}

/**
 * Applies a targeted bomb at (target.x, target.y).
 * Affects normal clearable gameplay pixels within the 3x3 region centered at target.
 * Deterministic and pure. Does not touch React Native or rendering.
 */
export function applyBomb(state: GameState, target: BombTarget): BombOutcome {
  if (state.status !== 'playing') {
    return { accepted: false, state, clearedPixels: [], clearedPixelIds: [], rejection: 'gameOver' };
  }

  // Target must be a real, uncleared pixel
  const targetPixel = state.pixels.find((p) => p.x === target.x && p.y === target.y && !p.cleared);
  if (!targetPixel) {
    return { accepted: false, state, clearedPixels: [], clearedPixelIds: [], rejection: 'invalidTarget' };
  }

  const clearedPixels: Pixel[] = [];
  const clearedPixelIds: string[] = [];

  const nextPixels = state.pixels.map((p) => {
    if (!p.cleared && Math.abs(p.x - target.x) <= 1 && Math.abs(p.y - target.y) <= 1) {
      clearedPixels.push(p);
      clearedPixelIds.push(p.id);
      return { ...p, cleared: true };
    }
    return p;
  });

  if (clearedPixels.length === 0) {
    return { accepted: false, state, clearedPixels: [], clearedPixelIds: [], rejection: 'zeroCleared' };
  }

  const updatedState: GameState = {
    ...state,
    pixels: nextPixels,
    movesApplied: state.movesApplied + 1,
  };

  const settled = settleStatus(updatedState);
  return {
    accepted: true,
    state: settled,
    clearedPixels,
    clearedPixelIds,
  };
}
