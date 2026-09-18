import { requireLevel } from '../src/game/levels/levels';
import { createGame } from '../src/game/engine/createGame';
import { resolveAction } from '../src/game/engine/resolveLaunch';

const l = requireLevel(6);
let state = createGame(l);
console.log('holdingCapacity:', state.holdingCapacity);

console.log('\n--- Launch 1 (tunnel-0: blue) ---');
let res = resolveAction(state, { kind: 'tunnel', id: 'tunnel-0' });
state = res.state;
console.log('status:', state.status, 'holding:', state.holding.map(c => `${c.id}:${c.color}:${c.capacity}`));

console.log('\n--- Launch 2 (tunnel-1: purple) ---');
res = resolveAction(state, { kind: 'tunnel', id: 'tunnel-1' });
state = res.state;
console.log('status:', state.status, 'holding:', state.holding.map(c => `${c.id}:${c.color}:${c.capacity}`));

console.log('\n--- Launch 3 (tunnel-2: red) ---');
res = resolveAction(state, { kind: 'tunnel', id: 'tunnel-2' });
state = res.state;
console.log('status:', state.status, 'holding:', state.holding.map(c => `${c.id}:${c.color}:${c.capacity}`));

console.log('\n--- Launch 4 (tunnel-3: red) ---');
res = resolveAction(state, { kind: 'tunnel', id: 'tunnel-3' });
state = res.state;
console.log('status:', state.status, 'holding:', state.holding.map(c => `${c.id}:${c.color}:${c.capacity}`));
console.log('heldCharge:', res.heldCharge);
