/**
 * ONE-OFF (not a routine test): semantic validation of the legacy campaign
 * after the approved held-relaunch rule change.
 *
 * Compares, per level, the solver verdict produced by the CURRENT engine against
 * the same verdict produced by the engine at HEAD (a git worktree passed as
 * argv[2]), so every difference is attributable to the rule change.
 *
 *   npx tsx scratch/validate-legacy-campaign.ts <path-to-head-worktree>
 */
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

import { LEVEL_DEFINITIONS } from '@/game/levels/levels';
import { solve } from '@/game/engine/solver';
import { createGame } from '@/game/engine/createGame';
import { legalActions } from '@/game/engine/actions';
import { resolveAction } from '@/game/engine/resolveLaunch';
import { isProductiveAction } from '@/game/engine/winState';
import type { LevelDefinition } from '@/game/engine/types';

interface Verdict {
  id: number;
  solved: boolean;
  winLength: number;
  nodes: number;
  capped: boolean;
  error?: string;
}

type Solver = (level: LevelDefinition, opts?: { nodeCap?: number; partialOnCap?: boolean }) => {
  solved: boolean; win?: unknown[] | null; nodes?: number; nodeCapHit?: boolean;
};

/** Bounded per level so the sweep finishes; a cap hit is reported, not hidden. */
const NODE_CAP = 12_000;

function verdict(fn: Solver, level: LevelDefinition): Verdict {
  try {
    const r = fn(level, { nodeCap: NODE_CAP, partialOnCap: true });
    return {
      id: level.id,
      solved: r.solved,
      winLength: Array.isArray(r.win) ? r.win.length : -1,
      nodes: r.nodes ?? -1,
      capped: r.nodeCapHit === true,
    };
  } catch (e) {
    return { id: level.id, solved: false, winLength: -1, nodes: -1, capped: false, error: String(e).slice(0, 120) };
  }
}

/** Walk a bounded sample of reachable states looking for a live no-op-only state. */
function findEndlessLoop(level: LevelDefinition, budget = 400): string | null {
  const seen = new Set<string>();
  const stack = [createGame(level)];
  let checked = 0;
  while (stack.length && checked < budget) {
    const s = stack.pop()!;
    if (s.status !== 'playing') continue;
    const key = `${s.pixels.map((p) => (p.cleared ? '1' : '0')).join('')}|${s.tunnels.map((t) => t.queue.length).join(',')}|${s.holding.map((c) => c.id).join(',')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    checked += 1;
    const actions = legalActions(s);
    if (actions.length > 0 && !actions.some((a) => isProductiveAction(s, a))) {
      return `live state with only no-op actions after ${checked} states`;
    }
    for (const a of actions) {
      const out = resolveAction(s, a);
      if (out.accepted && stack.length < 300) stack.push(out.state);
    }
  }
  return null;
}

async function main() {
  const headRoot = process.argv[2];
  if (!headRoot) throw new Error('pass the HEAD worktree path');
  const headSolver = (await import(pathToFileURL(`${headRoot}/src/game/engine/solver.ts`).href)) as { solve: Solver };

  const legacy = LEVEL_DEFINITIONS.filter((l) => l.id >= 11 && l.id <= 100);
  console.log(`Validating ${legacy.length} legacy levels (ids ${legacy[0]!.id}..${legacy[legacy.length - 1]!.id})\n`);

  const changed: string[] = [];
  const loops: string[] = [];
  let bothSolved = 0;
  let newlySolvable = 0;
  let newlyUnsolvable = 0;
  let cappedNow = 0;
  let winLenChanged = 0;
  const started = performance.now();

  for (const level of legacy) {
    const before = verdict(headSolver.solve, level);
    const after = verdict(solve as unknown as Solver, level);
    if (after.capped || before.capped) cappedNow += 1;
    if (before.solved && after.solved) {
      bothSolved += 1;
      if (before.winLength !== after.winLength) {
        winLenChanged += 1;
        changed.push(`L${level.id}: win length ${before.winLength} -> ${after.winLength}`);
      }
    } else if (!before.solved && after.solved) {
      newlySolvable += 1;
      changed.push(`L${level.id}: NEWLY SOLVABLE (win length ${after.winLength})`);
    } else if (before.solved && !after.solved) {
      newlyUnsolvable += 1;
      changed.push(`L${level.id}: NEWLY UNSOLVABLE${after.error ? ` (${after.error})` : ''}`);
    }
    if (after.error || before.error) changed.push(`L${level.id}: error before=${before.error ?? '-'} after=${after.error ?? '-'}`);
    const loop = findEndlessLoop(level);
    if (loop) loops.push(`L${level.id}: ${loop}`);
    console.log(`  L${level.id}: before=${before.solved ? 'solved' : before.capped ? 'capped' : 'unsolved'}`
      + ` after=${after.solved ? 'solved' : after.capped ? 'capped' : 'unsolved'}`
      + `${before.winLength !== after.winLength ? ` win ${before.winLength}->${after.winLength}` : ''}`);
  }

  const secs = ((performance.now() - started) / 1000).toFixed(1);
  console.log(`\n\n=== LEGACY CAMPAIGN VALIDATION (${secs}s) ===`);
  console.log(`levels checked        : ${legacy.length}`);
  console.log(`solvable before+after : ${bothSolved}`);
  console.log(`newly solvable        : ${newlySolvable}`);
  console.log(`newly UNSOLVABLE      : ${newlyUnsolvable}`);
  console.log(`win-length changes    : ${winLenChanged}`);
  console.log(`node-cap hits         : ${cappedNow}`);
  console.log(`endless no-op loops   : ${loops.length}`);
  if (changed.length) { console.log('\n--- differences ---'); for (const c of changed) console.log('  ' + c); }
  if (loops.length) { console.log('\n--- loops ---'); for (const l of loops) console.log('  ' + l); }
  if (!changed.length && !loops.length) console.log('\nNo semantic differences.');
}

void main();
