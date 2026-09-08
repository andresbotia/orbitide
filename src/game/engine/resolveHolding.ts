import type { CoreTarget, HoldingTray } from './types';

export interface SettleResult {
  activeTargetIndex: number;
  /** Orbs that were auto-consumed from the tray, in the order they resolved. */
  autoResolved: HoldingTray;
}

/**
 * Automatic held-orb resolution.
 *
 * Given the current targets, the holding tray, and the active target index,
 * repeatedly consume any held orb whose color matches the active target. Each
 * consumed orb decrements the active target; when a target hits 0 the active
 * index advances and the process continues, so a single completion can chain
 * through several targets ("continue this process if automatically consumed
 * orbs complete another Core target").
 *
 * Mutates the passed `targets` and `holding` arrays in place — callers in the
 * engine always hand in fresh copies. Returns the new active index and the list
 * of orbs that were absorbed (for animation).
 */
export function settle(
  targets: CoreTarget[],
  holding: HoldingTray,
  activeTargetIndex: number,
): SettleResult {
  const autoResolved: HoldingTray = [];
  let index = activeTargetIndex;

  // Loop until the active target has no matching held orb (or targets run out).
  for (;;) {
    const target = targets[index];
    if (!target) break; // every target complete

    if (target.count === 0) {
      // Defensive: never sit on an already-complete target.
      index += 1;
      continue;
    }

    const heldIndex = holding.findIndex((orb) => orb.color === target.color);
    if (heldIndex === -1) break; // nothing in the tray can resolve right now

    const [orb] = holding.splice(heldIndex, 1);
    if (orb) autoResolved.push(orb);
    target.count -= 1;
    if (target.count === 0) index += 1;
  }

  return { activeTargetIndex: index, autoResolved };
}
