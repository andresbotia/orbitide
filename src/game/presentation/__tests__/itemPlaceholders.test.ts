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
  expect(GAMEPLAY_ITEMS.map((item) => item.id)).toEqual(['extraSlot', 'pixelBomb']);
  expect(GAMEPLAY_ITEM_PREVIEW).toEqual({ extraSlot: 2, pixelBomb: 1 });
  const src = read('src/game/presentation/itemPlaceholders.ts');
  expect(src).not.toMatch(/from '@\/game\/engine/);
  expect(src).not.toMatch(/resolveLaunch|createGame/);
});

test('item rack draws local utility glyphs and has no gameplay action', () => {
  const rack = read('src/components/gameplay/ItemRack.tsx');
  expect(rack).toMatch(/ItemGlyph/);
  expect(rack).not.toMatch(/item_extra_slot\.png|item_pixel_bomb\.png/);
  expect(rack).not.toMatch(/onPress=\{/);
  expect(rack).not.toMatch(/from '@\/game\/engine/);
  expect(rack).not.toMatch(/resolveLaunch|launchHeld/);
});

test('control deck still renders holding from engine capacity and docks items below', () => {
  const deck = read('src/components/gameplay/ControlDeck.tsx');
  expect(deck).toMatch(/capacity=\{state\.holdingCapacity\}/);
  expect(deck).toMatch(/<ItemRack/);
  expect(deck).toMatch(/<ActiveStatus/);
  const activeAt = deck.indexOf('<ActiveStatus');
  const tunnelsAt = deck.indexOf('<TunnelBar');
  const holdingAt = deck.indexOf('<HoldingTray');
  const itemsAt = deck.indexOf('<ItemRack');
  expect(activeAt).toBeGreaterThan(-1);
  expect(tunnelsAt).toBeGreaterThan(activeAt);
  expect(holdingAt).toBeGreaterThan(tunnelsAt);
  expect(itemsAt).toBeGreaterThan(holdingAt);
});
