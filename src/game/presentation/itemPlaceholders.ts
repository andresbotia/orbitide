/**
 * Isolated preview inventory for the gameplay item rack.
 *
 * NOT engine state. Does not persist, does not touch holdingCapacity,
 * does not call the solver, and does not clear pixels. Flip
 * {@link ENABLE_GAMEPLAY_ITEM_PLACEHOLDERS} off to hide the rack.
 */
export const ENABLE_GAMEPLAY_ITEM_PLACEHOLDERS = true;

export type GameplayItemId = 'extraSlot' | 'pixelBomb';

export interface GameplayItemPreview {
  extraSlot: number;
  pixelBomb: number;
}

/** Preview counts only — not earned inventory. */
export const GAMEPLAY_ITEM_PREVIEW: GameplayItemPreview = {
  extraSlot: 2,
  pixelBomb: 1,
};

export const GAMEPLAY_ITEMS: readonly {
  id: GameplayItemId;
  label: string;
  accessibilityLabel: string;
}[] = [
  { id: 'extraSlot', label: 'Extra Slot', accessibilityLabel: 'Extra Slot item' },
  { id: 'pixelBomb', label: 'Pixel Bomb', accessibilityLabel: 'Pixel Bomb item' },
] as const;
