/**
 * Pure Studio document operations. Every function returns a new {@link StudioLevel}
 * (never mutates), so the editor's undo/redo is a plain snapshot stack and the
 * operations are trivially unit-tested without a renderer.
 */
import type { ChargeSpec, LevelDifficulty, OrbColor } from '@/game/engine/types';
import { LEVEL_DEFINITIONS } from '@/game/levels/levelDefinitions';
import { defaultHoldingCapacity, emptyTunnelQueues } from '@/game/engine/ruleset';
import { DEFAULT_GRID_SIZE, DEFAULT_HOLDING_CAPACITY, nextFreeLevelId } from './constants';
import { cellKey, parseCellKey } from './grid';
import { fromLevelDefinition } from './serialize';
import type { StudioLevel } from './types';

const clampInt = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));

/** Keep the modifier map in step with the cells it decorates. */
function syncModifiers(level: StudioLevel, keep: (key: string) => boolean): StudioLevel {
  if (!level.modifiers) return level;
  const next: NonNullable<StudioLevel['modifiers']> = {};
  for (const [key, mod] of Object.entries(level.modifiers)) {
    if (keep(key)) next[key] = mod;
  }
  if (Object.keys(next).length === Object.keys(level.modifiers).length) return level;
  if (Object.keys(next).length === 0) {
    const { modifiers: _drop, ...rest } = level;
    return rest;
  }
  return { ...level, modifiers: next };
}

/** A blank level: empty board, ruleset-shaped empty tunnels, next free campaign id. */
export function createBlankLevel(
  opts: Partial<Pick<StudioLevel, 'id' | 'width' | 'height' | 'title' | 'themeId' | 'difficulty' | 'ruleset' | 'holdingCapacity'>> = {},
): StudioLevel {
  const ruleset = opts.ruleset;
  return {
    id: opts.id ?? nextFreeLevelId(LEVEL_DEFINITIONS.map((l) => l.id)),
    title: opts.title ?? 'Untitled',
    themeId: opts.themeId ?? 'first-light',
    difficulty: opts.difficulty ?? 'easy',
    holdingCapacity: opts.holdingCapacity ?? (ruleset ? defaultHoldingCapacity(ruleset) : DEFAULT_HOLDING_CAPACITY),
    width: opts.width ?? DEFAULT_GRID_SIZE,
    height: opts.height ?? DEFAULT_GRID_SIZE,
    cells: {},
    tunnels: emptyTunnelQueues(ruleset),
    ...(ruleset ? { ruleset } : {}),
  };
}

/** Load an existing campaign level by id into a Studio document. */
export function loadCampaignLevel(id: number): StudioLevel {
  const def = LEVEL_DEFINITIONS.find((l) => l.id === id);
  if (!def) throw new Error(`No campaign level ${id}`);
  return fromLevelDefinition(def);
}

// ── board ───────────────────────────────────────────────────────────────────

export function paintCell(level: StudioLevel, x: number, y: number, color: OrbColor): StudioLevel {
  if (x < 0 || y < 0 || x >= level.width || y >= level.height) return level;
  if (level.cells[cellKey(x, y)] === color) return level;
  return { ...level, cells: { ...level.cells, [cellKey(x, y)]: color } };
}

export function eraseCell(level: StudioLevel, x: number, y: number): StudioLevel {
  const key = cellKey(x, y);
  if (!(key in level.cells)) return level;
  const cells = { ...level.cells };
  delete cells[key];
  return syncModifiers({ ...level, cells }, (k) => k !== key);
}

export function clearCanvas(level: StudioLevel): StudioLevel {
  if (Object.keys(level.cells).length === 0) return level;
  const cleared = { ...level, cells: {} };
  return syncModifiers(cleared, () => false);
}

/** Resize the grid; pixels that fall outside the new bounds are dropped. */
/**
 * Editor hard bound. Deliberately looser than `GRID_RANGE` (the legal range,
 * capped at `MAX_BOARD_DIMENSION`) so an out-of-range size still reaches the
 * validator and surfaces as an error instead of being silently clamped.
 */
const EDITOR_GRID_LIMIT = 64;

export function setGridSize(level: StudioLevel, width: number, height: number): StudioLevel {
  const w = clampInt(width, 1, EDITOR_GRID_LIMIT);
  const h = clampInt(height, 1, EDITOR_GRID_LIMIT);
  if (w === level.width && h === level.height) return level;
  const cells: Record<string, OrbColor> = {};
  for (const [key, color] of Object.entries(level.cells)) {
    const { x, y } = parseCellKey(key);
    if (x < w && y < h) cells[key] = color;
  }
  return syncModifiers({ ...level, width: w, height: h, cells }, (k) => k in cells);
}

// ── metadata ────────────────────────────────────────────────────────────────

export function setMeta(
  level: StudioLevel,
  patch: Partial<Pick<StudioLevel, 'id' | 'title' | 'themeId' | 'difficulty' | 'holdingCapacity'>>,
): StudioLevel {
  return { ...level, ...patch };
}

export function setDifficulty(level: StudioLevel, difficulty: LevelDifficulty): StudioLevel {
  return { ...level, difficulty };
}

// ── tunnel queues ───────────────────────────────────────────────────────────

const withTunnel = (level: StudioLevel, t: number, queue: ChargeSpec[]): StudioLevel => ({
  ...level,
  tunnels: level.tunnels.map((q, i) => (i === t ? queue : q)),
});

export function addCharge(level: StudioLevel, t: number, spec: ChargeSpec = { color: 'white', capacity: 1 }): StudioLevel {
  const queue = level.tunnels[t];
  if (!queue) return level;
  return withTunnel(level, t, [...queue, { ...spec }]);
}

export function removeCharge(level: StudioLevel, t: number, index: number): StudioLevel {
  const queue = level.tunnels[t];
  if (!queue || index < 0 || index >= queue.length) return level;
  return withTunnel(level, t, queue.filter((_, i) => i !== index));
}

export function updateCharge(level: StudioLevel, t: number, index: number, patch: Partial<ChargeSpec>): StudioLevel {
  const queue = level.tunnels[t];
  if (!queue || !queue[index]) return level;
  return withTunnel(level, t, queue.map((s, i) => (i === index ? { ...s, ...patch } : s)));
}

export function moveCharge(level: StudioLevel, t: number, index: number, direction: -1 | 1): StudioLevel {
  const queue = level.tunnels[t];
  const target = index + direction;
  if (!queue || !queue[index] || !queue[target]) return level;
  const next = [...queue];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return withTunnel(level, t, next);
}

export function duplicateCharge(level: StudioLevel, t: number, index: number): StudioLevel {
  const queue = level.tunnels[t];
  if (!queue || !queue[index]) return level;
  const next = [...queue];
  next.splice(index + 1, 0, { ...queue[index]! });
  return withTunnel(level, t, next);
}

// ── undo / redo ─────────────────────────────────────────────────────────────

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
}

export function initHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] };
}

/** Push a new present; clears the redo stack. Bounded to `limit` past entries. */
export function commit<T>(history: History<T>, next: T, limit = 100): History<T> {
  if (next === history.present) return history;
  const past = [...history.past, history.present];
  return { past: past.slice(-limit), present: next, future: [] };
}

export function undo<T>(history: History<T>): History<T> {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1]!;
  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redo<T>(history: History<T>): History<T> {
  if (history.future.length === 0) return history;
  const [next, ...rest] = history.future;
  return { past: [...history.past, history.present], present: next!, future: rest };
}

export const canUndo = <T>(h: History<T>): boolean => h.past.length > 0;
export const canRedo = <T>(h: History<T>): boolean => h.future.length > 0;
