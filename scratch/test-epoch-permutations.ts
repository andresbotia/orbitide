import { createGame } from '../src/game/engine/createGame';
import { resolveAction } from '../src/game/engine/resolveLaunch';
import { LevelDefinition } from '../src/game/engine/types';

const testLevel: LevelDefinition = {
  id: 9999,
  title: 'Test',
  themeId: 'test',
  difficulty: 'easy',
  holdingCapacity: 3,
  ruleset: 'coreV2',
  pixelArt: ['WWW', 'WWW', 'WWW'],
  tunnels: [
    [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
    [{ color: 'green', capacity: 1 }, { color: 'green', capacity: 1 }],
    [{ color: 'purple', capacity: 1 }, { color: 'purple', capacity: 1 }],
    [{ color: 'gold', capacity: 1 }, { color: 'gold', capacity: 1 }],
  ],
};

// Let's test different join combinations:
// Combination 1: A (join: false), B (join: true), C (join: true), D (join: true)
console.log('=== Combo 1: All joined in 1 epoch ===');
let s = createGame(testLevel);
s = resolveAction(s, { kind: 'tunnel', id: 'tunnel-0' }).state;
console.log('After A:', s.holding.map(c=>c.id), 'status:', s.status);
s = resolveAction(s, { kind: 'tunnel', id: 'tunnel-1', join: true }).state;
console.log('After B:', s.holding.map(c=>c.id), 'status:', s.status);
s = resolveAction(s, { kind: 'tunnel', id: 'tunnel-2', join: true }).state;
console.log('After C:', s.holding.map(c=>c.id), 'status:', s.status);
s = resolveAction(s, { kind: 'tunnel', id: 'tunnel-3', join: true }).state;
console.log('After D:', s.holding.map(c=>c.id), 'status:', s.status);

// Combination 2: A (join: false), B (join: false), C (join: true), D (join: true)
console.log('\n=== Combo 2: A separate, B & C & D joined ===');
s = createGame(testLevel);
s = resolveAction(s, { kind: 'tunnel', id: 'tunnel-0' }).state;
s = resolveAction(s, { kind: 'tunnel', id: 'tunnel-1', join: false }).state;
s = resolveAction(s, { kind: 'tunnel', id: 'tunnel-2', join: true }).state;
console.log('After C:', s.holding.map(c=>c.id), 'status:', s.status);
s = resolveAction(s, { kind: 'tunnel', id: 'tunnel-3', join: true }).state;
console.log('After D:', s.holding.map(c=>c.id), 'status:', s.status);

// Combination 3: A, B, C separate, D joined (wantsJoin: true when epoch exists)
console.log('\n=== Combo 3: A, B, C separate, D joined to C ===');
s = createGame(testLevel);
s = resolveAction(s, { kind: 'tunnel', id: 'tunnel-0', join: false }).state;
s = resolveAction(s, { kind: 'tunnel', id: 'tunnel-1', join: false }).state;
s = resolveAction(s, { kind: 'tunnel', id: 'tunnel-2', join: false }).state;
console.log('After C:', s.holding.map(c=>c.id), 'status:', s.status);
s = resolveAction(s, { kind: 'tunnel', id: 'tunnel-3', join: true }).state;
console.log('After D:', s.holding.map(c=>c.id), 'status:', s.status);
