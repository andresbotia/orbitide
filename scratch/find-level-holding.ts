import { requireLevel } from '../src/game/levels/levels';
import { createGame } from '../src/game/engine/createGame';
import { resolveAction } from '../src/game/engine/resolveLaunch';

for (let id = 1; id <= 30; id++) {
  try {
    const l = requireLevel(id);
    let s = createGame(l);
    let count = 0;
    for (let t = 0; t < l.tunnels.length; t++) {
      if (s.tunnels[t]?.queue.length) {
        const res = resolveAction(s, { kind: 'tunnel', id: `tunnel-${t}` });
        if (res.accepted) {
          s = res.state;
          if (res.heldCharge) count++;
        }
      }
    }
    if (s.holding.length >= 3) {
      console.log(`Level ${id} has ${s.holding.length} held!`);
    }
  } catch (e) {
    //
  }
}
