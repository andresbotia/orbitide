import { requireLevel } from '../src/game/levels/levels';

for (let id = 1; id <= 6; id++) {
  const l = requireLevel(id);
  console.log(`=== LEVEL ${id} ===`);
  console.log('holdingCapacity:', l.holdingCapacity);
  console.log('ruleset:', l.ruleset);
  console.log('tunnels:');
  l.tunnels.forEach((t, i) => {
    console.log(`  tunnel-${i}: [${t.map(c => `${c.color}:${c.capacity}`).join(', ')}]`);
  });
}
