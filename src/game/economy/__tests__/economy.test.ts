import mockAsyncStorage from '@react-native-async-storage/async-storage/jest/async-storage-mock';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { M6_ECONOMY } from '@/game/economy/config';
import {
  _clearEconomyCache,
  buyItem,
  consumeItem,
  loadEconomy,
  resetEconomy,
  sanitizeEconomy,
  settleFirstClear,
} from '@/storage/economy';

jest.mock('@react-native-async-storage/async-storage', () => mockAsyncStorage);

describe('M6 Economy & Persistence', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    _clearEconomyCache();
  });

  describe('Sanitization & Defaults', () => {
    it('provides sensible initial starting balance and inventory', async () => {
      const state = await loadEconomy();
      expect(state.coins).toBe(M6_ECONOMY.startingCoins);
      expect(state.coins).toBe(300);
      expect(state.inventory).toEqual({
        undo: 2,
        extraSlot: 2,
        bomb: 2,
      });
      expect(state.rewardedLevelIds).toEqual([]);
    });

    it('sanitizes corrupted, negative, and partial stored data', () => {
      const sanitized = sanitizeEconomy({
        coins: -50,
        inventory: { undo: -1, extraSlot: 'invalid', bomb: 5.8 },
        rewardedLevelIds: [1, 1, 2, 'bad', null],
      });

      expect(sanitized.coins).toBe(0);
      expect(sanitized.inventory.undo).toBe(0);
      expect(sanitized.inventory.extraSlot).toBe(M6_ECONOMY.startingInventory.extraSlot);
      expect(sanitized.inventory.bomb).toBe(5);
      expect(sanitized.rewardedLevelIds).toEqual([1, 2]);
    });

    it('falls back to defaults on null or non-object', () => {
      const sanitized = sanitizeEconomy(null);
      expect(sanitized.coins).toBe(300);
      expect(sanitized.inventory).toEqual({ undo: 2, extraSlot: 2, bomb: 2 });
      expect(sanitized.rewardedLevelIds).toEqual([]);
    });
  });

  describe('Idempotent First-Clear Reward Settlement', () => {
    it('awards first-clear coins exactly once for a level', async () => {
      const res1 = await settleFirstClear(1);
      expect(res1.awarded).toBe(true);
      expect(res1.reward).toBe(50);
      expect(res1.state.coins).toBe(350);
      expect(res1.state.rewardedLevelIds).toContain(1);

      // Second settlement on same level is a no-op
      const res2 = await settleFirstClear(1);
      expect(res2.awarded).toBe(false);
      expect(res2.reward).toBe(0);
      expect(res2.state.coins).toBe(350);
    });

    it('settling multiple clears in parallel handles race conditions idempotently', async () => {
      const [r1, r2, r3] = await Promise.all([
        settleFirstClear(5),
        settleFirstClear(5),
        settleFirstClear(5),
      ]);

      const awardedCount = [r1, r2, r3].filter((r) => r.awarded).length;
      expect(awardedCount).toBe(1);

      const state = await loadEconomy();
      expect(state.coins).toBe(350);
      expect(state.rewardedLevelIds).toEqual([5]);
    });

    it('awards distinct levels independently', async () => {
      await settleFirstClear(1);
      await settleFirstClear(2);
      const state = await loadEconomy();
      expect(state.coins).toBe(400);
      expect(state.rewardedLevelIds).toEqual([1, 2]);
    });
  });

  describe('Restock / Purchase Flow', () => {
    it('deducts exact price and adds 1 inventory when player can afford item', async () => {
      // Undo price: 75
      const res = await buyItem('undo');
      expect(res.success).toBe(true);
      expect(res.price).toBe(75);
      expect(res.state.coins).toBe(225);
      expect(res.state.inventory.undo).toBe(3);

      const persisted = await loadEconomy();
      expect(persisted.coins).toBe(225);
      expect(persisted.inventory.undo).toBe(3);
    });

    it('refuses purchase without deducting or adding inventory if insufficient coins', async () => {
      // Set coins to 10
      await AsyncStorage.setItem(
        'orbitide/economy/v1',
        JSON.stringify({
          coins: 10,
          inventory: { undo: 0, extraSlot: 0, bomb: 0 },
          rewardedLevelIds: [],
        }),
      );
      _clearEconomyCache();

      // Bomb price is 150 > 10
      const res = await buyItem('bomb');
      expect(res.success).toBe(false);
      expect(res.reason).toBe('insufficientCoins');
      expect(res.state.coins).toBe(10);
      expect(res.state.inventory.bomb).toBe(0);

      const persisted = await loadEconomy();
      expect(persisted.coins).toBe(10);
      expect(persisted.inventory.bomb).toBe(0);
    });

    it('purchasing different items deducts respective prices', async () => {
      // Starting: 300
      // Buy undo: 75 -> 225
      await buyItem('undo');
      // Buy extraSlot: 125 -> 100
      const rSlot = await buyItem('extraSlot');
      expect(rSlot.success).toBe(true);
      expect(rSlot.state.coins).toBe(100);
      expect(rSlot.state.inventory.extraSlot).toBe(3);

      // Now bomb costs 150 > 100 -> fails
      const rBomb = await buyItem('bomb');
      expect(rBomb.success).toBe(false);
      expect(rBomb.state.coins).toBe(100);
      expect(rBomb.state.inventory.bomb).toBe(2);
    });
  });

  describe('Item Consumption', () => {
    it('consumes exactly 1 unit when inventory > 0', async () => {
      const res = await consumeItem('bomb');
      expect(res.success).toBe(true);
      expect(res.state.inventory.bomb).toBe(1);

      const persisted = await loadEconomy();
      expect(persisted.inventory.bomb).toBe(1);
    });

    it('fails to consume and leaves quantity at 0 when quantity is 0', async () => {
      await consumeItem('undo'); // 2 -> 1
      await consumeItem('undo'); // 1 -> 0
      const res3 = await consumeItem('undo'); // 0 -> fail
      expect(res3.success).toBe(false);
      expect(res3.state.inventory.undo).toBe(0);

      const persisted = await loadEconomy();
      expect(persisted.inventory.undo).toBe(0);
    });

    it('never allows inventory to become negative', async () => {
      const attempts = await Promise.all([
        consumeItem('extraSlot'),
        consumeItem('extraSlot'),
        consumeItem('extraSlot'),
        consumeItem('extraSlot'),
      ]);

      const successCount = attempts.filter((a) => a.success).length;
      expect(successCount).toBe(2);

      const persisted = await loadEconomy();
      expect(persisted.inventory.extraSlot).toBe(0);
    });
  });

  describe('Hydration & Re-entry Safety', () => {
    it('reloading / hydrating from storage does not reset an existing balance or inventory', async () => {
      // Modify state
      await settleFirstClear(1); // 300 + 50 = 350
      await buyItem('undo'); // 350 - 75 = 275, undo = 3

      // Clear in-memory cache to simulate fresh app launch
      _clearEconomyCache();

      // Fresh load from storage
      const loaded = await loadEconomy();
      expect(loaded.coins).toBe(275);
      expect(loaded.inventory.undo).toBe(3);
      expect(loaded.rewardedLevelIds).toEqual([1]);
    });

    it('simulated double NEXT or rapid completion calls cannot duplicate reward', async () => {
      // 1st completion
      const res1 = await settleFirstClear(10);
      expect(res1.awarded).toBe(true);
      expect(res1.reward).toBe(50);

      // Rapid successive completion calls (e.g. double tap NEXT, overlay remount)
      const res2 = await settleFirstClear(10);
      const res3 = await settleFirstClear(10);
      expect(res2.awarded).toBe(false);
      expect(res3.awarded).toBe(false);

      const loaded = await loadEconomy();
      expect(loaded.coins).toBe(350);
      expect(loaded.rewardedLevelIds).toEqual([10]);
    });

    it('replaying an already-cleared level after restart does not grant reward', async () => {
      await settleFirstClear(7);
      const afterFirstClear = await loadEconomy();
      expect(afterFirstClear.coins).toBe(350);

      // Simulated replay of level 7
      const replayRes = await settleFirstClear(7);
      expect(replayRes.awarded).toBe(false);
      expect(replayRes.reward).toBe(0);

      const afterReplay = await loadEconomy();
      expect(afterReplay.coins).toBe(350);
    });
  });

  describe('Reset Economy', () => {
    it('resets coins, inventory, and rewarded levels back to test defaults', async () => {
      await settleFirstClear(1);
      await buyItem('undo');
      const reset = await resetEconomy();
      expect(reset.coins).toBe(300);
      expect(reset.inventory).toEqual({ undo: 2, extraSlot: 2, bomb: 2 });
      expect(reset.rewardedLevelIds).toEqual([]);
    });
  });
});
