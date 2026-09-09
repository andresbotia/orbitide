/**
 * The engine attaches authored presentation modifiers to pixels by cell, but
 * never reads them for a rule. Levels without a `modifiers` field are byte-for-
 * byte unchanged.
 */
import { attachModifiers, cloneModifierInstance } from '../art';
import { createGame } from '../createGame';
import { legalActions } from '../actions';
import { resolveAction } from '../resolveLaunch';
import { LEVEL_DEFINITIONS } from '../../levels/levelDefinitions';
import type { LevelDefinition } from '../types';

const BASE: LevelDefinition = {
  id: 9600, title: 'Modifier Attach', themeId: 'fixture', difficulty: 'easy', holdingCapacity: 3,
  pixelArt: ['WWW', 'W.W', 'WWW'],
  tunnels: [[{ color: 'white', capacity: 8 }], [], []],
};

test('attachModifiers copies by "x,y" onto the matching pixel and is pure', () => {
  const g = createGame(BASE);
  const attached = attachModifiers(g.pixels, { '0,0': { kind: 'frozen', level: 2 }, '2,2': { kind: 'wild' } });
  expect(attached).not.toBe(g.pixels);
  expect(attached.find((p) => p.x === 0 && p.y === 0)?.modifier).toEqual({ kind: 'frozen', level: 2 });
  expect(attached.find((p) => p.x === 2 && p.y === 2)?.modifier).toEqual({ kind: 'wild' });
  expect(attached.find((p) => p.x === 2 && p.y === 0)?.modifier).toBeUndefined();
});

test('createGame surfaces authored modifiers on the state pixels', () => {
  const g = createGame({ ...BASE, modifiers: { '1,0': { kind: 'shielded', level: 1 } } });
  expect(g.pixels.find((p) => p.x === 1 && p.y === 0)?.modifier).toEqual({ kind: 'shielded', level: 1 });
});

test('a modifier changes no gameplay rule — same actions, same outcome', () => {
  const plain = createGame(BASE);
  const special = createGame({ ...BASE, modifiers: { '0,0': { kind: 'armored', level: 3 }, '1,1': { kind: 'bomb' } } });
  expect(legalActions(special)).toEqual(legalActions(plain));

  const action = legalActions(special)[0]!;
  const a = resolveAction(plain, action);
  const b = resolveAction(special, action);
  expect(b.accepted).toBe(a.accepted);
  expect(b.state.pixels.map((p) => p.cleared)).toEqual(a.state.pixels.map((p) => p.cleared));
  expect(b.state.status).toBe(a.state.status);
});

test('no `modifiers` field ⇒ createGame is deep-equal to before (Levels 1–10)', () => {
  for (const def of LEVEL_DEFINITIONS) {
    expect(def.modifiers).toBeUndefined();
    const g = createGame(def);
    expect(g.pixels.every((p) => p.modifier === undefined)).toBe(true);
  }
});

test('cloneModifierInstance is a deep copy with deterministic key set', () => {
  const src = { kind: 'linked' as const, group: 'g1', linkId: 'g1', linkedPixelIds: ['a', 'b'], seed: 7 };
  const copy = cloneModifierInstance(src);
  expect(copy).toEqual(src);
  expect(copy.linkedPixelIds).not.toBe(src.linkedPixelIds);
});
