import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createGame } from '@/game/engine/createGame';
import { resolveLaunch } from '@/game/engine/resolveLaunch';
import type { GameState } from '@/game/engine/types';
import { haptics } from '@/game/haptics';
import { requireLevel } from '@/game/levels/levels';
import { orbColors, palette } from '@/theme/colors';

/**
 * Interaction lock (ms) after an accepted launch. Long enough for the charge
 * flight + pixel sweep to read, short enough to stay responsive; a little
 * longer when a lot clears or parked charges auto-relaunch.
 */
const LOCK_BASE_MS = 240;
const LOCK_BIG_MS = 560;

export interface GameSession {
  state: GameState;
  locked: boolean;
  launch: (tunnelId: string) => void;
  restart: () => void;
  /** Ordered ids of pixels cleared by the most recent move (stagger timing). */
  clearSequence: string[];
  flightSignal: number;
  flightTunnel: number;
  flightColor: string;
  pulseSignal: number;
  pulseColor: string;
}

interface Options {
  onWin?: () => void;
  onLose?: () => void;
}

function tunnelIndex(tunnelId: string): number {
  const n = Number.parseInt(tunnelId.replace('tunnel-', ''), 10);
  return Number.isFinite(n) ? n : 0;
}

export function useGameSession(levelId: number, options: Options = {}): GameSession {
  const level = useMemo(() => requireLevel(levelId), [levelId]);
  const [state, setState] = useState<GameState>(() => createGame(level));
  const [locked, setLocked] = useState(false);
  const [clearSequence, setClearSequence] = useState<string[]>([]);
  const [flight, setFlight] = useState<{
    signal: number;
    tunnel: number;
    color: string;
  }>({ signal: 0, tunnel: 0, color: palette.coreGlow });
  const [pulse, setPulse] = useState<{ signal: number; color: string }>({
    signal: 0,
    color: palette.coreGlow,
  });

  const stateRef = useRef(state);
  const lockedRef = useRef(false);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optionsRef = useRef(options);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    optionsRef.current = options;
  });

  useEffect(
    () => () => {
      if (lockTimer.current) clearTimeout(lockTimer.current);
    },
    [],
  );

  const setLockedBoth = useCallback((value: boolean) => {
    lockedRef.current = value;
    setLocked(value);
  }, []);

  const launch = useCallback(
    (tunnelId: string) => {
      if (lockedRef.current) return;
      const current = stateRef.current;
      if (current.status !== 'playing') return;

      const outcome = resolveLaunch(current, tunnelId);
      if (!outcome.accepted) return;

      stateRef.current = outcome.state;
      setState(outcome.state);

      const chargeColor = outcome.launchedCharge
        ? orbColors[outcome.launchedCharge.color]
        : palette.coreGlow;

      const cleared = [
        ...outcome.primaryClearedPixelIds,
        ...outcome.autoResolutions.flatMap((r) => r.clearedPixelIds),
      ];
      setClearSequence(cleared);
      setFlight((f) => ({
        signal: f.signal + 1,
        tunnel: tunnelIndex(tunnelId),
        color: chargeColor,
      }));

      // Haptics — restrained, and pixel ticks are throttled inside `haptics`.
      haptics.select();
      if (cleared.length > 0) {
        haptics.pixelClear();
        setTimeout(() => haptics.pixelClear(), 130);
      }
      if (outcome.primaryConsumed && outcome.primaryClearedPixelIds.length > 0) {
        haptics.chargeConsumed();
      } else if (outcome.heldCharge) {
        haptics.held();
      }
      if (outcome.autoResolutions.length > 0) {
        haptics.reactivate();
        setPulse((p) => ({ signal: p.signal + 1, color: palette.coreGlow }));
      } else if (cleared.length > 0) {
        setPulse((p) => ({ signal: p.signal + 1, color: chargeColor }));
      }
      if (
        outcome.state.status === 'playing' &&
        outcome.state.holding.length >= outcome.state.holdingCapacity - 1 &&
        current.holding.length < outcome.state.holdingCapacity - 1
      ) {
        haptics.holdingCritical();
      }

      const heavy =
        cleared.length >= 4 || outcome.autoResolutions.length > 0;
      setLockedBoth(true);
      if (lockTimer.current) clearTimeout(lockTimer.current);
      lockTimer.current = setTimeout(
        () => setLockedBoth(false),
        heavy ? LOCK_BIG_MS : LOCK_BASE_MS,
      );

      if (outcome.state.status === 'won') {
        haptics.win();
        setPulse((p) => ({ signal: p.signal + 1, color: palette.success }));
        optionsRef.current.onWin?.();
      } else if (outcome.state.status === 'lost') {
        haptics.fail();
        setPulse((p) => ({ signal: p.signal + 1, color: palette.danger }));
        optionsRef.current.onLose?.();
      }
    },
    [setLockedBoth],
  );

  const restart = useCallback(() => {
    if (lockTimer.current) clearTimeout(lockTimer.current);
    lockTimer.current = null;
    const fresh = createGame(level);
    stateRef.current = fresh;
    setState(fresh);
    setLockedBoth(false);
    setClearSequence([]);
    setFlight({ signal: 0, tunnel: 0, color: palette.coreGlow });
    setPulse({ signal: 0, color: palette.coreGlow });
  }, [level, setLockedBoth]);

  return {
    state,
    locked,
    launch,
    restart,
    clearSequence,
    flightSignal: flight.signal,
    flightTunnel: flight.tunnel,
    flightColor: flight.color,
    pulseSignal: pulse.signal,
    pulseColor: pulse.color,
  };
}
