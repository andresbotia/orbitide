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
import { canJoinEpoch, epochResidueKey } from './epoch';
import { resolveAction } from './resolveLaunch';
import type { GameState, LevelDefinition } from './types';

export function stateKey(s: GameState): string {
  const committed = s.pixels.map((p) => p.cleared ? '1' : '0').join('') + '/' +
    s.tunnels.map((t) => t.queue.map((c) => `${c.id}:${c.capacity}`).join(',')).join('|') + '/' +
    s.holding.map((c) => `${c.id}:${c.color}:${c.capacity}`).join(',');
  // An open epoch changes how the next launch arbitrates, so equivalent boards
  // with different epoch residue must not memoize together.
  return s.epoch ? `${committed}##${epochResidueKey(s.epoch)}` : committed;
}

function chargeIdOf(state: GameState, action: GameAction): string | undefined {
  return action.kind === 'tunnel'
    ? state.tunnels.find((t) => t.id === action.id)?.queue[0]?.id
    : state.holding.find((c) => c.id === action.id)?.id;
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
 */
export function enumerateActions(state: GameState, mode: SolveMode): GameAction[] {
  const base = legalActions(state);
  if (mode === 'sequential-compat' || !state.epoch) return base;
  const out: GameAction[] = [];
  for (const a of base) {
    out.push(a);
    const id = chargeIdOf(state, a);
    if (id && canJoinEpoch(state, id)) out.push({ ...a, join: true });
  }
  return out;
}

export interface SolveResult {
  solved: boolean; complete: boolean; moves: GameAction[]; length: number;
  peakHolding: number; minWinningPeak: number; maxHolding: number;
  viableFirstMoves: number; nodes: number; failPath: GameAction[] | null;
  lossProbability: number; heldLaunches: number;
  /** Peak charges sharing the rail on the shortest winning witness. */
  maxActiveOnWitness: number;
  /** Peak charges sharing the rail anywhere in the explored graph. */
  maxActive: number;
}
interface Node { win: GameAction[] | null; fail: GameAction[] | null; minPeak: number; loss: number }

/** Thrown by {@link solve} when `opts.signal.cancelled` flips to `true`. */
export class SolverCancelled extends Error {
  constructor() {
    super('Solve cancelled');
    this.name = 'SolverCancelled';
  }
}

export interface SolveOptions {
  nodeCap?: number;
  mode?: SolveMode;
  /** Cooperative cancellation — flip `cancelled` to abort with {@link SolverCancelled}. */
  signal?: { cancelled: boolean };
}

export function solve(level: LevelDefinition, opts: SolveOptions = {}): SolveResult {
  const { nodeCap = 300_000, mode = 'metrics', signal } = opts;
  const memo = new Map<string, Node>();
  let nodes = 0;
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
    if (++nodes > nodeCap) throw new Error(`Level ${level.id} solver exceeded ${nodeCap} states`);
    const actions = enumerateActions(state, mode);
    if (!actions.length) throw new Error('Runtime failed to mark a deadlock');
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
  const root = visit(initial);
  const viableFirstMoves = legalActions(initial).filter((a) => visit(resolveAction(initial, a).state).win !== null).length;
  let peakHolding = 0;
  let maxActiveOnWitness = 0;
  let state = initial;
  for (const action of root.win ?? []) {
    const outcome = resolveAction(state, action);
    maxActiveOnWitness = Math.max(maxActiveOnWitness, outcome.epochCharges?.length ?? 0);
    state = outcome.state;
    peakHolding = Math.max(peakHolding, state.holding.length);
  }
  return {
    solved: root.win !== null, complete: true, moves: root.win ?? [], length: root.win?.length ?? 0,
    peakHolding, minWinningPeak: root.minPeak, maxHolding, viableFirstMoves, nodes,
    failPath: root.fail, lossProbability: root.loss,
    heldLaunches: root.win?.filter((a) => a.kind === 'holding').length ?? 0,
    maxActiveOnWitness, maxActive,
  };
}
export const audit = solve;
