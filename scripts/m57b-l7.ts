/**
 * L7 Active-capacity authoring probe.
 * Usage: npx tsx scripts/m57b-l7.ts
 */
import fs from 'fs';
import { legalActions, type GameAction } from '@/game/engine/actions';
import { createGame } from '@/game/engine/createGame';
import { resolveAction } from '@/game/engine/resolveLaunch';
import { findFirstWinningWitness } from '@/game/engine/solver';
import { evaluateRoundRobinSpam } from '@/game/studio/analysis/antiSpam';
import { parseAuthoredJSON } from '@/game/levels/authoring/loader';
import { validateLevelStructure } from '@/game/levels/authoring/validate';
import type { LevelDefinition } from '@/game/engine/types';

const { levels } = parseAuthoredJSON(fs.readFileSync('content/levels/world-01.json', 'utf8'), 'w');
const def = levels.find((l) => l.id === 7)!;

function play(def: LevelDefinition, picker: (state: ReturnType<typeof createGame>) => GameAction | null) {
  const moves: GameAction[] = [];
  let state = createGame(def);
  let peakH = 0;
  let peakA = 0;
  let relaunches = 0;
  for (let i = 0; i < 80 && state.status === 'playing'; i += 1) {
    const action = picker(state);
    if (!action) break;
    const o = resolveAction(state, action);
    if (!o.accepted) break;
    moves.push(action);
    if (action.kind === 'holding') relaunches += 1;
    peakH = Math.max(peakH, o.state.holding.length);
    peakA = Math.max(peakA, o.epochCharges?.length ?? 0);
    state = o.state;
  }
  return { outcome: state.status, len: moves.length, peakH, peakA, relaunches, moves };
}

function bestHit(state: ReturnType<typeof createGame>, includeJoin: boolean, joinCap = 99) {
  const active = state.epoch?.launches.length ?? 0;
  const legal = legalActions(state, { includeJoin }).filter((a) => {
    if (a.join === true && active >= joinCap) return false;
    return true;
  });
  if (legal.length === 0) return null;
  let best = legal[0]!;
  let bestHits = -1;
  for (const a of legal) {
    const o = resolveAction(state, a);
    if (!o.accepted) continue;
    const hits = o.pass?.encounters.length ?? 0;
    const join = a.join === true;
    if (hits > bestHits || (hits === bestHits && join && best.join !== true)) {
      best = a;
      bestHits = hits;
    }
  }
  return best;
}

function dump(label: string, r: ReturnType<typeof play>) {
  console.log(label, r.outcome, 'len', r.len, 'peakH', r.peakH, 'peakA', r.peakA, 'rel', r.relaunches);
  console.log(' ', r.moves.map((m) => `${m.kind[0]}:${m.id.replace('tunnel-', 't')}${m.join ? ':j' : ''}`).join(' '));
}

console.log('valid', validateLevelStructure(def).valid, 'tunnels', JSON.stringify(def.tunnels));

dump('settle', play(def, (s) => bestHit(s, false)));
dump('join5', play(def, (s) => bestHit(s, true, 5)));
dump('join4', play(def, (s) => bestHit(s, true, 4)));
dump('join3', play(def, (s) => bestHit(s, true, 3)));

const forced3 = play(def, (() => {
  let step = 0;
  return (s) => {
    if (step === 0) { step += 1; return { kind: 'tunnel' as const, id: 'tunnel-0' }; }
    if (step === 1) { step += 1; return { kind: 'tunnel' as const, id: 'tunnel-1', join: true }; }
    if (step === 2) { step += 1; return { kind: 'tunnel' as const, id: 'tunnel-2', join: true }; }
    return bestHit(s, true, 3);
  };
})());
dump('force T0+T1j+T2j then join3', forced3);

const spam = evaluateRoundRobinSpam(def);
console.log('RR', spam.outcome, 'steps', spam.steps, 'peakH', spam.peakHolding);

const first = findFirstWinningWitness(def, { nodeCap: 80_000, timeCapMs: 20_000 });
console.log('firstWin', first.solved, 'len', first.moves.length, 'nodes', first.nodes, 'timeCap', first.timeCapHit);
