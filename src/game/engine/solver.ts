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
 *
 * It searches LOGICAL player choices only. Under FIRST LAUNCHED, FIRST SERVED a
 * launch that joins Pals still on the rail resolves exactly like the same launch
 * made after the rail settles, so joining is not a puzzle decision and is never
 * a separate branch. Pals sharing the rail and Active-slot pressure are
 * presentation / game feel — the live session still launches concurrently.
 */
import { legalActions, type GameAction } from './actions';
import { createGame } from './createGame';
import { applyActionWithArrivals, settleDueArrivals } from './holdingArrival';
import { boardFingerprint } from './frozen';
import { resolveAction } from './resolveLaunch';
import type { GameState, LevelDefinition } from './types';

/**
 * The logical state a decision is made from: board progress, tunnel queues and
 * Holding. Nothing else shapes the rest of the game — the Pals on the rail were
 * resolved when they launched, and a join resolves like a settle-first launch —
 * so equal logical states have equal futures and memoize together.
 *
 * Tunnel colour is part of the key so two queues with identical ids/capacities
 * but different colours cannot collide. Holding already included colour.
 */
export function stateKey(s: GameState): string {
  return boardFingerprint(s.pixels) + '/' +
    s.tunnels.map((t) => t.queue.map((c) => `${c.id}:${c.color}:${c.capacity}`).join(',')).join('|') + '/' +
    s.holding.map((c) => `${c.id}:${c.color}:${c.capacity}`).join(',') + '/' +
    // Pals still travelling toward an undecided Holding admission shape the
    // rest of the game (one of them may yet take a slot, or end the run), so
    // two states that differ only in what is inbound are NOT the same state.
    s.pendingHolding.map((p) => `${p.charge.id}:${p.charge.capacity}+${p.grace}`).join(',');
}

/**
 * Every logical choice from `state`: one settle-first launch per tunnel front
 * and per held charge that the runtime would admit — the same candidate
 * generator and `actionRejection` filter as {@link legalActions}. A `join: true`
 * twin is not a separate choice: it reaches exactly the same next logical state
 * (see join-settle-equivalence.test.ts), so counting it would only duplicate
 * the branch and skew every per-choice metric.
 *
 * Held charges only ever appear here as an explicit `{ kind: 'holding' }`
 * action — the solver never implicitly relaunches Holding.
 */
export function enumerateActions(state: GameState): GameAction[] {
  return legalActions(state);
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
}

