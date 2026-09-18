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
    [{ color: 'blue', capacity: 1 }],
    [{ color: 'green', capacity: 1 }],
    [{ color: 'purple', capacity: 1 }],
    [{ color: 'gold', capacity: 1 }],
  ],
};

let state = createGame(testLevel);
const resA = resolveAction(state, { kind: 'tunnel', id: 'tunnel-0' });
state = resA.state;
const scriptA = buildLaunchScript(resA, createGame(testLevel), 1);

const resB = resolveAction(state, { kind: 'tunnel', id: 'tunnel-1' });
const prevStateB = state;
state = resB.state;
const scriptB = buildLaunchScript(resB, prevStateB, 2);

const resC = resolveAction(state, { kind: 'tunnel', id: 'tunnel-2' });
const prevStateC = state;
state = resC.state;
const scriptC = buildLaunchScript(resC, prevStateC, 3);

const resD = resolveAction(state, { kind: 'tunnel', id: 'tunnel-3' });
const prevStateD = state;
const scriptD = buildLaunchScript(resD, prevStateD, 4);

console.log('Script D:');
console.log('  endKind:', scriptD.pass.endKind);
console.log('  holdingSlotIndex:', scriptD.pass.holdingSlotIndex);
console.log('  holdingTarget:', scriptD.pass.holdingTarget);
console.log('  events:', scriptD.pass.events);
