import { createGame } from '../src/game/engine/createGame';
import { resolveAction } from '../src/game/engine/resolveLaunch';
import { requireLevel } from '../src/game/levels/levels';

const level = requireLevel(1);
console.log('Level 1:', {
  id: level.id,
  ruleset: level.ruleset,
  holdingCapacity: level.holdingCapacity,
  tunnels: level.tunnels.map((t, i) => ({ i, q: t.map(c => `${c.color}:${c.capacity}`) })),
});

let state = createGame(level);
console.log('Initial state holdingCapacity:', state.holdingCapacity);
console.log('Initial state holding:', state.holding);

// Let's inspect what moves are available
console.log('Initial tunnels:', state.tunnels.map(t => ({ id: t.id, queue: t.queue.map(c => `${c.id}:${c.color}`) })));
