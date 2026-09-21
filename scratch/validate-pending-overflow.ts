/**
 * ONE-OFF (not a routine test): campaign-wide validation of the provisional
 * Holding-overflow rule (a tray overflow is decided at the GateTerminal, not at
 * launch).
 *
 * Every level 1..100 is checked on four axes, and the HEAD engine — a git
 * worktree passed as argv[2] — supplies the before-picture so each difference
 * is attributable to the rule change and nothing else:
 *
 *   1. solver verdict      solvable / unsolvable, and the witness length
 *   2. witness replay      the winning line replayed through the real runtime
 *                          path the session uses (launch + Gate arrivals)
 *   3. structural          holding never exceeds capacity, no pending arrival
 *                          is ever stranded, no charge is in two places
 *   4. loss / deadlock     no reachable live state offers only no-op actions
 *
 *   npx tsx scratch/validate-pending-overflow.ts <path-to-head-worktree>
 */
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

import { legalActions } from '@/game/engine/actions';
import { createGame } from '@/game/engine/createGame';
import { applyActionWithArrivals, settleDueArrivals } from '@/game/engine/holdingArrival';
import { solve } from '@/game/engine/solver';
import { isProductiveAction } from '@/game/engine/winState';
import { LEVEL_DEFINITIONS } from '@/game/levels/levels';
import type { GameState, LevelDefinition } from '@/game/engine/types';

/**
 * The production search budget, so the sweep reaches a real verdict on every
 * level rather than a cap. Overridable for a quick pass; a cap hit is reported,
 * never hidden.
 */
const NODE_CAP = Number(process.env.NODE_CAP ?? 300_000);

interface Verdict { solved: boolean; length: number; capped: boolean; error?: string }
type Solver = (level: LevelDefinition, opts?: { nodeCap?: number; partialOnCap?: boolean }) => {
  solved: boolean; moves?: unknown[]; nodeCapHit?: boolean;
};

function verdict(fn: Solver, level: LevelDefinition): Verdict {
  try {
    const r = fn(level, { nodeCap: NODE_CAP, partialOnCap: true });
    return { solved: r.solved, length: Array.isArray(r.moves) ? r.moves.length : -1, capped: r.nodeCapHit === true };
  } catch (e) {
    return { solved: false, length: -1, capped: false, error: String(e).slice(0, 140) };
  }
}

/** Every structural invariant that must hold of a state the player can be in. */
function structural(level: LevelDefinition, s: GameState): string | null {
  if (s.holding.length > s.holdingCapacity) return `holding ${s.holding.length}/${s.holdingCapacity}`;
  const ids = [...s.holding.map((c) => c.id), ...s.pendingHolding.map((p) => p.charge.id)];
  if (new Set(ids).size !== ids.length) return `a charge is held and pending at once (${ids.join(',')})`;
  for (const p of s.pendingHolding) {
    if (p.grace < 0) return `pending ${p.charge.id} has stale grace ${p.grace}`;
    if (p.charge.capacity <= 0) return `pending ${p.charge.id} carries no capacity`;
  }
  if (s.status !== 'playing' && s.pendingHolding.length > 0) return `terminal (${s.status}) with ${s.pendingHolding.length} pending`;
  if (s.holding.length > level.holdingCapacity) return 'holding over the authored capacity';
  return null;
}

/** Replay a solver line through the same runtime path the session drives. */
function replay(level: LevelDefinition, moves: readonly unknown[]): { status: string; error?: string } {
  let s = createGame(level);
  for (const action of moves) {
    const out = applyActionWithArrivals(s, action as Parameters<typeof applyActionWithArrivals>[1]);
    if (!out.accepted) return { status: s.status, error: `runtime refused ${JSON.stringify(action)}` };
    s = out.state;
    const bad = structural(level, s);
    if (bad) return { status: s.status, error: bad };
  }
  // Nothing is left hanging: any pending arrival still in flight commits.
  let guard = 0;
  while (s.pendingHolding.length > 0 && guard++ < 8) s = settleDueArrivals(s);
  return { status: s.status };
}

