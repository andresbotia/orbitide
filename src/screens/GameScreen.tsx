import { createGame } from '@/game/engine/createGame';
import { iceLayers } from '@/game/engine/frozen';
import { reachablePixels } from '@/game/engine/pixels';
import type { Point } from '@/game/rendering/boardGeometry';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Easing, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { DebugOverlay } from '@/components/DebugOverlay';
import { DiscoveryOverlay } from '@/components/DiscoveryOverlay';
import { HoldingTray } from '@/components/HoldingTray';
import { Hud } from '@/components/Hud';
import { ResultOverlay } from '@/components/ResultOverlay';
import { ToolBar } from '@/components/ToolBar';
import { TunnelBar } from '@/components/TunnelBar';
import { DiscoveryReveal } from '@/game/rendering/DiscoveryReveal';
import { OrbitBoard } from '@/game/rendering/OrbitBoard';
import { resolveReveal, revealTimeline } from '@/game/rendering/revealGeometry';
import { nextLevelId, requireLevel } from '@/game/levels/levels';
import type { LevelDefinition } from '@/game/engine/types';
import { useColorAssist } from '@/hooks/useColorAssist';
import { useGameSession } from '@/hooks/useGameSession';
import { arcade } from '@/theme/arcade';
import { spacing } from '@/theme/spacing';

interface GameScreenProps {
  levelId: number;
  onWin: (levelId: number) => void;
  onAdvance: (nextLevelId: number) => void;
  onExit: () => void;
  onResetProgress: () => void;
  /**
   * Explicit level to run instead of the campaign lookup for `levelId`. Only the
   * dev-only Level Studio playtest passes this; normal play leaves it undefined.
   */
  level?: LevelDefinition;
}

/**
 * Production Cosmic Arcade gameplay shell. Screen hierarchy, top to bottom:
 *   TOP HUD -> ORBIT / PIXEL-ART BOARD -> HOLDING -> LAUNCH TUNNELS -> TOOLS.
 * On a win the board transforms into the Discovery constellation reveal in
 * place; on a loss the minimal retry overlay is shown. Engine truth is
 * unchanged — the reveal is triggered by, never the trigger of, the win.
 */
export function GameScreen({
  levelId,
  onWin,
  onAdvance,
  onExit,
  onResetProgress,
  level: levelOverride,
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
  const level = useMemo(
    () => levelOverride ?? requireLevel(levelId),
    [levelOverride, levelId],
  );
  const reducedMotion = useReducedMotion();
  const { enabled: colorAssist } = useColorAssist();

  const handleWin = useCallback(() => {
    onWin(levelId);
  }, [levelId, onWin]);

  const session = useGameSession(levelId, { onWin: handleWin, level: levelOverride });
  const { state } = session;
  const won = state.status === 'won';

  // Lightweight, non-modal teaching cue (Level 21's Frozen intro). Shows while
  // the level still has all its ice and the player is in their first few moves;
  // the first successful ice break — or a fourth launch — retires it.
  const initialIced = useMemo(
    () => createGame(level).pixels.filter((p) => iceLayers(p) > 0).length,
    [level],
  );
  const currentIced = state.pixels.filter((p) => iceLayers(p) > 0).length;
  const showTutorial = !!level.tutorial && state.status === 'playing'
    && currentIced >= initialIced && state.movesApplied < 4;

  const reveal = useMemo(() => resolveReveal(level), [level]);
  const revealProgress = useSharedValue(0);
  useEffect(() => {
    if (!won) { revealProgress.set(0); return; }
    revealProgress.set(0);
    revealProgress.set(withTiming(1, {
      duration: revealTimeline(reducedMotion).tailMs,
      easing: Easing.linear,
    }));
  }, [won, reducedMotion, revealProgress]);

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
  // M2B: launching is allowed while charges orbit — only the full rail or a
  // finished level closes the controls.
  const controlsLocked = !session.canLaunch;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.ambient} pointerEvents="none" />

      <View style={styles.hud}>
        <Hud state={state} title={level.title} difficulty={level.difficulty} onRestart={session.restart} />
      </View>

      <View ref={area} collapsable={false} style={styles.boardArea} onLayout={onBoardArea}>
        {boardSize > 0 ? (
          <View style={{ width: boardSize, height: boardSize }}>
            <OrbitBoard
              size={boardSize}
              state={state}
              flights={session.flights}
              presentThrough={session.presentThrough}
              colorAssist={colorAssist}
              reducedMotion={reducedMotion}
            />
            {won ? (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <DiscoveryReveal
                  size={boardSize}
                  level={level}
                  state={state}
                  progress={revealProgress}
                  reducedMotion={reducedMotion}
                />
              </View>
            ) : null}
          </View>
        ) : null}
        {showTutorial ? (
          <View style={styles.tutorial} pointerEvents="none">
            <Text style={styles.tutorialText}>❄  {level.tutorial}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.controls} pointerEvents={won ? 'none' : 'auto'}>
        <HoldingTray
          layoutVersion={boardSize}
          holding={state.holding}
          capacity={state.holdingCapacity}
          overflow={state.status === 'lost'}
          disabled={controlsLocked}
          usefulIds={usefulIds}
          colorAssist={colorAssist}
          onSourceLayout={onSourceLayout}
          onLaunch={(id) => session.launchHeld(id, boardPoint(`holding-${state.holding.findIndex((c) => c.id === id)}`),
            boardPoint(`holding-${state.holding.length - 1}`))}
          message={session.message}
        />

        <TunnelBar
          layoutVersion={boardSize}
          state={state}
          disabled={controlsLocked}
          colorAssist={colorAssist}
          onSourceLayout={onSourceLayout}
          onLaunch={(id) => session.launch(id, boardPoint(id), boardPoint(`holding-${state.holding.length}`))}
        />

        <ToolBar />
      </View>

      {won ? (
        <DiscoveryOverlay
          name={reveal.name}
          source={reveal.source}
          hasNext={next !== undefined}
          progress={revealProgress}
          reducedMotion={reducedMotion}
          onNext={() => next !== undefined && onAdvance(next)}
          onHome={onExit}
        />
      ) : null}

      <ResultOverlay
        status={state.status === 'lost' ? 'lost' : 'playing'}
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
  safe: { flex: 1, backgroundColor: arcade.envBottom, overflow: 'hidden' },
  ambient: {
    position: 'absolute',
    top: -120,
    alignSelf: 'center',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: arcade.envTop,
    opacity: 0.5,
  },
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
    paddingBottom: spacing.md,
    gap: spacing.md,
    alignItems: 'center',
  },
  tutorial: {
    position: 'absolute',
    top: spacing.sm,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: 'rgba(12,20,34,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(200,230,255,0.35)',
  },
  tutorialText: {
    color: '#DCEEFF',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
