import { requireLevel } from '../src/game/levels/levels';

for (let id = 1; id <= 10; id++) {
  try {
    const l = requireLevel(id);
    const totalCharges = l.tunnels.reduce((acc, t) => acc + t.length, 0);
    console.log(`Level ${id}: ruleset=${l.ruleset}, holdingCap=${l.holdingCapacity}, totalCharges=${totalCharges}, tunnels=${l.tunnels.map(t=>t.length).join(',')}`);
  } catch (e) {
    break;
  }
}