/** One settled player-decision state along a winning witness (memoized lookups). */
export interface DecisionStat {
  /** Legal accepted actions from this state (`enumerateActions` / `legalActions`). */
  legalCount: number;
  /** How many of those actions have a winning continuation. */
  winningCount: number;
  /** How many lead to an unsolvable / loss subtree. */
  losingCount: number;
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
  /** Mean number of logical choices per explored (non-terminal, non-cached) state. */
  avgBranching: number;
  failPath: GameAction[] | null;
  /**
   * Loss probability when every logical choice is taken uniformly at random. A
   * move that loops back to a state already on the line (a Core V2 Holding
   * relaunch that clears nothing) is simply picked again, so it is excluded.
   */
  lossProbability: number; heldLaunches: number;
  firstMoves: FirstMoveStat[];
  /**
   * Per-decision-state branching along the winning witness, filled from the
   * already-visited memo. Empty when unsolved or truncated.
   */
  decisionStats: DecisionStat[];
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

function replayLine(from: GameState, line: GameAction[]): { peakHolding: number; heldRelaunches: number } {
  let peak = from.holding.length;
  let held = 0;
  let state = from;
  for (const action of line) {
    if (action.kind === 'holding') held += 1;
    state = applyActionWithArrivals(state, action).state;
    peak = Math.max(peak, state.holding.length);
  }
  return { peakHolding: peak, heldRelaunches: held };
}

export function solve(level: LevelDefinition, opts: SolveOptions = {}): SolveResult {
  const { nodeCap = 300_000, signal, partialOnCap = false } = opts;
  const memo = new Map<string, Node>();
  /** Logical states on the current search line (for loop detection). */
  const onLine = new Set<string>();
  let nodes = 0;
  let branchSum = 0;
  let maxHolding = 0;

  function visit(state: GameState, key: string = stateKey(state)): Node {
    if (signal?.cancelled) throw new SolverCancelled();
    maxHolding = Math.max(maxHolding, state.holding.length);
    if (state.status === 'won') return { win: [], fail: null, minPeak: state.holding.length, loss: 0 };
    if (state.status === 'lost') return { win: null, fail: [], minPeak: Infinity, loss: 1 };
    const cached = memo.get(key);
    if (cached) return cached;
    if (++nodes > nodeCap) throw new NodeCapExceeded(level.id, nodeCap);
    const actions = enumerateActions(state);
    // A playing state with no admitted move is one `isLost` must already have
    // called — the solver and the runtime share the same predicate.
    if (!actions.length) throw new Error('Runtime failed to mark a deadlock');
    onLine.add(key);
    branchSum += actions.length;
    let win: GameAction[] | null = null;
    let fail: GameAction[] | null = null;
    let minPeak = Infinity;
    let loss = 0;
    let counted = 0;
    for (const action of actions) {
      const outcome = resolveAction(state, action);
      if (!outcome.accepted) throw new Error('Solver/runtime admission mismatch');
      // The player moves, THEN any arrival whose grace window has elapsed
      // commits. That ordering is the rescue window: a relaunch taken while a
      // Pal is inbound frees the slot before that Pal lands.
      const child = settleDueArrivals(outcome.state);
      const childKey = child.status === 'playing' ? stateKey(child) : '';
      // A move that loops back onto this line — e.g. a Core V2 Holding relaunch
      // that clears nothing and returns to the same logical state — is neither
      // progress nor a loss: it cannot shorten a win or end the game, so it is
      // left out of the win, fail and loss-probability accounting. (Uniform
      // random play simply picks again, which is what renormalising over the
      // remaining moves computes.)
      if (childKey && onLine.has(childKey)) continue;
      const node = visit(child, childKey || undefined);
      if (node.win !== null) {
        const candidate = [action, ...node.win];
        if (win === null || candidate.length < win.length) win = candidate;
        minPeak = Math.min(minPeak, Math.max(state.holding.length, node.minPeak));
      }
      if (node.fail !== null && (fail === null || node.fail.length + 1 < fail.length)) fail = [action, ...node.fail];
      loss += node.loss;
      counted += 1;
    }
    onLine.delete(key);
    // Every move loops back: the player can never make progress again — a
    // soft-lock, which is a loss for the level.
    const result: Node = counted === 0
      ? { win: null, fail: [], minPeak: Infinity, loss: 1 }
      : { win, fail, minPeak, loss: loss / counted };
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

  const witnessReplay = root.win ? replayLine(initial, root.win) : { peakHolding: 0, heldRelaunches: 0 };

  // Replay the winning line and classify each decision from the already-filled
  // memo — no extra search. Truncated runs leave this empty (incomplete).
  const decisionStats: DecisionStat[] = [];
  if (root.win && !nodeCapHit) {
    let state = initial;
    for (const action of root.win) {
      if (state.status === 'playing') {
        const actions = enumerateActions(state);
        let winningCount = 0;
        let losingCount = 0;
        for (const a of actions) {
          const child = visit(resolveAction(state, a).state);
          if (child.win !== null) winningCount += 1;
          else losingCount += 1;
        }
        decisionStats.push({ legalCount: actions.length, winningCount, losingCount });
      }
      state = applyActionWithArrivals(state, action).state;
    }
  }

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
    firstMoves,
    decisionStats,
  };
}
export const audit = solve;

export interface FirstWinOptions {
  nodeCap?: number;
  timeCapMs?: number;
  signal?: { cancelled: boolean };
}

export interface FirstWinResult {
  solved: boolean;
  moves: GameAction[];
  nodes: number;
  nodeCapHit: boolean;
  timeCapHit: boolean;
}

/**
 * Rapidly answers: "Does at least ONE valid winning sequence exist?"
 * Explores the same logical choices as {@link solve} with DFS and stops
 * immediately once the first winning state is encountered.
 *
 * Does not calculate difficulty, rank paths, or explore alternative branches.
 */
export function findFirstWinningWitness(
  level: LevelDefinition,
  opts: FirstWinOptions = {},
): FirstWinResult {
  const { nodeCap = 100_000, timeCapMs = 30_000, signal } = opts;
  const initial = createGame(level);
  if (initial.status === 'won') {
    return { solved: true, moves: [], nodes: 1, nodeCapHit: false, timeCapHit: false };
  }
  if (initial.status === 'lost') {
    return { solved: false, moves: [], nodes: 1, nodeCapHit: false, timeCapHit: false };
  }

  const memo = new Map<string, GameAction[] | null>();
  const visiting = new Set<string>();
  let nodes = 0;
  let nodeCapHit = false;
  let timeCapHit = false;
  const startTime = performance.now();

  function visit(state: GameState): GameAction[] | null {
    if (signal?.cancelled) return null;
    if (state.status === 'won') return [];
    if (state.status === 'lost') return null;

    const key = stateKey(state);
    if (memo.has(key)) return memo.get(key)!;
    if (visiting.has(key)) return null;

    if (++nodes > nodeCap) {
      nodeCapHit = true;
      return null;
    }
    if (performance.now() - startTime > timeCapMs) {
      timeCapHit = true;
      return null;
    }

    visiting.add(key);
    const actions = enumerateActions(state);
    for (const action of actions) {
      const outcome = resolveAction(state, action);
      if (!outcome.accepted) continue;
      const childWin = visit(settleDueArrivals(outcome.state));
      if (childWin !== null) {
        const win = [action, ...childWin];
        visiting.delete(key);
        memo.set(key, win);
        return win;
      }
      if (nodeCapHit || timeCapHit) {
        visiting.delete(key);
        return null;
      }
    }

    visiting.delete(key);
    memo.set(key, null);
    return null;
  }

  const moves = visit(initial);
  return {
    solved: moves !== null,
    moves: moves ?? [],
    nodes,
    nodeCapHit,
    timeCapHit,
  };
}

