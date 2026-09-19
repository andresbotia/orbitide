/**
 * Isolated preview inventory for the gameplay item rack.
 *
 * NOT engine state. Does not persist, does not touch holdingCapacity,
 * does not call the solver, and does not clear pixels. Flip
 * {@link ENABLE_GAMEPLAY_ITEM_PLACEHOLDERS} off to hide the rack.
 *
 * Tool direction: Undo, Extra Slot, Bomb (the Scanner was removed).
 */
export const ENABLE_GAMEPLAY_ITEM_PLACEHOLDERS = true;

export type GameplayItemId = 'undo' | 'extraSlot' | 'bomb';

export type GameplayItemPreview = Record<GameplayItemId, number>;

/** Preview counts only — not earned inventory. */
export const GAMEPLAY_ITEM_PREVIEW: GameplayItemPreview = {
  undo: 3,
  extraSlot: 1,
  bomb: 2,
};

export const GAMEPLAY_ITEMS: readonly {
  id: GameplayItemId;
  label: string;
  accessibilityLabel: string;
}[] = [
  { id: 'undo', label: 'Undo', accessibilityLabel: 'Undo last move' },
  { id: 'extraSlot', label: 'Extra Slot', accessibilityLabel: 'Extra Slot item' },
  { id: 'bomb', label: 'Bomb', accessibilityLabel: 'Bomb item' },
] as const;
