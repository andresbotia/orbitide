/**
 * M5.7B authoring probe — inspects Core V2 geometry, tutorial fit, solvability.
 * Usage: npx tsx scripts/m57b-probe.ts [--level N]
 */
import { createGame } from '@/game/engine/createGame';
import { resolveAction, resolveLaunch } from '@/game/engine/resolveLaunch';
import { resolveHoldingLaunch } from '@/game/engine/resolveHolding';
import { legalActions } from '@/game/engine/actions';
import { solve, findFirstWinningWitness } from '@/game/engine/solver';
import {
  listAttackBins,
  occupiedPixelsAlongBin,
} from '@/game/engine/directionalTargeting';
import { inspectCoreLevel1TutorialFit, pickIntendedTutorialLaunch } from '@/game/tutorial/coreLevel1';
import { evaluateRoundRobinSpam } from '@/game/studio/analysis/antiSpam';
import { boardMetrics } from '@/game/studio/analysis/boardMetrics';
import { directionalGeometry } from '@/game/studio/analysis/directionalGeometry';
import { choiceMetricsFromStats } from '@/game/studio/analysis/choiceMetrics';
import { queueMetrics } from '@/game/studio/analysis/queueMetrics';
import { validateLevelStructure } from '@/game/levels/authoring/validate';
import { parseAuthoredJSON } from '@/game/levels/authoring/loader';
import fs from 'fs';
import path from 'path';
import type { LevelDefinition, OrbColor } from '@/game/engine/types';

const file = path.resolve(process.cwd(), 'content/levels/world-01.json');
const raw = fs.readFileSync(file, 'utf-8');
const { levels, errors } = parseAuthoredJSON(raw, 'world-01.json');
if (errors.length) {
  console.error(errors);
  process.exit(1);
}

const arg = process.argv.find((a) => a.startsWith('--level='));
const only = arg ? Number(arg.split('=')[1]) : (process.argv.includes('--level')
  ? Number(process.argv[process.argv.indexOf('--level') + 1])
  : undefined);
const geoOnly = process.argv.includes('--geo');
const firstWinOnly = process.argv.includes('--firstwin');
const noDfs = process.argv.includes('--nodfs');

function greedyMaxHits(def: LevelDefinition, includeJoin = true) {
  const moves: { kind: 'tunnel' | 'holding'; id: string; join?: boolean }[] = [];
  let state = createGame(def);
  let steps = 0;
  let peakHolding = 0;
  let maxActive = 0;
  let relaunches = 0;
  while (steps < 80 && state.status === 'playing') {
    const legal = legalActions(state, { includeJoin });
    if (legal.length === 0) break;
    let best = legal[0]!;
    let bestHits = -1;
    let bestJoin = false;
    for (const a of legal) {
      const o = resolveAction(state, a);
      if (!o.accepted) continue;
      const hits = o.pass?.encounters.length ?? 0;
      const join = a.join === true;
      if (hits > bestHits || (hits === bestHits && join && !bestJoin)) {
        best = a;
        bestHits = hits;
        bestJoin = join;
      }
    }
    const o = resolveAction(state, best);
    if (!o.accepted) break;
    moves.push(best);
    steps += 1;
    if (best.kind === 'holding') relaunches += 1;
    peakHolding = Math.max(peakHolding, o.state.holding.length);
    maxActive = Math.max(maxActive, o.epochCharges?.length ?? 0);
    state = o.state;
  }
  return {
    outcome: state.status === 'won' ? 'won' : state.status === 'lost' ? 'lost' : 'stuck',
    steps,
    peakHolding,
    maxActive,
    relaunches,
    moves,
  };
}

function hist(def: LevelDefinition) {
  const state = createGame(def);
  const counts = new Map<OrbColor, number>();
  for (const p of state.pixels) counts.set(p.color, (counts.get(p.color) ?? 0) + 1);
  return { state, counts };
}

function firstVisibleByColor(def: LevelDefinition) {
  const state = createGame(def);
  const front = new Map<OrbColor, number>();
  const buried = new Map<string, number>();
  const seenFront = new Set<string>();
  for (const bin of listAttackBins(state.width, state.height)) {
    const along = occupiedPixelsAlongBin(state, bin);
    if (along[0] && !seenFront.has(along[0].id)) {
      seenFront.add(along[0].id);
      front.set(along[0].color, (front.get(along[0].color) ?? 0) + 1);
    }
    along.forEach((p, depth) => {
      if (depth === 0) return;
      const key = `${p.color}@${depth}`;
      buried.set(key, (buried.get(key) ?? 0) + 1);
    });
  }
  return { front, buriedMin: buried };
}

