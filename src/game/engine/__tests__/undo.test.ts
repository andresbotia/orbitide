import { applyBomb } from '../bomb';
import { createGame } from '../createGame';
import { resolveAction } from '../resolveLaunch';
import type { GameState, LevelDefinition } from '../types';
import { cloneGameState, restoreSnapshot } from '../undo';

const TEST_LEVEL: LevelDefinition = {
  id: 993,
  title: 'Undo Test Level',
  themeId: 'neon-city',
  difficulty: 'easy',
  holdingCapacity: 3,
  pixelArt: [
    'RRR',
    'RGR',
    'RRR',
  ],
  tunnels: [
    [{ color: 'red', capacity: 2 }, { color: 'green', capacity: 1 }],
    [],
    [],
  ],
};

describe('M6 One-Step Undo Engine', () => {
  it('clones state isolating it from subsequent mutations', () => {
    const game = createGame(TEST_LEVEL);
    const snapshot = cloneGameState(game);

    // Mutate game
    const outcome = resolveAction(game, { kind: 'tunnel', id: game.tunnels[0]!.id });
    expect(outcome.accepted).toBe(true);

    // Snapshot is untouched
    expect(snapshot.movesApplied).toBe(0);
    expect(snapshot.tunnels[0]!.queue.length).toBe(2);
    expect(snapshot.pixels.filter((p) => p.cleared).length).toBe(0);
  });

  it('restores state after a tunnel launch', () => {
    const game = createGame(TEST_LEVEL);
    const snapshot = cloneGameState(game);

    const outcome = resolveAction(game, { kind: 'tunnel', id: game.tunnels[0]!.id });
    expect(outcome.accepted).toBe(true);
    expect(outcome.state.tunnels[0]!.queue.length).toBe(1);

    const restored = restoreSnapshot(snapshot, false);
    expect(restored.movesApplied).toBe(0);
    expect(restored.tunnels[0]!.queue.length).toBe(2);
    expect(restored.tunnels[0]!.queue[0]!.color).toBe('red');
    expect(restored.status).toBe('playing');
  });

  it('restores state after a bomb detonation', () => {
    const game = createGame(TEST_LEVEL);
    const snapshot = cloneGameState(game);

    const outcome = applyBomb(game, { x: 1, y: 1 });
    expect(outcome.accepted).toBe(true);
    expect(outcome.state.pixels.every((p) => p.cleared)).toBe(true);
    expect(outcome.state.status).toBe('won');

    const restored = restoreSnapshot(snapshot, false);
    expect(restored.pixels.every((p) => !p.cleared)).toBe(true);
    expect(restored.status).toBe('playing');
    expect(restored.movesApplied).toBe(0);
  });

  it('preserves Extra Slot booster (capacity 4) across undo of a subsequent action', () => {
    const game = createGame(TEST_LEVEL);
    // User activated extra slot
    const gameWithBooster = { ...game, holdingCapacity: 4 };

    const snapshot = cloneGameState(gameWithBooster);
    const outcome = resolveAction(gameWithBooster, { kind: 'tunnel', id: gameWithBooster.tunnels[0]!.id });
    expect(outcome.accepted).toBe(true);

    const restored = restoreSnapshot(snapshot, true);
    expect(restored.holdingCapacity).toBe(4);
    expect(restored.status).toBe('playing');
  });

  it('restores state after a Holding relaunch (Case B)', () => {
    const game = createGame(TEST_LEVEL);
    // Put a Pal in Holding
    const gameWithHolding = {
      ...game,
      holding: [{ id: 'held-pal-1', color: 'red' as const, capacity: 2 }],
    };

    const snapshot = cloneGameState(gameWithHolding);
    // Player launches from Holding
    const outcome = resolveAction(gameWithHolding, { kind: 'holding', id: 'held-pal-1' });
    expect(outcome.accepted).toBe(true);
    expect(outcome.state.holding.length).toBe(0);

    // Player triggers Undo
    const restored = restoreSnapshot(snapshot, false);
    expect(restored.holding.length).toBe(1);
    expect(restored.holding[0]?.id).toBe('held-pal-1');
    expect(restored.status).toBe('playing');
  });

  it('preserves and restores provisional pendingHolding state correctly (Case C)', () => {
    const game = createGame(TEST_LEVEL);
    // Case C1: State before action had an inbound Pal pending Holding
    const stateWithPending = {
      ...game,
      pendingHolding: [
        { charge: { id: 'inbound-pal', color: 'green' as const, capacity: 1 }, grace: 1 },
      ],
    };

    const snapshot = cloneGameState(stateWithPending);
    // Action 2 occurs: bomb clears something
    const bombOutcome = applyBomb(stateWithPending, { x: 0, y: 0 });
    expect(bombOutcome.accepted).toBe(true);

    // Undoing Action 2 restores the pendingHolding Pal
    const restored = restoreSnapshot(snapshot, false);
    expect(restored.pendingHolding.length).toBe(1);
    expect(restored.pendingHolding[0]?.charge.id).toBe('inbound-pal');
    expect(restored.status).toBe('playing');
  });

  it('one-step undo clears snapshot so undo itself cannot be undone', () => {
    let undoSnapshot: GameState | null = null;
    const game = createGame(TEST_LEVEL);

    // Action 1 occurs
    undoSnapshot = cloneGameState(game);
    const outcome = resolveAction(game, { kind: 'tunnel', id: game.tunnels[0]!.id });
    expect(outcome.accepted).toBe(true);

    // Undo occurs: consumes snapshot
    const snapshotToRestore = undoSnapshot;
    undoSnapshot = null; // Clear snapshot
    const restored = restoreSnapshot(snapshotToRestore, false);
    expect(restored.movesApplied).toBe(0);

    // Attempting a second undo has no snapshot (cannot undo the undo)
    expect(undoSnapshot).toBeNull();
  });
});
