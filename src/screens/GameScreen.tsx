import { useCallback, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DebugOverlay } from '@/components/DebugOverlay';
import { HoldingTray } from '@/components/HoldingTray';
import { Hud } from '@/components/Hud';
import { ResultOverlay } from '@/components/ResultOverlay';
import { OrbitBoard } from '@/game/rendering/OrbitBoard';
import { nextLevelId } from '@/game/levels/levels';
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
        <Hud state={state} onRestart={session.restart} />
      </View>

      <View style={styles.boardArea} onLayout={onBoardArea}>
        {boardSize > 0 ? (
          <OrbitBoard
            size={boardSize}
            state={state}
            locked={session.locked}
            onTapOrb={session.tap}
            pulseSignal={session.pulseSignal}
            pulseStrength={session.pulseStrength}
            flashColor={session.flashColor}
          />
        ) : null}
      </View>

      <View style={styles.tray}>
        <HoldingTray
          holding={state.holding}
          capacity={state.holdingCapacity}
          overflow={state.status === 'lost'}
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
        state={state}
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
  tray: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