function dumpLevel(def: LevelDefinition) {
  console.log('\n========', def.id, def.title, '========');
  const struct = validateLevelStructure(def);
  console.log('valid', struct.valid, struct.diagnostics.map((d) => `${d.severity}:${d.code}`).join(', ') || 'ok');
  const { state, counts } = hist(def);
  console.log('size', state.width, 'x', state.height, 'pixels', state.pixels.length);
  console.log('colors', Object.fromEntries([...counts.entries()].sort()));
  const geo = directionalGeometry(state);
  console.log('geo', geo);
  console.log('board', boardMetrics(def));
  console.log('queues', queueMetrics(def));
  const vis = firstVisibleByColor(def);
  console.log('firstVisible', Object.fromEntries([...vis.front.entries()].sort()));

  if (def.id === 1) {
    const fit = inspectCoreLevel1TutorialFit(def);
    console.log('tutorialFit', fit);
    const intended = pickIntendedTutorialLaunch(def);
    if (intended) {
      const out = resolveLaunch(createGame(def), intended.tunnelId);
      console.log('first gold pass hits', out.pass?.encounters.length, 'held', out.heldCharge?.capacity, 'status', out.state.status);
      const golds = state.pixels.filter((p) => p.color === 'gold');
      console.log('gold cells', golds.map((p) => `${p.x},${p.y} clearedAfter=${out.state.pixels.find((q) => q.id === p.id)?.cleared}`));
      if (out.heldCharge) {
        const re = resolveHoldingLaunch(out.state, out.heldCharge.id);
        console.log('relaunch hits', re.pass?.encounters.length, 'held', re.heldCharge?.capacity, 'status', re.state.status);
        console.log('golds after relaunch', re.state.pixels.filter((p) => p.color === 'gold').map((p) => `${p.x},${p.y}:${p.cleared}`));
      }
    }
  }

  if (geoOnly) return;

  const spam = evaluateRoundRobinSpam(def);
  console.log('antiSpam', spam);

  const prefixArg = process.argv.find((a) => a.startsWith('--prefix='));
  const prefix = prefixArg
    ? prefixArg.split('=')[1]!.split(',').map((tok) => {
      const [kind, id] = tok.split(':');
      return { kind: (kind === 'h' ? 'holding' : 'tunnel') as 'tunnel' | 'holding', id: kind === 'h' ? id! : `tunnel-${id}` };
    })
    : [];
  if (prefix.length) {
    let s = createGame(def);
    for (const a of prefix) {
      const o = resolveAction(s, a);
      console.log('prefix', a, 'ok', o.accepted, 'hits', o.pass?.encounters.length, 'status', o.state.status);
      s = o.state;
    }
  }

  const greedy = greedyMaxHits(def, true);
  const greedySeq = greedyMaxHits(def, false);
  console.log('greedy', greedy.outcome, 'len', greedy.steps, 'peakH', greedy.peakHolding, 'peakA', greedy.maxActive, 'relaunches', greedy.relaunches);
  if (greedy.outcome === 'won') {
    console.log('greedyWitness', greedy.moves.map((m) => `${m.kind}:${m.id}${m.join ? ':join' : ''}`).join(' '));
  }
  console.log('greedySeq', greedySeq.outcome, 'len', greedySeq.steps, 'peakH', greedySeq.peakHolding, 'peakA', greedySeq.maxActive, 'relaunches', greedySeq.relaunches);
  if (greedySeq.outcome === 'won') {
    console.log('greedySeqWitness', greedySeq.moves.map((m) => `${m.kind}:${m.id}`).join(' '));
  }

  if (noDfs) return;

  const t0 = Date.now();
  try {
    const first = findFirstWinningWitness(def, { nodeCap: 200_000, timeCapMs: 60_000 });
    console.log('firstWin', { solved: first.solved, len: first.moves.length, nodes: first.nodes, nodeCap: first.nodeCapHit, timeCap: first.timeCapHit, ms: Date.now() - t0 });
    if (first.solved) {
      console.log('witness', first.moves.map((m) => `${m.kind}:${m.id}${m.join ? ':join' : ''}`).join(' '));
      let s = createGame(def);
      let peakH = 0;
      let peakA = 0;
      let holds = 0;
      for (const m of first.moves) {
        const o = resolveAction(s, m);
        peakH = Math.max(peakH, o.state.holding.length);
        peakA = Math.max(peakA, o.epochCharges?.length ?? 0);
        if (m.kind === 'holding') holds += 1;
        s = o.state;
      }
      console.log('firstWin replay', s.status, 'peakH', peakH, 'peakA', peakA, 'relaunches', holds);
    }
  } catch (e) {
    console.log('firstWin error', (e as Error).message);
  }

  if (firstWinOnly || noDfs) return;

  const t1 = Date.now();
  const mode = process.argv.includes('--seq') ? 'sequential-compat' as const : 'metrics' as const;
  try {
    const r = solve(def, { mode, nodeCap: 250_000, partialOnCap: true });
    console.log('solve', {
      solved: r.solved, complete: r.complete, nodeCapHit: r.nodeCapHit,
      len: r.length, peakH: r.peakHolding, minPeak: r.minWinningPeak,
      maxA: r.maxActiveOnWitness, held: r.heldLaunches,
      viable: `${r.viableFirstMoves}/${r.totalFirstMoves}`,
      nodes: r.nodes, loss: r.lossProbability.toFixed(3),
      ms: Date.now() - t1,
    });
    if (r.solved) {
      console.log('best', r.moves.map((m) => `${m.kind}:${m.id}${m.join ? ':join' : ''}`).join(' '));
      const c = choiceMetricsFromStats(r.decisionStats);
      console.log('choice', c);
      console.log('firstMoves', r.firstMoves.map((m) => ({
        a: `${m.action.kind}:${m.action.id}`,
        ok: m.solvable, rest: m.winLength, peak: m.peakHoldingOnLine, A: m.maxActiveOnLine,
        held: m.heldRelaunchesOnLine, loss: Number(m.lossAfter.toFixed(3)),
      })));
    }
  } catch (e) {
    console.log('solve error', (e as Error).message, 'ms', Date.now() - t1);
  }

  const legal0 = legalActions(createGame(def));
  console.log('opening legal', legal0);
}

const selected = only ? levels.filter((l) => l.id === only) : levels;
for (const def of selected) dumpLevel(def);
