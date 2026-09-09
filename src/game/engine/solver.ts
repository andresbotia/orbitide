/**
 * Production-neutral level solver / analyzer.
 *
 * This is the ONE solver. It drives the real engine (`createGame`,
 * `resolveAction`, `legalActions`) over an exhaustive, memoized action graph —
 * it never re-implements a game rule. It is pure TypeScript with no React /
 * React Native imports, so it runs headless in the test suite and in the
 * dev-only web Level Studio alike.
 *
 * (Historically this lived in `engine/__tests__/solver.ts`; that path now
 * re-exports this module so existing test imports keep working.)
 */
import { legalActions, type GameAction } from './actions';
import { createGame } from './createGame';
import { epochResidueKey } from './epoch';
import { boardFingerprint } from './frozen';
import { resolveAction } from './resolveLaunch';
import type { GameState, LevelDefinition } from './types';

export function stateKey(s: GameState): string {
  const committed = boardFingerprint(s.pixels) + '/' +
    s.tunnels.map((t) => t.queue.map((c) => `${c.id}:${c.capacity}`).join(',')).join('|') + '/' +
    s.holding.map((c) => `${c.id}:${c.color}:${c.capacity}`).join(',');
  // An open epoch changes how the next launch arbitrates, so equivalent boards
  // with different epoch residue must not memoize together.
  return s.epoch ? `${committed}##${epochResidueKey(s.epoch)}` : committed;
}

export type SolveMode = 'solvability' | 'metrics' | 'sequential-compat';

/**
 * Every action the player could take from `state`. A plain launch waits for the
 * board to settle (fresh epoch, M1 semantics); when an epoch is still running a
 * launchable charge also gets a `join: true` variant that enters that epoch and
 * arbitrates against the charges already on the rail. The settle-first branch is
 * listed first so a witness prefers the calmer line at equal length.
 * `sequential-compat` drops the join variants entirely, reproducing M1.
 *
 * Held charges only ever appear here as an explicit `{ kind: 'holding' }`
 * action — the solver never implicitly relaunches Holding.
 *
 * This delegates entirely to {@link legalActions}: the same candidate generator
 * and the same `actionRejection` filter the runtime uses. A `join: true` variant
 * is therefore emitted only when `resolveAction` would actually accept it (fixed
 * an M4A mismatch where a full-Holding join could be enumerated-but-rejected, or
 * accepted-but-not-enumerated).
 */
export function enumerateActions(state: GameState, mode: SolveMode): GameAction[] {
  return legalActions(state, { includeJoin: mode !== 'sequential-compat' });
}

/** Per-first-move breakdown, computed from the (already-visited) child subtrees. */
export interface FirstMoveStat {
  action: GameAction;
  solvable: boolean;
  /** Shortest remaining win length after this move (0 if this move itself wins). */
  winLength: number;
  /** Minimum achievable peak Holding on any winning continuation (`-1` if unsolvable). */
  minPeakHolding: number;
  /** Loss probability of the whole subtree after this move under uniform play. */
  lossAfter: number;
  /** Peak Holding actually observed replaying the shortest continuation. */
  peakHoldingOnLine: number;
  /** Explicit held-charge relaunches on that continuation. */
  heldRelaunchesOnLine: number;
  /** Peak concurrent active charges on that continuation. */
  maxActiveOnLine: number;
}

export interface SolveResult {
  solved: boolean;
  /** `false` only when the search was truncated by `nodeCap`. */
  complete: boolean;
  /** `true` when `nodeCap` was reached (and `partialOnCap` salvaged the run). */
  nodeCapHit: boolean;
  moves: GameAction[]; length: number;
  peakHolding: number; minWinningPeak: number; maxHolding: number;
  viableFirstMoves: number; totalFirstMoves: number; nodes: number;
  /** Mean number of actions considered per explored (non-terminal, non-cached) node. */
  avgBranching: number;
  failPath: GameAction[] | null;
  lossProbability: number; heldLaunches: number;
  /** Peak charges sharing the rail on the shortest winning witness. */
  maxActiveOnWitness: number;
  /** Peak charges sharing the rail anywhere in the explored graph. */
  maxActive: number;
  firstMoves: FirstMoveStat[];
}
interface Node { win: GameAction[] | null; fail: GameAction[] | null; minPeak: number; loss: number }

/** Thrown by {@link solve} when `opts.signal.cancelled` flips to `true`. */
export class SolverCancelled extends Error {
  constructor() {
    super('Solve cancelled');
    this.name = 'SolverCancelled';
  }
}

/** Thrown when the `nodeCap` is exceeded (unless `opts.partialOnCap` is set). */
export class NodeCapExceeded extends Error {
  constructor(levelId: number, cap: number) {
    super(`Level ${levelId} solver exceeded ${cap} states`);
    this.name = 'NodeCapExceeded';
  }
}

export interface SolveOptions {
  nodeCap?: number;
  mode?: SolveMode;
  /** Cooperative cancellation — flip `cancelled` to abort with {@link SolverCancelled}. */
  signal?: { cancelled: boolean };
  /**
   * When the `nodeCap` is hit, salvage counters + whatever the search found
   * instead of throwing {@link NodeCapExceeded}. The result has
   * `complete === false` and `nodeCapHit === true`; `solved` may be a
   * false negative (never a false positive).
   */
  partialOnCap?: boolean;
}

