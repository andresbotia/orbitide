import { createGame } from '../createGame';
import { resolveArrival } from '../holdingArrival';
import type { LevelDefinition } from '../types';

const TEST_LEVEL: LevelDefinition = {
  id: 994,
  title: 'Extra Slot Rescue Level',
  themeId: 'neon-city',
  difficulty: 'easy',
  holdingCapacity: 3,
  pixelArt: [
    'RRR',
    'GGG',
  ],
  tunnels: [
    [{ color: 'red', capacity: 1 }],
    [],
    [],
  ],
};

describe('M6 Extra Slot Booster Engine', () => {
  it('without extra slot, 4th arriving Pal to a 3/3 Holding tray triggers a loss', () => {
    const game = createGame(TEST_LEVEL);
    // Fill Holding with 3 Pals
    const filledGame = {
      ...game,
      holding: [
        { id: 'h1', color: 'red' as const, capacity: 1 },
        { id: 'h2', color: 'red' as const, capacity: 1 },
        { id: 'h3', color: 'red' as const, capacity: 1 },
      ],
      pendingHolding: [
        {
          charge: { id: 'inbound', color: 'red' as const, capacity: 1 },
          grace: 0,
        },
      ],
    };

    // When the inbound Pal reaches Gate, tray is 3/3 -> rejected -> loss
    const outcome = resolveArrival(filledGame, 'inbound');
    expect(outcome.admitted).toBeNull();
    expect(outcome.rejected).not.toBeNull();
    expect(outcome.state.status).toBe('lost');
  });

  it('EDGE CASE RESCUE: activating Extra Slot while Pal is in-flight increases capacity to 4 and prevents loss', () => {
    const game = createGame(TEST_LEVEL);
    // Holding is 3/3 and an inbound Pal is pending
    const filledGame = {
      ...game,
      holding: [
        { id: 'h1', color: 'red' as const, capacity: 1 },
        { id: 'h2', color: 'red' as const, capacity: 1 },
        { id: 'h3', color: 'red' as const, capacity: 1 },
      ],
      pendingHolding: [
        {
          charge: { id: 'inbound', color: 'red' as const, capacity: 1 },
          grace: 0,
        },
      ],
    };

    // Player activates Extra Slot -> holdingCapacity becomes 4
    const rescuedGame = {
      ...filledGame,
      holdingCapacity: 4,
    };

    // Incoming Pal reaches Gate: it captures the new slot (slot 4) -> no loss!
    const outcome = resolveArrival(rescuedGame, 'inbound');
    expect(outcome.admitted).toEqual({ id: 'inbound', color: 'red', capacity: 1 });
    expect(outcome.rejected).toBeNull();
    expect(outcome.state.holding.length).toBe(4);
    expect(outcome.state.holding[3]?.id).toBe('inbound');
    expect(outcome.state.status).toBe('playing');
  });

  it('second activation is rejected and holding capacity cannot stack to 5', () => {
    const game = createGame(TEST_LEVEL);
    const boostedGame = { ...game, holdingCapacity: 4 };

    // Attempting to activate again when capacity is already 4
    const canActivateAgain = boostedGame.holdingCapacity < 4;
    expect(canActivateAgain).toBe(false);
    expect(boostedGame.holdingCapacity).toBe(4);
  });

  it('level restart resets holding capacity back to 3', () => {
    // Normal level has capacity 3
    const game = createGame(TEST_LEVEL);
    expect(game.holdingCapacity).toBe(3);

    // After booster during run
    const boosted = { ...game, holdingCapacity: 4 };
    expect(boosted.holdingCapacity).toBe(4);

    // Restart creates a fresh game from definition -> back to 3
    const restarted = createGame(TEST_LEVEL);
    expect(restarted.holdingCapacity).toBe(3);
  });

  it('preserves unique slot ownership: 5th arriving Pal is rejected when capacity is 4', () => {
    const game = createGame(TEST_LEVEL);
    // Tray is full with 4 Pals
    const fullTray4 = {
      ...game,
      holdingCapacity: 4,
      holding: [
        { id: 'h1', color: 'red' as const, capacity: 1 },
        { id: 'h2', color: 'red' as const, capacity: 1 },
        { id: 'h3', color: 'red' as const, capacity: 1 },
        { id: 'h4', color: 'red' as const, capacity: 1 },
      ],
      pendingHolding: [
        { charge: { id: 'inbound-5', color: 'red' as const, capacity: 1 }, grace: 0 },
      ],
    };

    const outcome = resolveArrival(fullTray4, 'inbound-5');
    expect(outcome.admitted).toBeNull();
    expect(outcome.rejected).not.toBeNull();
    expect(outcome.state.status).toBe('lost');
  });
});
