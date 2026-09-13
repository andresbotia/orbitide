import fs from 'fs';
import { parseAuthoredJSON } from '@/game/levels/authoring/loader';
import { createGame } from '@/game/engine/createGame';
import { resolveAction } from '@/game/engine/resolveLaunch';
import { solve } from '@/game/engine/solver';

const id = Number(process.argv[2] ?? 1);
const { levels } = parseAuthoredJSON(fs.readFileSync('content/levels/world-01.json', 'utf8'), 'w');
const def = levels.find((l) => l.id === id)!;
const r = solve(def, { mode: 'metrics', nodeCap: 80_000, partialOnCap: true });
console.log('solved', r.solved, 'len', r.length, 'peakH', r.peakHolding, 'held', r.heldLaunches, 'maxA', r.maxActiveOnWitness);
console.log(r.moves);
let s = createGame(def);
for (const m of r.moves) {
  const o = resolveAction(s, m);
  const cleared = o.state.pixels.filter((p) => p.cleared).length;
  console.log(
    JSON.stringify(m),
    'hits', o.pass?.encounters.length,
    'landed', o.heldCharge ? `hold:${o.heldCharge.capacity}` : 'consumed',
    'tray', o.state.holding.map((c) => `${c.color}:${c.capacity}`).join(',') || '-',
    'cleared', `${cleared}/${s.pixels.length}`,
    'status', o.state.status,
    'active', o.epochCharges?.length ?? 0,
  );
  s = o.state;
}
