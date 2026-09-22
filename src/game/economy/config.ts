export type GameplayItemId = 'undo' | 'extraSlot' | 'bomb';

export interface EconomyConfig {
  readonly startingCoins: number;
  readonly firstClearReward: number;
  readonly itemPrices: Readonly<Record<GameplayItemId, number>>;
  readonly startingInventory: Readonly<Record<GameplayItemId, number>>;
}

/**
 * Tunable central economy configuration for M6 TestFlight.
 * Keep numbers trivial to adjust after tester feedback.
 */
export const M6_ECONOMY: EconomyConfig = {
  startingCoins: 300,
  firstClearReward: 50,
  itemPrices: {
    undo: 75,
    extraSlot: 125,
    bomb: 150,
  },
  startingInventory: {
    undo: 2,
    extraSlot: 2,
    bomb: 2,
  },
} as const;

export const ITEM_DISPLAY_NAMES: Record<GameplayItemId, string> = {
  undo: 'Undo',
  extraSlot: 'Extra Slot',
  bomb: 'Bomb',
};
