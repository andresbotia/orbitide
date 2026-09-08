import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createGame } from '@/game/engine/createGame';
import { resolveMove } from '@/game/engine/resolveMove';
import type { GameState, OrbColor } from '@/game/engine/types';
import { haptics } from '@/game/haptics';
import { requireLevel } from '@/game/levels/levels';
import { orbColors, palette } from '@/theme/colors';

/**
 * Base interaction lock (ms) after an accepted move — long enough for the orb
 * exit + reflow to read, short enough to feel responsive. A little longer when
 * a target completes or held orbs auto-resolve.
 */
const LOCK_BASE_MS = 190;
const LOCK_RESOLVE_MS = 320;

export interface GameSession {
  state: GameState;
  /** True while a move is resolving visually — used to gate taps in the UI. */
  locked: boolean;
  tap: (orbId: string) => void;
  restart: () => void;
  /** Bumped every time the Core should pulse. */
  pulseSignal: number;
  pulseStrength: number;
  flashColor: string;
}

interface Options {
  onWin?: () => void;
  onLose?: () => void;
}

interface PulseState {
  signal: number;
  strength: number;
  color: string;
}

const REST_PULSE: PulseState = { signal: 0, strength: 0.5, color: palette.coreGlow };

/**
 * Owns a single level's engine state plus the (purely cosmetic) interaction
 * lock and pulse signal. The caller is expected to remount this hook when the
 * level changes (the game route keys `GameScreen` by level id), so there is no
 * level-change effect here.
 */
export function useGameSession(levelId: number, options: Options = {}): GameSession {
  const level = useMemo(() => requireLevel(levelId), [levelId]);
  const [state, setState] = useState<GameState>(() => createGame(level));
  const [locked, setLocked] = useState(false);
  const [pulse, setPulse] = useState<PulseState>(REST_PULSE);

  // The engine state is the source of truth; this ref lets `tap` read the
  // latest committed state without doing side effects inside a setState updater.
  const stateRef = useRef(state);
  const lockedRef = useRef(false);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optionsRef = useRef(options);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const setLockedBoth = useCallback((value: boolean) => {
    lockedRef.current = value;
    setLocked(value);
  }, []);

  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(
    () => () => {
      if (lockTimer.current) clearTimeout(lockTimer.current);
    },
    [],
  );

  const firePulse = useCallback((strength: number, color: string) => {
    setPulse((p) => ({ signal: p.signal + 1, strength, color }));
  }, []);

  const tap = useCallback(
    (orbId: string) => {
      if (lockedRef.current) return;

      const current = stateRef.current;
      if (current.status !== 'playing') return;

      const outcome = resolveMove(current, orbId);
      if (!outcome.accepted) return;

      stateRef.current = outcome.state;
      setState(outcome.state);

      const color = outcome.movedOrb?.color as OrbColor | undefined;
      if (outcome.kind === 'core') {
        haptics.absorb();
        firePulse(0.5, color ? orbColors[color] : palette.coreGlow);
      } else {
        haptics.select();
      }

      const resolvedSomething =
        outcome.autoResolved.length > 0 || outcome.completedTarget;
      if (resolvedSomething) {
        haptics.targetComplete();
        firePulse(1, palette.coreGlow);
      }

      setLockedBoth(true);
      if (lockTimer.current) clearTimeout(lockTimer.current);
      lockTimer.current = setTimeout(
        () => setLockedBoth(false),
        resolvedSomething ? LOCK_RESOLVE_MS : LOCK_BASE_MS,
      );

      if (outcome.state.status === 'won') {
        haptics.win();
        firePulse(1, palette.success);
        optionsRef.current.onWin?.();
      } else if (outcome.state.status === 'lost') {
        haptics.fail();
        firePulse(0.8, palette.danger);
        optionsRef.current.onLose?.();
      }
    },
    [firePulse, setLockedBoth],
  );

  const restart = useCallback(() => {
    if (lockTimer.current) clearTimeout(lockTimer.current);
    lockTimer.current = null;
    const fresh = createGame(level);
    stateRef.current = fresh;
    setState(fresh);
    setLockedBoth(false);
    setPulse(REST_PULSE);
  }, [level, setLockedBoth]);

  return {
    state,
    locked,
    tap,
    restart,
    pulseSignal: pulse.signal,
    pulseStrength: pulse.strength,
    flashColor: pulse.color,
  };
}
