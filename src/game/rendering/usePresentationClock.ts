import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import {
  cancelAnimation, Easing, runOnJS, useDerivedValue, useSharedValue, withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/** How long one uninterrupted run of the board clock lasts before it re-arms itself. */
const CLOCK_SPAN_MS = 6 * 60 * 60 * 1000;

export interface PresentationClock {
  /** Board presentation time in ms since `epoch`, advanced on the UI thread. */
  now: SharedValue<number>;
  /** JS wall time (`Date.now()`) that board time 0 corresponds to. */
  epoch: number;
}

/**
 * One UI-thread time source for every Pal on a board.
 *
 * Each Pal used to own a `withTiming` clock re-anchored from `Date.now()`
 * whenever a launch re-scripted its tail; each re-anchor landed a slightly
 * different frame's worth of latency, so existing Pals jumped ±3–6 px whenever
 * another Pal launched. Now the board anchors ONE linear clock and every Pal
 * derives `now - (launchedAtMs - epoch)` from it: re-scripts only change what a
 * Pal is scripted to do next, never where its time is.
 *
 * The clock only runs while `running` (a Pal is on screen), so an idle board
 * costs nothing per frame. It re-anchors only when it (re)starts — from idle,
 * or on return to the foreground (the session settles all flights when
 * backgrounded) — never while a Pal is mid-flight.
 */
export function usePresentationClock(running: boolean): PresentationClock {
  const [epoch] = useState(() => Date.now());
  const now = useSharedValue(0);

  useEffect(() => {
    if (!running) { cancelAnimation(now); return; }
    const start = () => {
      const from = Date.now() - epoch;
      now.set(from);
      now.set(withTiming(from + CLOCK_SPAN_MS, { duration: CLOCK_SPAN_MS, easing: Easing.linear }, (finished) => {
        if (finished) runOnJS(start)();
      }));
    };
    start();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') start();
      else cancelAnimation(now);
    });
    return () => { sub.remove(); cancelAnimation(now); };
  }, [running, epoch, now]);

  return useMemo(() => ({ now, epoch }), [now, epoch]);
}

/**
 * One Pal's pass time from the board clock, clamped to [0, endMs]. A UI-thread
 * mapper — no per-Pal animation, effect or JS timestamp.
 */
export function usePassClock(clock: PresentationClock, launchedAtMs: number, endMs: number): SharedValue<number> {
  const { now } = clock;
  const offset = launchedAtMs - clock.epoch;
  return useDerivedValue(() => Math.min(endMs, Math.max(0, now.value - offset)));
}