/** Walk a bounded sample of reachable states looking for a live no-op-only state. */
function findEndlessLoop(level: LevelDefinition, budget = 400): string | null {
  const seen = new Set<string>();
  const stack = [createGame(level)];
  let checked = 0;
  while (stack.length && checked < budget) {
    const s = stack.pop()!;
    if (s.status !== 'playing') continue;
    const bad = structural(level, s);
    if (bad) return `structural: ${bad}`;
    const key = `${s.pixels.map((p) => (p.cleared ? '1' : '0')).join('')}|${s.tunnels.map((t) => t.queue.length).join(',')}`
      + `|${s.holding.map((c) => c.id).join(',')}|${s.pendingHolding.map((p) => `${p.charge.id}+${p.grace}`).join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    checked += 1;
    const actions = legalActions(s, { includeJoin: s.epoch !== null });
    // A pending arrival is itself pending progress: the position is alive even
    // if nothing productive can be launched this instant.
    if (actions.length > 0 && s.pendingHolding.length === 0 && !actions.some((a) => isProductiveAction(s, a))) {
      return `live state with only no-op actions after ${checked} states`;
    }
    for (const a of actions) {
      const out = applyActionWithArrivals(s, a);
      if (out.accepted && stack.length < 300) stack.push(out.state);
    }
  }
  return null;
}

async function main() {
  const headRoot = process.argv[2];
  if (!headRoot) throw new Error('pass the HEAD worktree path');
  const head = (await import(pathToFileURL(`${headRoot}/src/game/engine/solver.ts`).href)) as { solve: Solver };

  const levels = LEVEL_DEFINITIONS.filter((l) => l.id >= 1 && l.id <= 100);
  console.log(`Validating ${levels.length} levels (${levels[0]!.id}..${levels[levels.length - 1]!.id})\n`);

  const deltas: string[] = [];
  const failures: string[] = [];
  let bothSolved = 0, newlySolvable = 0, newlyUnsolvable = 0, lengthChanged = 0, capped = 0, replayed = 0;
  const started = performance.now();

  for (const level of levels) {
    const before = verdict(head.solve, level);
    const after = verdict(solve as unknown as Solver, level);
    if (before.capped || after.capped) capped += 1;
    if (before.error || after.error) deltas.push(`L${level.id}: error before=${before.error ?? '-'} after=${after.error ?? '-'}`);

    if (before.solved && after.solved) {
      bothSolved += 1;
      if (before.length !== after.length) { lengthChanged += 1; deltas.push(`L${level.id}: witness length ${before.length} -> ${after.length}`); }
    } else if (!before.solved && after.solved) { newlySolvable += 1; deltas.push(`L${level.id}: NEWLY SOLVABLE (${after.length} moves)`); }
    else if (before.solved && !after.solved) { newlyUnsolvable += 1; deltas.push(`L${level.id}: NEWLY UNSOLVABLE`); }

    if (after.solved) {
      const r = replay(level, solve(level, { nodeCap: NODE_CAP, partialOnCap: true }).moves);
      if (r.error) failures.push(`L${level.id}: replay ${r.error}`);
      else if (r.status !== 'won') failures.push(`L${level.id}: witness replayed to '${r.status}', not 'won'`);
      else replayed += 1;
    }

    const loop = findEndlessLoop(level);
    if (loop) failures.push(`L${level.id}: ${loop}`);
    process.stdout.write(`  L${level.id} ${after.solved ? 'solved' : after.capped ? 'capped' : 'unsolved'}\n`);
  }

  const secs = ((performance.now() - started) / 1000).toFixed(1);
  console.log(`\n=== CAMPAIGN VALIDATION 1-100 (${secs}s) ===`);
  console.log(`levels checked         : ${levels.length}`);
  console.log(`solvable before+after  : ${bothSolved}`);
  console.log(`newly solvable         : ${newlySolvable}`);
  console.log(`newly UNSOLVABLE       : ${newlyUnsolvable}`);
  console.log(`witness length changes : ${lengthChanged}`);
  console.log(`witnesses replayed won : ${replayed}`);
  console.log(`node-cap hits          : ${capped}`);
  console.log(`structural/loop faults : ${failures.length}`);
  if (deltas.length) { console.log('\n--- solver deltas ---'); for (const d of deltas) console.log('  ' + d); }
  if (failures.length) { console.log('\n--- FAULTS ---'); for (const f of failures) console.log('  ' + f); }
  if (!deltas.length && !failures.length) console.log('\nNo deltas, no faults.');
}

void main();
