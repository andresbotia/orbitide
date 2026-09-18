import { createGame } from '../src/game/engine/createGame';
import { resolveAction } from '../src/game/engine/resolveLaunch';
import { buildLaunchScript } from '../src/game/presentation/buildScript';
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

console.log('Testing current behavior before changes...');
let s = createGame(testLevel);
s = resolveAction(s, { kind: 'tunnel', id: 'tunnel-0' }).state; // A
s = resolveAction(s, { kind: 'tunnel', id: 'tunnel-1' }).state; // B
s = resolveAction(s, { kind: 'tunnel', id: 'tunnel-2' }).state; // C

console.log('Holding before D:', s.holding.map(c => c.id));
const outD = resolveAction(s, { kind: 'tunnel', id: 'tunnel-3' }); // D
console.log('Outcome status:', outD.state.status);
console.log('Outcome holding:', outD.state.holding.map(c => c.id));
console.log('Outcome heldCharge:', outD.heldCharge?.id);

const scriptD = buildLaunchScript(outD, s, 4);
console.log('Script D endKind:', scriptD.pass.terminal.kind);
console.log('Script D events:', scriptD.pass.events.map(e => e.kind));
