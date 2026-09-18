// One-off scan: are any two charges in the SAME level ever assigned the same id?
import { createGame } from '../src/game/engine/createGame';
import { LEVEL_DEFINITIONS } from '../src/game/levels/levels';

let dupes = 0;
for (const level of LEVEL_DEFINITIONS) {
  const state = createGame(level);
  const seen = new Map<string, string>();
  state.tunnels.forEach((tunnel, tIdx) => {
    tunnel.queue.forEach((charge, cIdx) => {
      const here = `t${tIdx}-c${cIdx} (${charge.color}:${charge.capacity})`;
      const prior = seen.get(charge.id);
      if (prior) {
        console.log(`[DUPLICATE] level ${level.id} "${level.title}" id=${charge.id}: ${prior} vs ${here}`);
        dupes++;
      }
      seen.set(charge.id, here);
    });
  });
}
console.log(dupes === 0 ? `No duplicate charge ids across ${LEVEL_DEFINITIONS.length} levels.` : `${dupes} duplicate(s) found.`);
