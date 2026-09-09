/**
 * Lightweight, shared Level Studio validation. Pure — no React, no UI strings
 * baked into components. The UI renders {@link ValidationReport}; it does not
 * re-implement any rule.
 *
 * Errors block export as a production level. Warnings do not — the editor stays
 * usable and a designer can knowingly ship an unusual-but-legal level.
 *
 * Where a check needs real engine semantics it calls the real engine
 * (`toLevelDefinition` → `createGame`), never a private copy of the rules.
 */
import { createGame, TUNNEL_COUNT } from '@/game/engine/createGame';
import type { OrbColor } from '@/game/engine/types';
import { LEVEL_DIFFICULTIES } from './constants';
import { GRID_RANGE, TUNED_GRID_SIZES, cellKey, parseCellKey } from './grid';
import { toLevelDefinition, usedColors } from './serialize';
import { checkModifiers } from './validateModifiers';
import { checkReveal } from './validateReveal';
import type { StudioLevel, ValidationIssue, ValidationReport } from './types';

export function validateStudioLevel(level: StudioLevel): ValidationReport {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const err = (i: Omit<ValidationIssue, 'severity'>) => errors.push({ ...i, severity: 'error' });
  const warn = (i: Omit<ValidationIssue, 'severity'>) => warnings.push({ ...i, severity: 'warning' });

  // ── metadata ──────────────────────────────────────────────────────────────
  if (!Number.isInteger(level.id) || level.id <= 0) {
    err({ code: 'meta/id', message: 'Level id must be a positive whole number.', where: { kind: 'metadata', field: 'id' } });
  }
  if (level.title.trim().length === 0) {
    warn({ code: 'meta/title', message: 'Level has no title.', where: { kind: 'metadata', field: 'title' } });
  }
  if (level.themeId.trim().length === 0) {
    warn({ code: 'meta/theme', message: 'Level has no theme / artwork name.', where: { kind: 'metadata', field: 'themeId' } });
  }
  if (!LEVEL_DIFFICULTIES.includes(level.difficulty)) {
    err({ code: 'meta/difficulty', message: `Difficulty "${level.difficulty}" is not one of ${LEVEL_DIFFICULTIES.join(', ')}.`, where: { kind: 'metadata', field: 'difficulty' } });
  }
  if (level.holdingCapacity !== 3) {
    warn({ code: 'meta/holding', message: `Holding capacity is ${level.holdingCapacity}; every shipped level uses 3.`, where: { kind: 'metadata', field: 'holdingCapacity' } });
  }
  for (const [field, value] of [['width', level.width], ['height', level.height]] as const) {
    if (!Number.isInteger(value) || value < GRID_RANGE.min || value > GRID_RANGE.max) {
      err({ code: `meta/${field}`, message: `Grid ${field} ${value} is outside the supported range ${GRID_RANGE.min}–${GRID_RANGE.max}.`, where: { kind: 'metadata', field } });
    } else if (!(TUNED_GRID_SIZES as readonly number[]).includes(value)) {
      warn({ code: `meta/${field}-tuned`, message: `Grid ${field} ${value} is legal but outside the renderer-tuned sizes (${TUNED_GRID_SIZES.join(', ')}).`, where: { kind: 'metadata', field } });
    }
  }

  // ── board ─────────────────────────────────────────────────────────────────
  const cellEntries = Object.entries(level.cells);
  if (cellEntries.length === 0) {
    err({ code: 'board/empty', message: 'The board has no pixels.', where: { kind: 'board' } });
  }
  const seenKeys = new Set<string>();
  for (const [key] of cellEntries) {
    const { x, y } = parseCellKey(key);
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= level.width || y >= level.height) {
      err({ code: 'board/oob', message: `Pixel at (${x}, ${y}) is outside the ${level.width}×${level.height} grid.`, where: { kind: 'cell', x, y } });
    }
    const canonical = cellKey(x, y);
    if (seenKeys.has(canonical)) {
      err({ code: 'board/dup', message: `Duplicate pixel at (${x}, ${y}).`, where: { kind: 'cell', x, y } });
    }
    seenKeys.add(canonical);
  }

  // ── tunnels ───────────────────────────────────────────────────────────────
  if (level.tunnels.length !== TUNNEL_COUNT) {
    err({ code: 'tunnels/count', message: `A level needs exactly ${TUNNEL_COUNT} tunnels; this has ${level.tunnels.length}.` });
  }
  level.tunnels.forEach((queue, t) => {
    if (queue.length === 0) {
      warn({ code: 'tunnels/empty', message: `Tunnel ${String.fromCharCode(65 + t)} has no charges.`, where: { kind: 'tunnel', tunnel: t } });
    }
    queue.forEach((spec, index) => {
      if (!Number.isInteger(spec.capacity) || spec.capacity <= 0) {
        err({ code: 'charge/capacity', message: `Tunnel ${String.fromCharCode(65 + t)} charge ${index + 1} has an invalid capacity (${spec.capacity}).`, where: { kind: 'charge', tunnel: t, index } });
      }
    });
  });

  // ── colour reachability / capacity budget ─────────────────────────────────
  const boardColors = usedColors(level);
  const capacityByColor = new Map<OrbColor, number>();
  for (const queue of level.tunnels) {
    for (const spec of queue) {
      if (Number.isInteger(spec.capacity) && spec.capacity > 0) {
        capacityByColor.set(spec.color, (capacityByColor.get(spec.color) ?? 0) + spec.capacity);
      }
    }
  }
  // Every Frozen pixel needs one extra matching hit per ice layer (M4A) — the
  // capacity budget must cover the crack(s) as well as the final clear.
  const frozenExtraByColor = new Map<OrbColor, number>();
  for (const [key, mod] of Object.entries(level.modifiers ?? {})) {
    if (mod.kind !== 'frozen') continue;
    const color = level.cells[key];
    if (!color) continue;
    const layers = Math.max(1, Math.trunc(mod.config.layers ?? 1));
    frozenExtraByColor.set(color, (frozenExtraByColor.get(color) ?? 0) + layers);
  }

  for (const color of boardColors) {
    const need = Object.entries(level.cells).filter(([, c]) => c === color).length
      + (frozenExtraByColor.get(color) ?? 0);
    const have = capacityByColor.get(color) ?? 0;
    if (have === 0) {
      err({ code: 'color/no-charge', message: `${need} ${color} pixel${need === 1 ? '' : 's'} but no ${color} charge in any tunnel.`, where: { kind: 'color', color } });
    } else if (have < need) {
      warn({ code: 'color/under-budget', message: `${color}: total charge capacity ${have} is below the ${need} ${color} pixels — the picture cannot be completed in ${color}.`, where: { kind: 'color', color } });
    } else if (have > need) {
      warn({ code: 'color/over-budget', message: `${color}: total charge capacity ${have} exceeds the ${need} ${color} pixels.`, where: { kind: 'color', color } });
    }
  }
  // Charges whose colour is nowhere on the board.
  for (const [color, have] of capacityByColor) {
    if (have > 0 && !boardColors.includes(color)) {
      warn({ code: 'color/unused-charge', message: `Tunnels carry ${have} ${color} capacity but there are no ${color} pixels.`, where: { kind: 'color', color } });
    }
  }

  // ── special pixels + discovery reveal (centralised in their own modules) ──
  for (const issue of [...checkModifiers(level), ...checkReveal(level)]) {
    (issue.severity === 'error' ? errors : warnings).push(issue);
  }

  // ── engine acceptance (last, only if otherwise structurally sound) ────────
  if (errors.length === 0) {
    try {
      createGame(toLevelDefinition(level));
    } catch (e) {
      err({ code: 'engine/reject', message: `The engine rejected this level: ${(e as Error).message}` });
    }
  }

  return {
    errors,
    warnings,
    ok: errors.length === 0,
    exportable: errors.length === 0,
  };
}
