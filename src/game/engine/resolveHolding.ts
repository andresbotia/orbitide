import { HELD_ENTRY_FRACTION } from './orbit';
import { applyChargePass } from './pixels';
import type { GameState, OrbColor } from './types';

export interface AutoResolution {
  chargeId: string;
  color: OrbColor;
  /** Pixels this held charge cleared this settle pass, in clear order. */
  clearedPixelIds: string[];
  /** True when the held charge emptied and left the tray. */
  consumed: boolean;
  /** Capacity left on the charge afterwards (0 when consumed). */
  remainingCapacity: number;
}

/**
 * Automatic Holding resolution.
 *
 * After the primary launch, repeatedly let parked charges relaunch: the first
 * held charge (in tray order) that can clear at least one currently reachable
 * matching pixel does so, up to its capacity. If it empties it leaves the tray;
 * otherwise it stays with reduced capacity. Any change restarts the scan, since
 * a cleared pixel can expose new pixels for a different held charge.
 *
 * **Mutates** the passed `state` (its `pixels` and `holding`). Callers hand in a
 * working copy.
 *
 * Termination: every productive iteration clears at least one pixel and pixels
 * never un-clear, so the loop runs at most (pixel count) times — no infinite
 * auto-resolution loop is possible.
 */
export function settleHolding(state: GameState): AutoResolution[] {
  const resolutions: AutoResolution[] = [];
  const maxIterations = state.pixels.length + 1;
  let iterations = 0;

  for (;;) {
    iterations += 1;
    if (iterations > maxIterations) break; // hard safety net

    let progressed = false;

    for (let i = 0; i < state.holding.length; i += 1) {
      const charge = state.holding[i];
      if (!charge) continue;

      const pass = applyChargePass(state, charge.color, charge.capacity, HELD_ENTRY_FRACTION);
      if (pass.clearedPixelIds.length === 0) continue;

      charge.capacity -= pass.clearedPixelIds.length;
      const consumed = charge.capacity <= 0;
      if (consumed) state.holding.splice(i, 1);

      resolutions.push({
        chargeId: charge.id,
        color: charge.color,
        clearedPixelIds: pass.clearedPixelIds,
        consumed,
        remainingCapacity: consumed ? 0 : charge.capacity,
      });

      progressed = true;
      break; // restart the scan from the top of the tray
    }

    if (!progressed) break;
  }

  return resolutions;
}
