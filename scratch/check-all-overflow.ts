import { requireLevel } from '../src/game/levels/levels';
import { createGame } from '../src/game/engine/createGame';
import { resolveAction } from '../src/game/engine/resolveLaunch';

console.log('Checking all levels 1-20 for holding overflow behavior...');

for (let id = 1; id <= 20; id++) {
  const level = requireLevel(id);
  let s = createGame(level);
  
  // Let's launch from tunnels until holding has 3 items
  let moves = 0;
  while (s.holding.length < 3 && moves < 20 && s.status === 'playing') {
    // Find a tunnel with charges
    const tIdx = s.tunnels.findIndex(t => t.queue.length > 0);
    if (tIdx < 0) break;
    const res = resolveAction(s, { kind: 'tunnel', id: `tunnel-${tIdx}` });
    if (!res.accepted) break;
    s = res.state;
    moves++;
  }
  
  if (s.holding.length === 3 && s.status === 'playing') {
    console.log(`Level ${id}: Holding reached 3/3! Holding:`, s.holding.map(c=>c.id));
    // Now launch a 4th charge that lands in holding
    const tIdx = s.tunnels.findIndex(t => t.queue.length > 0);
    if (tIdx >= 0) {
      const res = resolveAction(s, { kind: 'tunnel', id: `tunnel-${tIdx}` });
      console.log(`  Next launch from tunnel-${tIdx}: accepted=${res.accepted}, status=${res.state.status}`);
      console.log(`  Holding after:`, res.state.holding.map(c=>c.id));
      console.log(`  HeldCharge:`, res.heldCharge?.id);
    } else {
      console.log(`  No more tunnel charges on Level ${id}`);
    }
  }
}
