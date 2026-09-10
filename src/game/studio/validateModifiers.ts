/**
 * Special-pixel validation. Pure, centralised — the UI renders these issues and
 * never re-derives a rule. Errors block export; warnings do not.
 *
 * The rules check *authoring integrity* (a modifier points at a real pixel, its
 * config is in range, link groups are wired). They deliberately say nothing
 * about gameplay behaviour — no mechanic is implemented yet.
 */
import type { LevelDefinition, ModifierKind } from '@/game/engine/types';
import { MODIFIER_KINDS, MODIFIER_SPECS, modifierEntries } from './modifiers';
import type { StudioLevel, ValidationIssue } from './types';

/** Validate relationship metadata that would otherwise be normalized by Studio import. */
export function checkLinkedDefinition(def: LevelDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const members = new Map<string, string[]>();
  const linked = Object.entries(def.modifiers ?? {}).filter(([, modifier]) => modifier.kind === 'linked');
  for (const [key, modifier] of linked) {
    const [x, y] = key.split(',').map(Number);
    const pixelId = `L${def.id}-p${x}-${y}`;
    const group = modifier.group ?? modifier.linkId;
    if (modifier.group !== undefined && modifier.linkId !== undefined && modifier.group !== modifier.linkId) {
      issues.push({ code: 'modifier/linked-group-conflict', severity: 'error',
        message: `Linked at (${x}, ${y}) has conflicting group and linkId values.` });
    }
    if (group !== undefined) members.set(group, [...(members.get(group) ?? []), pixelId]);
    const refs = modifier.linkedPixelIds;
    if (refs && new Set(refs).size !== refs.length) {
      issues.push({ code: 'modifier/linked-duplicate-reference', severity: 'error',
        message: `Linked at (${x}, ${y}) contains a duplicate member reference.` });
    }
  }
  for (const [key, modifier] of linked) {
    if (!modifier.linkedPixelIds) continue;
    const [x, y] = key.split(',').map(Number);
    const self = `L${def.id}-p${x}-${y}`;
    const group = modifier.group ?? modifier.linkId;
    const expected = (group === undefined ? [] : members.get(group) ?? []).filter((id) => id !== self).sort();
    const actual = [...new Set(modifier.linkedPixelIds)].sort();
    if (actual.length !== expected.length || actual.some((id, index) => id !== expected[index])) {
      issues.push({ code: 'modifier/linked-reference-mismatch', severity: 'error',
        message: `Linked at (${x}, ${y}) does not reference exactly its authored partner.` });
    }
  }
  return issues;
}

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
      if (!/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(group)) {
        err({
          code: 'modifier/linked-group-id',
          message: `Linked at ${at}: group id must start with a letter and use at most 32 letters, digits, "-", or "_".`,
          where,
        });
      }
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
    if (count !== 2) {
      const member = modifierEntries(level).find(
        (e) => e.modifier.kind === 'linked' && e.modifier.config.group === group,
      );
      issues.push({
        code: count < 2 ? 'modifier/linked-orphan' : 'modifier/linked-group-size',
        severity: 'error',
        message: `Link group "${group}" has ${count} member${count === 1 ? '' : 's'}; production groups require exactly 2.`,
        ...(member ? { where: { kind: 'modifier' as const, x: member.x, y: member.y } } : {}),
      });
    }
  }

  return issues;
}
