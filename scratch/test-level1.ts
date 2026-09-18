import { createGame } from '../src/game/engine/createGame';
import { resolveAction } from '../src/game/engine/resolveLaunch';
import { requireLevel } from '../src/game/levels/levels';

const level = requireLevel(1);
console.log('Level 1:');
console.log('holdingCapacity:', level.holdingCapacity);
console.log('tunnels:', level.tunnels.map((t, i) => ({ i, len: t.length, charges: t.map(c => `${c.color}:${c.capacity}`) })));

let state = createGame(level);
console.log('Game holdingCapacity:', state.holdingCapacity);

// Let's do moves on level 1
