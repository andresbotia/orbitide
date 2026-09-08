import { useCallback, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DebugOverlay } from '@/components/DebugOverlay';
import { HoldingTray } from '@/components/HoldingTray';
import { Hud } from '@/components/Hud';
import { ResultOverlay } from '@/components/ResultOverlay';
import { TunnelBar } from '@/components/TunnelBar';
import { OrbitBoard } from '@/game/rendering/OrbitBoard';
import { nextLevelId, requireLevel } from '@/game/levels/levels';
import { useGameSession } from '@/hooks/useGameSession';
import { palette } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

interface GameScreenProps {
  levelId: number;
  onWin: (levelId: number) => void;
  onAdvance: (nextLevelId: number) => void;
  onExit: () => void;
  onResetProgress: () => void;
}

export function GameScreen({
  levelId,
  onWin,
  onAdvance,
  onExit,
  onResetProgress,
}: GameScreenProps) {
  const [boardSize, setBoardSize] = useState(0);
  const level = useMemo(() => requireLevel(levelId), [levelId]);

  const handleWin = useCallback(() => {
    onWin(levelId);
  }, [levelId, onWin]);

  const session = useGameSession(levelId, { onWin: handleWin });
  const { state } = session;

  const onBoardArea = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const size = Math.max(0, Math.min(width, height) - spacing.md);
    setBoardSize(Math.round(size));
  }, []);

  const next = nextLevelId(levelId);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.hud}>
        <Hud state={state} title={level.title} onRestart={session.restart} />
      </View>

      <View style={styles.boardArea} onLayout={onBoardArea}>
        {boardSize > 0 ? (
          <OrbitBoard
            size={boardSize}
            state={state}
            flightSignal={session.flightSignal}
            flightPass={session.flightPass}
            flyingCapacity={session.flyingCapacity}
            shots={session.shots}
            pulseSignal={session.pulseSignal}
            pulseColor={session.pulseColor}
          />
        ) : null}
      </View>

      <View style={styles.controls}>
        <TunnelBar
          state={state}
          disabled={session.locked || state.status !== 'playing'}
          onLaunch={session.launch}
        />
        <HoldingTray
          holding={state.holding}
          capacity={state.holdingCapacity}
          overflow={state.status === 'lost'}
          cue={session.trayCue}
        />
      </View>

      <ResultOverlay
        status={state.status}
        hasNextLevel={next !== undefined}
        onNext={() => next !== undefined && onAdvance(next)}
        onRetry={session.restart}
        onHome={onExit}
      />

      <DebugOverlay
        state={session.engineState}
        locked={session.locked}
        onResetProgress={onResetProgress}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.void },
  hud: { paddingTop: spacing.sm, paddingBottom: spacing.sm },
  boardArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  controls: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
    alignItems: 'center',
  },
});
