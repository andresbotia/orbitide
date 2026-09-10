import { DEFAULT_ART_LEGEND } from '../engine/art';
import type {
  LevelDefinition, LevelDifficulty, LevelReveal, OrbColor, PixelModifierMap,
} from '../engine/types';

export const M4C_LEGEND: Record<string, OrbColor> = {
  W: 'white', Y: 'yellow', A: 'gold', O: 'orange', R: 'red', D: 'coral',
  K: 'pink', M: 'magenta', P: 'purple', N: 'indigo', B: 'blue', C: 'cyan',
  T: 'teal', G: 'green', L: 'lime',
};

export interface M4CAuthoredLevel {
  id: number;
  title: string;
  themeId: 'skybound' | 'tidal-depths' | 'arcane-relics' | 'starforge';
  difficulty: LevelDifficulty;
  art: string[];
  queues: OrbColor[][];
  modifiers?: PixelModifierMap;
  tutorial?: string;
}

function revealFor(rows: string[], name: string, collectionId: string): LevelReveal {
  const occupied: { x: number; y: number }[] = [];
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (M4C_LEGEND[ch]) occupied.push({ x, y });
  }));
  const top = occupied.reduce((a, b) => b.y < a.y ? b : a);
  const right = occupied.reduce((a, b) => b.x > a.x ? b : a);
  const bottom = occupied.reduce((a, b) => b.y > a.y ? b : a);
  const left = occupied.reduce((a, b) => b.x < a.x ? b : a);
  const center = occupied[Math.floor(occupied.length / 2)]!;
  return {
    name: name.toUpperCase(), nodes: [top, right, bottom, left, center],
    lines: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [4, 2]],
    accentNodes: [4], collectionId,
  };
}

export function makeM4CLevel(a: M4CAuthoredLevel): LevelDefinition {
  const needs = new Map<OrbColor, number>();
  const symbols = new Set<string>();
  a.art.forEach((row) => [...row].forEach((ch) => {
    const color = M4C_LEGEND[ch];
    if (!color) return;
    symbols.add(ch);
    needs.set(color, (needs.get(color) ?? 0) + 1);
  }));
  for (const [key, modifier] of Object.entries(a.modifiers ?? {})) {
    if (modifier.kind !== 'frozen' && modifier.kind !== 'shielded') continue;
    const [x, y] = key.split(',').map(Number);
    const color = M4C_LEGEND[a.art[y!]?.[x!] ?? ''];
    if (color) needs.set(color, (needs.get(color) ?? 0) + Math.max(1, Math.trunc(modifier.level ?? 1)));
  }
  const seen = new Set<OrbColor>();
  const tunnels = a.queues.map((queue) => queue.map((color) => {
    if (seen.has(color)) throw new Error(`Level ${a.id}: duplicate charge color ${color}`);
    seen.add(color);
    const capacity = needs.get(color) ?? 0;
    if (capacity === 0) throw new Error(`Level ${a.id}: ${color} charge has no pixels`);
    return { color, capacity };
  }));
  if (tunnels.length !== 3 || tunnels.some((queue) => queue.length === 0)) {
    throw new Error(`Level ${a.id}: expected three non-empty tunnels`);
  }
  for (const color of needs.keys()) if (!seen.has(color)) throw new Error(`Level ${a.id}: missing ${color} charge`);
  const legend = Object.fromEntries([...symbols]
    .filter((symbol) => DEFAULT_ART_LEGEND[symbol] !== M4C_LEGEND[symbol])
    .map((symbol) => [symbol, M4C_LEGEND[symbol]!]));
  return {
    id: a.id, title: a.title, themeId: a.themeId, difficulty: a.difficulty,
    holdingCapacity: 3, pixelArt: a.art, tunnels,
    ...(Object.keys(legend).length > 0 ? { legend } : {}),
    ...(a.modifiers ? { modifiers: a.modifiers } : {}),
    ...(a.tutorial ? { tutorial: a.tutorial } : {}),
    reveal: revealFor(a.art, a.title, a.themeId),
  };
}

export const frozen = (coords: string[]): PixelModifierMap => Object.fromEntries(
  coords.map((key) => [key, { kind: 'frozen' as const, level: 1 }]),
);
export const shielded = (coords: string[]): PixelModifierMap => Object.fromEntries(
  coords.map((key) => [key, { kind: 'shielded' as const, level: 1 }]),
);
export const linked = (pairs: [string, string][]): PixelModifierMap => Object.fromEntries(
  pairs.flatMap(([a, b], index) => [[a, { kind: 'linked' as const, group: `link-${index + 1}` }],
    [b, { kind: 'linked' as const, group: `link-${index + 1}` }]]),
);

export function combineModifiers(...maps: PixelModifierMap[]): PixelModifierMap {
  const combined: PixelModifierMap = {};
  for (const map of maps) {
    for (const [key, modifier] of Object.entries(map)) {
      if (combined[key]) throw new Error(`Modifier stacking is forbidden at ${key}`);
      combined[key] = modifier;
    }
  }
  return combined;
}
