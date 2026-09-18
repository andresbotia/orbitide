import { requireLevel } from '../src/game/levels/levels';
import { createGame } from '../src/game/engine/createGame';
import { resolveAction } from '../src/game/engine/resolveLaunch';

const l = requireLevel(9);
let s = createGame(l);
console.log('Level 9 holdingCapacity:', s.holdingCapacity);
console.log('Level 9 tunnels:', l.tunnels.map((t, i) => `t${i}: ${t.map(c=>`${c.color}:${c.capacity}`).join(',')}`));

for (let step = 0; step < 6; step++) {
  // Find a tunnel with charges
  const tIdx = s.tunnels.findIndex(t => t.queue.length > 0);
  if (tIdx < 0) break;
  const tunnelId = `tunnel-${tIdx}`;
  const res = resolveAction(s, { kind: 'tunnel', id: tunnelId });
  s = res.state;
  console.log(`Step ${step + 1} (${tunnelId}): status=${s.status}, heldCharge=${res.heldCharge ? `${res.heldCharge.id}:${res.heldCharge.color}` : 'null'}`);
  console.log('  holding:', s.holding.map(c => `${c.id}:${c.color}`));
}
