/**
 * Isolated preview inventory for the gameplay item rack.
 *
 * NOT engine state. Does not persist, does not touch holdingCapacity,
 * does not call the solver, and does not clear pixels. Flip
 * {@link ENABLE_GAMEPLAY_ITEM_PLACEHOLDERS} off to hide the rack.
 */
export const ENABLE_GAMEPLAY_ITEM_PLACEHOLDERS = true;

export type GameplayItemId = 'undo' | 'scanner' | 'extraSlot';

export interface GameplayItemPreview {
  undo: number;
  scanner: number;
  extraSlot: number;
}

/** Preview counts only — not earned inventory. */
export const GAMEPLAY_ITEM_PREVIEW: GameplayItemPreview = {
  undo: 3,
  scanner: 2,
  extraSlot: 1,
};

export const GAMEPLAY_ITEMS: readonly {
  id: GameplayItemId;
  label: string;
  accessibilityLabel: string;
}[] = [
  { id: 'undo', label: 'Undo', accessibilityLabel: 'Undo last move' },
  { id: 'scanner', label: 'Scanner', accessibilityLabel: 'Hint Scanner item' },
  { id: 'extraSlot', label: 'Extra Slot', accessibilityLabel: 'Extra Slot item' },
] as const;
