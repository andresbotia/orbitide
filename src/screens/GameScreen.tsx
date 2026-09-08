import { reachablePixels } from '@/game/engine/pixels';
import type { Point } from '@/game/presentation/events';
import { useCallback, useMemo, useRef, useState } from 'react';
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
  const area = useRef<View>(null);
  const boardOrigin = useRef<Point>({ x: 0, y: 0 });
  const sourcePoints = useRef(new Map<string, Point>());
  const onSourceLayout = useCallback((key: string, point: Point) => { sourcePoints.current.set(key, point); }, []);
  const boardPoint = (key: string): Point | undefined => {
    const point = sourcePoints.current.get(key);
    return point ? { x: point.x - boardOrigin.current.x, y: point.y - boardOrigin.current.y } : undefined;
  };
  const level = useMemo(() => requireLevel(levelId), [levelId]);

  const handleWin = useCallback(() => {
    onWin(levelId);
  }, [levelId, onWin]);

  const session = useGameSession(levelId, { onWin: handleWin });
  const { state } = session;

  const onBoardArea = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const size = Math.max(0, Math.min(width, height) - spacing.md);
    const rounded = Math.round(size);
    setBoardSize(rounded);
    area.current?.measureInWindow((x, y) => {
      boardOrigin.current = { x: x + (width - rounded) / 2, y: y + (height - rounded) / 2 };
    });
  }, []);

  const colors = new Set(reachablePixels(state).map((p) => p.color));
  const usefulIds = new Set(state.holding.filter((c) => colors.has(c.color)).map((c) => c.id));
  const next = nextLevelId(levelId);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.hud}>
        <Hud state={state} title={level.title} onRestart={session.restart} />
      </View>

      <View ref={area} collapsable={false} style={styles.boardArea} onLayout={onBoardArea}>
        {boardSize > 0 ? (
          <OrbitBoard
            size={boardSize}
            state={state}
            flightPass={session.flightPass}
            presentThrough={session.presentThrough}
          />
        ) : null}
      </View>

      <View style={styles.controls}>
        <TunnelBar
          layoutVersion={boardSize}
          state={state}
          disabled={session.locked || state.status !== 'playing'}
          onSourceLayout={onSourceLayout}
          onLaunch={(id) => session.launch(id, boardPoint(id), boardPoint(`holding-${state.holding.length}`))}
        />
        <HoldingTray
          layoutVersion={boardSize}
          holding={state.holding}
          capacity={state.holdingCapacity}
          overflow={state.status === 'lost'}
          disabled={session.locked || state.status !== 'playing'}
          usefulIds={usefulIds}
          onSourceLayout={onSourceLayout}
          onLaunch={(id) => session.launchHeld(id, boardPoint(`holding-${state.holding.findIndex((c) => c.id === id)}`),
            boardPoint(`holding-${state.holding.length - 1}`))}
          message={session.message}
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
    zIndex: 1,
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
