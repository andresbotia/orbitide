import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  ENABLE_GAMEPLAY_ITEM_PLACEHOLDERS,
  GAMEPLAY_ITEM_PREVIEW,
  GAMEPLAY_ITEMS,
} from '../itemPlaceholders';

const repoRoot = resolve(__dirname, '../../../..');
const read = (rel: string) => readFileSync(join(repoRoot, rel), 'utf8');

test('placeholder inventory is isolated from engine and economy', () => {
  expect(ENABLE_GAMEPLAY_ITEM_PLACEHOLDERS).toBe(true);
  // Tool direction: Undo, Extra Slot, Bomb — the Scanner was removed.
  expect(GAMEPLAY_ITEMS.map((item) => item.id)).toEqual(['undo', 'extraSlot', 'bomb']);
  expect(GAMEPLAY_ITEM_PREVIEW).toEqual({ undo: 3, extraSlot: 1, bomb: 2 });
  const src = read('src/game/presentation/itemPlaceholders.ts');
  expect(src).not.toMatch(/from '@\/game\/engine/);
  expect(src).not.toMatch(/resolveLaunch|createGame/);
});

test('item rack draws local utility glyphs and has no gameplay action', () => {
  const rack = read('src/components/gameplay/ItemRack.tsx');
  expect(rack).toMatch(/UndoGlyph/);
  expect(rack).toMatch(/SlotGlyph/);
  expect(rack).toMatch(/BombGlyph/);
  expect(rack).not.toMatch(/scanner/i);
  expect(rack).not.toMatch(/item_extra_slot\.png|item_pixel_bomb\.png/);
  expect(rack).not.toMatch(/from '@\/game\/engine/);
  expect(rack).not.toMatch(/resolveLaunch|launchHeld/);
});

test('control deck still renders holding from engine capacity and docks items below', () => {
  const deck = read('src/components/gameplay/ControlDeck.tsx');
  expect(deck).toMatch(/capacity=\{state\.holdingCapacity\}/);
  expect(deck).toMatch(/<ItemRack/);
  expect(deck).toMatch(/<ActiveStatus/);
  const activeAt = deck.indexOf('<ActiveStatus');
  const holdingStatusAt = deck.indexOf('<HoldingStatus');
  const holdingAt = deck.indexOf('<HoldingTray');
  const tunnelsAt = deck.indexOf('<TunnelBar');
  const itemsAt = deck.indexOf('<ItemRack');
  expect(activeAt).toBeGreaterThan(-1);
  // ACTIVE and HOLDING share the status strip, above the wells.
  expect(holdingStatusAt).toBeGreaterThan(activeAt);
  expect(holdingAt).toBeGreaterThan(holdingStatusAt);
  // Holding is ABOVE tunnels in the visual stack
  expect(tunnelsAt).toBeGreaterThan(holdingAt);
  expect(itemsAt).toBeGreaterThan(tunnelsAt);
});

test('deck refusal notices never add a layout row', () => {
  const deck = read('src/components/gameplay/ControlDeck.tsx');
  // The notice overlays the fixed-height status strip; the old status line
  // below the items resized the board whenever it appeared.
  expect(deck).toMatch(/<DeckNotice/);
  expect(deck).not.toMatch(/styles\.status/);
});
