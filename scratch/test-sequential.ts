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
    [{ color: 'blue', capacity: 1 }, { color: 'red', capacity: 1 }],
    [{ color: 'green', capacity: 1 }],
    [{ color: 'purple', capacity: 1 }],
    [{ color: 'gold', capacity: 1 }],
  ],
};

let s = createGame(testLevel);
console.log('Initial:', s.status, 'holding:', s.holding.length);
s = resolveAction(s, { kind: 'tunnel', id: 'tunnel-0' }).state;
console.log('After A:', s.status, 'holding:', s.holding.map(c=>c.id));
s = resolveAction(s, { kind: 'tunnel', id: 'tunnel-1' }).state;
console.log('After B:', s.status, 'holding:', s.holding.map(c=>c.id));
s = resolveAction(s, { kind: 'tunnel', id: 'tunnel-2' }).state;
console.log('After C:', s.status, 'holding:', s.holding.map(c=>c.id));
const outD = resolveAction(s, { kind: 'tunnel', id: 'tunnel-3' });
console.log('After D accepted:', outD.accepted, 'status:', outD.state.status, 'holding:', outD.state.holding.map(c=>c.id));
console.log('outD heldCharge:', outD.heldCharge?.id);
console.log('outD state holdingCapacity:', outD.state.holdingCapacity);
