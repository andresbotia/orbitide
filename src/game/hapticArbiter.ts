import { haptics } from './haptics';

/**
 * M2B haptic arbitration (spec §16), leading-edge.
 *
 * With up to five charges on the rail, routine pixel impacts can arrive in a
 * tight cluster. One buzz per hit turns the phone into a rattle, but waiting for
 * a quiet gap before buzzing (a trailing debounce) made every hit late and
 * could stay silent through an entire dense burst. So:
 *
 *   - A hit with no group open fires IMMEDIATELY (same beat as the pixel pop)
 *     and opens a {@link GROUP_WINDOW_MS} group.
 *   - Further hits inside the group are counted, not fired. When the group
 *     closes on its fixed schedule (never extended), the count becomes ONE
 *     pulse — 1 → pop, 2 → combo, 3+ → capped burst — and a new group opens.
 *     A group with no extra hits simply closes.
 *   - A winning final clear always fires at once (heavy) and absorbs the group.
 *
 * Net effect: routine pulses are ≥ GROUP_WINDOW_MS apart (≤ 10/s even with five
 * Pals firing), a lone hit is never delayed, and a dense burst is never silent.
 * High-priority cues (Holding land, warning, reject, win, fail) are NOT routed
 * through here — they are called directly so they are never swallowed.
 */

/** TUNABLE. Group length: the minimum spacing of routine hit pulses. */
export const GROUP_WINDOW_MS = 100;

interface Group {
  /** Hits counted after the one that opened the group. */
  extra: number;
  /** A final clear already fired in this group: drop the rest. */
  finalFired: boolean;
  timer: ReturnType<typeof setTimeout>;
}

let group: Group | null = null;

function open(finalFired: boolean): void {
  group = { extra: 0, finalFired, timer: setTimeout(close, GROUP_WINDOW_MS) };
}

function close(): void {
  if (!group) return;
  const { extra, finalFired } = group;
  group = null;
  if (finalFired || extra === 0) return;
  if (extra === 1) haptics.pixelPop();
  else if (extra === 2) haptics.pixelCombo();
  else haptics.pixelBurst();
  // Hits are still arriving: keep the cadence instead of re-firing on the next one.
  open(false);
}

/** Register one pixel-impact haptic (see module doc for the grouping rules). */
export function registerHit(options: { final?: boolean } = {}): void {
  const final = options.final === true;
  if (!group) {
    if (final) haptics.finalClear();
    else haptics.pixelPop();
    open(final);
    return;
  }
  if (group.finalFired) return;
  if (final) {
    haptics.finalClear();
    group.finalFired = true;
    return;
  }
  group.extra += 1;
}

/** Drop any open group and its pending pulse (app backgrounded, level restarted, pass retired). */
export function cancelHits(): void {
  if (group) clearTimeout(group.timer);
  group = null;
}

/** Fire an open group's pending pulse now and close it — for tests and teardown. */
export function flushHitsNow(): void {
  if (!group) return;
  clearTimeout(group.timer);
  const pending = group;
  group = null;
  if (pending.finalFired || pending.extra === 0) return;
  if (pending.extra === 1) haptics.pixelPop();
  else if (pending.extra === 2) haptics.pixelCombo();
  else haptics.pixelBurst();
}
