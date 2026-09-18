import { createGame } from '../src/game/engine/createGame';
import { resolveAction } from '../src/game/engine/resolveLaunch';
import { buildLaunchScript } from '../src/game/presentation/buildScript';
import { reserveHoldingSlot } from '../src/game/presentation/holdingSlot';
import { LevelDefinition, Charge, GameState } from '../src/game/engine/types';

const testLevel: LevelDefinition = {
  id: 9999,
  title: 'Test',
  themeId: 'test',
  difficulty: 'easy',
  holdingCapacity: 3,
  ruleset: 'coreV2',
  pixelArt: [
    'WWW',
    'WWW',
    'WWW',
  ],
  tunnels: [
    // White pixel targets, but tunnels have blue, green, purple, gold (none match white!)
    [{ color: 'blue', capacity: 1 }, { color: 'blue', capacity: 1 }],
    [{ color: 'green', capacity: 1 }, { color: 'green', capacity: 1 }],
    [{ color: 'purple', capacity: 1 }, { color: 'purple', capacity: 1 }],
    [{ color: 'gold', capacity: 1 }, { color: 'gold', capacity: 1 }],
  ],
};

console.log('--- Sequential Test ---');
let state = createGame(testLevel);
const resA = resolveAction(state, { kind: 'tunnel', id: 'tunnel-0' });
state = resA.state;
console.log('After A:', state.holding.map(c => c.id), 'status:', state.status);

const resB = resolveAction(state, { kind: 'tunnel', id: 'tunnel-1' });
state = resB.state;
console.log('After B:', state.holding.map(c => c.id), 'status:', state.status);

const resC = resolveAction(state, { kind: 'tunnel', id: 'tunnel-2' });
state = resC.state;
console.log('After C:', state.holding.map(c => c.id), 'status:', state.status);

// Now launch D
const resD = resolveAction(state, { kind: 'tunnel', id: 'tunnel-3' });
console.log('After D:');
console.log('  status:', resD.state.status);
console.log('  holding:', resD.state.holding.map(c => c.id));
console.log('  heldCharge:', resD.heldCharge);
