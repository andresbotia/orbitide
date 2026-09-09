/**
 * Special-pixel validation. Pure, centralised — the UI renders these issues and
 * never re-derives a rule. Errors block export; warnings do not.
 *
 * The rules check *authoring integrity* (a modifier points at a real pixel, its
 * config is in range, link groups are wired). They deliberately say nothing
 * about gameplay behaviour — no mechanic is implemented yet.
 */
import type { ModifierKind } from '@/game/engine/types';
import { MODIFIER_KINDS, MODIFIER_SPECS, modifierEntries } from './modifiers';
import type { StudioLevel, ValidationIssue } from './types';

export function checkModifiers(level: StudioLevel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (i: Omit<ValidationIssue, 'severity'>) => issues.push({ ...i, severity: 'error' });
  const warn = (i: Omit<ValidationIssue, 'severity'>) => issues.push({ ...i, severity: 'warning' });
  if (!level.modifiers) return issues;

  // Raw key sanity (import can produce malformed maps).
  for (const key of Object.keys(level.modifiers)) {
    if (!/^-?\d+,-?\d+$/.test(key)) {
      err({ code: 'modifier/bad-key', message: `Modifier key "${key}" is not a valid "x,y" cell.` });
    }
  }

  const linkedByGroup = new Map<string, number>();

  for (const { x, y, modifier } of modifierEntries(level)) {
    const where = { kind: 'modifier' as const, x, y };
    const at = `(${x}, ${y})`;

    if (!MODIFIER_KINDS.includes(modifier.kind)) {
      err({ code: 'modifier/kind', message: `Modifier at ${at} has unknown kind "${String(modifier.kind)}".`, where });
      continue;
    }
    const spec = MODIFIER_SPECS[modifier.kind as ModifierKind];

    if (!(`${x},${y}` in level.cells)) {
      err({ code: 'modifier/empty-cell', message: `A ${spec.label} modifier at ${at} has no pixel under it.`, where });
    }
    if (x < 0 || y < 0 || x >= level.width || y >= level.height) {
      err({ code: 'modifier/oob', message: `Modifier at ${at} is outside the ${level.width}×${level.height} grid.`, where });
    }

    const { layers, group, timer } = modifier.config;

    if (spec.layers) {
      if (layers === undefined || !Number.isInteger(layers) || layers < spec.layers.min || layers > spec.layers.max) {
        err({
          code: 'modifier/config-range',
          message: `${spec.label} at ${at}: ${spec.layers.label} must be an integer ${spec.layers.min}–${spec.layers.max} (got ${String(layers)}).`,
          where,
        });
      }
    } else if (layers !== undefined) {
      warn({ code: 'modifier/extra-config', message: `${spec.label} at ${at} carries a "layers" value it does not use.`, where });
    }

    if (spec.groupRequired && (!group || group.trim() === '')) {
      err({ code: 'modifier/linked-group-missing', message: `${spec.label} at ${at} needs a link-group id.`, where });
    }
    if (modifier.kind === 'linked' && group) {
      linkedByGroup.set(group, (linkedByGroup.get(group) ?? 0) + 1);
    }

    if (modifier.kind === 'bomb' && timer !== undefined) {
      warn({
        code: 'modifier/bomb-placeholder',
        message: `Bomb at ${at} has a timer (${timer}) — this is inert authoring metadata; no countdown rule exists yet.`,
        where,
      });
    }
    if (spec.placeholder && modifier.kind !== 'bomb') {
      warn({
        code: 'modifier/placeholder-kind',
        message: `${spec.label} at ${at}: no gameplay rule is implemented yet — this authors visual/metadata state only.`,
        where,
      });
    }
  }

  for (const [group, count] of linkedByGroup) {
    if (count < 2) {
      const member = modifierEntries(level).find(
        (e) => e.modifier.kind === 'linked' && e.modifier.config.group === group,
      );
      issues.push({
        code: 'modifier/linked-orphan',
        severity: 'error',
        message: `Link group "${group}" has only ${count} member — a link group needs at least 2.`,
        ...(member ? { where: { kind: 'modifier' as const, x: member.x, y: member.y } } : {}),
      });
    }
  }

  return issues;
}
