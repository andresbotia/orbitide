import { haptics } from './haptics';

/**
 * M2B haptic arbitration (spec §16).
 *
 * With up to five charges on the rail, routine pixel impacts can arrive in a
 * tight cluster. Firing one buzz per hit turns the phone into a rattle, so this
 * layer coalesces the cluster into a single, appropriately-sized pulse:
 *
 *   1 hit              → normal pixel impact
 *   2 within ~40 ms    → one slightly stronger impact
 *   3+ within ~60 ms   → one capped stronger pulse
 *
 * A winning final clear always wins the cluster (heavy). High-priority cues
 * (Holding land, warning, win, fail) are NOT routed through here — call them
 * directly so they are never swallowed.
 *
 * The flush is debounced by {@link COALESCE_WINDOW_MS}; that is the only latency
 * added to a routine hit, and it is deliberately below human "same beat"
 * perception (~60 ms).
 */

/** TUNABLE. The cluster window; also the routine-hit latency ceiling. */
export const COALESCE_WINDOW_MS = 45;

interface Pending {
  count: number;
  final: boolean;
  timer: ReturnType<typeof setTimeout> | undefined;
}

let pending: Pending | null = null;

function flush(): void {
  if (!pending) return;
  const { count, final } = pending;
  pending = null;
  if (final) {
    haptics.finalClear();
    return;
  }
  if (count <= 1) haptics.pixelPop();
  else if (count === 2) haptics.pixelCombo();
  else haptics.pixelBurst();
}

/**
 * Register one pixel-impact haptic. Impacts registered within
 * {@link COALESCE_WINDOW_MS} of each other fire as a single pulse.
 */
export function registerHit(options: { final?: boolean } = {}): void {
  if (!pending) {
    pending = { count: 0, final: false, timer: undefined };
  }
  pending.count += 1;
  pending.final = pending.final || options.final === true;
  if (pending.timer !== undefined) clearTimeout(pending.timer);
  pending.timer = setTimeout(flush, COALESCE_WINDOW_MS);
}

/** Drop any buffered pulse (app backgrounded, level restarted, pass retired). */
export function cancelHits(): void {
  if (pending?.timer !== undefined) clearTimeout(pending.timer);
  pending = null;
}

/** Fire immediately without waiting for the window — for tests and teardown. */
export function flushHitsNow(): void {
  if (pending?.timer !== undefined) clearTimeout(pending.timer);
  flush();
}