function replayLine(from: GameState, line: GameAction[]): {
  peakHolding: number; heldRelaunches: number; maxActive: number;
} {
  let peak = from.holding.length;
  let held = 0;
  let active = 0;
  let state = from;
  for (const action of line) {
    const outcome = resolveAction(state, action);
    active = Math.max(active, outcome.epochCharges?.length ?? 0);
    if (action.kind === 'holding') held += 1;
    state = outcome.state;
    peak = Math.max(peak, state.holding.length);
  }
  return { peakHolding: peak, heldRelaunches: held, maxActive: active };
}

export function solve(level: LevelDefinition, opts: SolveOptions = {}): SolveResult {
  const { nodeCap = 300_000, mode = 'metrics', signal, partialOnCap = false } = opts;
  const memo = new Map<string, Node>();
  let nodes = 0;
  let branchSum = 0;
  let maxHolding = 0;
  let maxActive = 0;

  function visit(state: GameState): Node {
    if (signal?.cancelled) throw new SolverCancelled();
    maxHolding = Math.max(maxHolding, state.holding.length);
    maxActive = Math.max(maxActive, state.epoch?.launches.length ?? 0);
    if (state.status === 'won') return { win: [], fail: null, minPeak: state.holding.length, loss: 0 };
    if (state.status === 'lost') return { win: null, fail: [], minPeak: Infinity, loss: 1 };
    const key = stateKey(state);
    const cached = memo.get(key);
    if (cached) return cached;
    if (++nodes > nodeCap) throw new NodeCapExceeded(level.id, nodeCap);
    const actions = enumerateActions(state, mode);
    if (!actions.length) {
      // The runtime keeps this state alive via a join into the open epoch — a
      // move `sequential-compat` deliberately ignores. That is a dead end for
      // sequential play, not a runtime deadlock bug.
      if (mode === 'sequential-compat') return { win: null, fail: [], minPeak: Infinity, loss: 1 };
      throw new Error('Runtime failed to mark a deadlock');
    }
    branchSum += actions.length;
    let win: GameAction[] | null = null;
    let fail: GameAction[] | null = null;
    let minPeak = Infinity;
    let loss = 0;
    for (const action of actions) {
      const outcome = resolveAction(state, action);
      if (!outcome.accepted) throw new Error('Solver/runtime admission mismatch');
      const child = visit(outcome.state);
      if (child.win !== null) {
        const candidate = [action, ...child.win];
        if (win === null || candidate.length < win.length) win = candidate;
        minPeak = Math.min(minPeak, Math.max(state.holding.length, child.minPeak));
      }
      if (child.fail !== null && (fail === null || child.fail.length + 1 < fail.length)) fail = [action, ...child.fail];
      loss += child.loss / actions.length;
    }
    const result = { win, fail, minPeak, loss };
    memo.set(key, result);
    return result;
  }

  const initial = createGame(level);
  const firstActions = legalActions(initial);
  let root: Node = { win: null, fail: null, minPeak: Infinity, loss: 0 };
  let firstMoves: FirstMoveStat[] = [];
  let nodeCapHit = false;

  try {
    root = visit(initial);
    firstMoves = firstActions.map((action) => {
      const childState = resolveAction(initial, action).state;
      const child = visit(childState); // memoized — cheap
      const line = child.win ?? [];
      const replay = replayLine(childState, line);
      return {
        action,
        solvable: child.win !== null,
        winLength: line.length,
        minPeakHolding: child.win !== null && Number.isFinite(child.minPeak) ? child.minPeak : -1,
        lossAfter: child.loss,
        peakHoldingOnLine: child.win !== null ? replay.peakHolding : childState.holding.length,
        heldRelaunchesOnLine: replay.heldRelaunches,
        maxActiveOnLine: replay.maxActive,
      };
    });
  } catch (e) {
    if (partialOnCap && e instanceof NodeCapExceeded) {
      nodeCapHit = true;
      firstMoves = [];
    } else {
      throw e;
    }
  }

  const witnessReplay = root.win ? replayLine(initial, root.win) : { peakHolding: 0, heldRelaunches: 0, maxActive: 0 };

  return {
    solved: root.win !== null,
    complete: !nodeCapHit,
    nodeCapHit,
    moves: root.win ?? [],
    length: root.win?.length ?? 0,
    peakHolding: witnessReplay.peakHolding,
    minWinningPeak: root.minPeak,
    maxHolding,
    viableFirstMoves: firstMoves.filter((m) => m.solvable).length,
    totalFirstMoves: firstActions.length,
    nodes,
    avgBranching: nodes > 0 ? branchSum / nodes : 0,
    failPath: root.fail,
    lossProbability: root.loss,
    heldLaunches: root.win?.filter((a) => a.kind === 'holding').length ?? 0,
    maxActiveOnWitness: witnessReplay.maxActive,
    maxActive,
    firstMoves,
  };
}
export const audit = solve;
