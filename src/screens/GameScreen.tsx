import { createGame } from '@/game/engine/createGame';
import { iceLayers, shieldLayers } from '@/game/engine/frozen';
import { linkedGroupId } from '@/game/engine/linked';
import { reachablePixels } from '@/game/engine/pixels';
import type { Point } from '@/game/rendering/boardGeometry';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withSequence, withTiming,
} from 'react-native-reanimated';

import { BoardFrame } from '@/components/gameplay/BoardFrame';
import { ControlDeck } from '@/components/gameplay/ControlDeck';
import { GameplayEnvironment } from '@/components/gameplay/GameplayEnvironment';
import { DebugOverlay } from '@/components/DebugOverlay';
import { DiscoveryOverlay } from '@/components/DiscoveryOverlay';
import { Hud } from '@/components/Hud';
import { ResultOverlay } from '@/components/ResultOverlay';
import { TutorialCoach } from '@/components/TutorialCoach';
import { CoreV2Board } from '@/game/rendering/CoreV2Board';
import { DiscoveryReveal } from '@/game/rendering/DiscoveryReveal';
import { OrbitBoard } from '@/game/rendering/OrbitBoard';
import { resolveReveal, revealTimeline, type CelebrationTier } from '@/game/rendering/revealGeometry';
import { CAMPAIGN_MANIFEST } from '@/game/levels/campaign';
import { nextLevelId, requireLevel } from '@/game/levels/levels';
import { isCoreV2 } from '@/game/engine/ruleset';
import type { LevelDefinition } from '@/game/engine/types';
import { useAmbientActive } from '@/hooks/useAmbientActive';
import { useColorAssist } from '@/hooks/useColorAssist';
import { useGameSession } from '@/hooks/useGameSession';
import { useTutorialCompletion } from '@/hooks/useTutorialCompletion';
import { GAMEPLAY } from '@/theme/gameplayLayout';
import { homeV2 } from '@/theme/homeV2';
import { material } from '@/theme/material';
import { worldSkin } from '@/theme/worldSkins';

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
 * Production Pixel Arcadia gameplay shell (UI-R3 — Cosmic Arcade materials
 * removed; `OrbitBoard`'s concurrency architecture and all engine/session
 * logic below are unchanged). Screen hierarchy, top to bottom:
 *   TOP HUD -> BOARD / RAIL -> CONTROL DECK (ACTIVE / HOLDING / TUNNELS).
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
  const [boardBox, setBoardBox] = useState({ width: 0, height: 0 });
  const boardSize = Math.max(boardBox.width, boardBox.height);
  const boardWrap = useRef<View>(null);
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
  const active = useAmbientActive();
  const skin = worldSkin(level.themeId);
  const worldAccent = skin.accent;
  const { enabled: colorAssist } = useColorAssist();

  // UI-R6 celebration tier — derived from the same campaign manifest World
  // Select/World Levels already use, not a new progression rule: a capstone
  // is simply the last level in its world's `levelIds`; the finale is World
  // 10's capstone. Presentation-only, computed fresh from `level.id`.
  const { worldTitle, tier } = useMemo<{ worldTitle: string; tier: CelebrationTier }>(() => {
    const order = CAMPAIGN_MANIFEST.worlds.findIndex((w) => w.levelIds.includes(level.id));
    const world = CAMPAIGN_MANIFEST.worlds[order];
    if (!world) return { worldTitle: '', tier: 'normal' };
    const isCapstone = world.levelIds[world.levelIds.length - 1] === level.id;
    const isFinale = isCapstone && order === CAMPAIGN_MANIFEST.worlds.length - 1;
    return { worldTitle: world.title, tier: isFinale ? 'finale' : isCapstone ? 'capstone' : 'normal' };
  }, [level.id]);

  const handleWin = useCallback(() => {
    onWin(levelId);
  }, [levelId, onWin]);

  const tutorials = useTutorialCompletion();
  const session = useGameSession(levelId, {
    onWin: handleWin,
    level: levelOverride,
    completedTutorials: tutorials.ready ? tutorials.completed : null,
    onTutorialComplete: tutorials.markComplete,
  });
  const { state, launch, launchHeld } = session;
  const won = state.status === 'won';
  const holdingCapacity = state.holdingCapacity;
  const holding = state.holding;
  const launchTunnelPal = useCallback((id: string) => {
    const slots = Array.from({ length: holdingCapacity }, (_, index) => boardPoint(`holding-${index}`));
    launch(id, boardPoint(id), slots);
  }, [launch, holdingCapacity]);
  const launchHeldPal = useCallback((id: string) => {
    const slots = Array.from({ length: holdingCapacity }, (_, index) => boardPoint(`holding-${index}`));
    launchHeld(
      id,
      boardPoint(`holding-${holding.findIndex((c) => c.id === id)}`),
      slots,
    );
  }, [launchHeld, holding, holdingCapacity]);

  // Lightweight, non-modal teaching cue (Level 21's Frozen intro). Shows while
  // the level still has all its ice and the player is in their first few moves;
  // the first successful ice break — or a fourth launch — retires it.
  const initialTutorialState = useMemo(() => {
    const pixels = createGame(level).pixels;
    const linkedGroups = new Set(pixels.map(linkedGroupId).filter((group): group is string => group !== undefined));
    return {
      protectedCount: pixels.filter((p) => iceLayers(p) > 0 || shieldLayers(p) > 0).length,
      linkedGroups,
    };
  }, [level]);
  const currentLinkedGroups = useMemo(
    () => new Set(state.pixels.filter((p) => !p.cleared).map(linkedGroupId)
      .filter((group): group is string => group !== undefined)),
    [state.pixels],
  );
  const currentProtected = state.pixels.filter((p) => iceLayers(p) > 0 || shieldLayers(p) > 0).length;
  const tutorialProgressPending = initialTutorialState.linkedGroups.size > 0
    ? currentLinkedGroups.size >= initialTutorialState.linkedGroups.size
    : currentProtected >= initialTutorialState.protectedCount;
  const tutorialIcon = initialTutorialState.linkedGroups.size > 0 ? '⋈'
    : createGame(level).pixels.some((p) => shieldLayers(p) > 0) ? '◌' : '❄';
  const showTutorial = !!level.tutorial && state.status === 'playing'
    && tutorialProgressPending && state.movesApplied < 4;

  const reveal = useMemo(() => resolveReveal(level), [level]);
  const revealProgress = useSharedValue(0);
  useEffect(() => {
    if (!won) { revealProgress.set(0); return; }
    revealProgress.set(0);
    revealProgress.set(withTiming(1, {
      duration: revealTimeline(reducedMotion, tier).tailMs,
      easing: Easing.linear,
    }));
  }, [won, reducedMotion, tier, revealProgress]);

  // A brief warm handoff pulse on the board frame right as the win happens —
  // NOT the win celebration itself (that stays DiscoveryOverlay/DiscoveryReveal's
  // job, untouched). Ramps up and holds; `useFocusEffect`-free since a level
  // remount (restart/advance) naturally resets the shared value's owner.
  // Capstone/finale ramp a little higher — `BoardFrame`'s glow/aura formulas
  // are unbounded-above by design, so this reads as a stronger (not clipped)
  // pulse without touching `BoardFrame.tsx` itself.
  const celebrateTarget = tier === 'finale' ? 1.4 : tier === 'capstone' ? 1.15 : 1;
  const celebrate = useSharedValue(0);
  useEffect(() => {
    celebrate.set(withTiming(won ? celebrateTarget : 0, { duration: won ? 260 : 0, easing: Easing.out(Easing.cubic) }));
  }, [won, celebrateTarget, celebrate]);

  // A brief warning-edge pulse on failure — local to this screen, not a
  // `BoardFrame` prop (that channel is reserved for the warm win handoff and
  // would be the wrong color language for a danger state). One quick flash,
  // not a shake and not a persistent dim — retry stays immediate.
  const lost = state.status === 'lost';
  const failPulse = useSharedValue(0);
  useEffect(() => {
    if (!lost) { failPulse.set(0); return; }
    failPulse.set(reducedMotion
      ? withTiming(0.5, { duration: 120 })
      : withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 420 })));
  }, [lost, reducedMotion, failPulse]);
  const failPulseStyle = useAnimatedStyle(() => ({ opacity: failPulse.value * 0.7 }));

  // Gameplay -> Results (UI-R7): controls used to hard-cut opacity 1 -> 0 the
  // instant `won` flipped. A quick cross-fade instead — short enough not to
  // delay `DiscoveryOverlay`'s own entrance (which is already timed off the
  // reveal progress, not this).
  const controlsFade = useSharedValue(1);
  useEffect(() => {
    controlsFade.set(withTiming(won ? 0 : 1, { duration: reducedMotion ? 90 : 180 }));
  }, [won, reducedMotion, controlsFade]);
  const controlsFadeStyle = useAnimatedStyle(() => ({ opacity: controlsFade.value }));

  const onBoardArea = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const availW = Math.max(0, width - GAMEPLAY.boardSidePad * 2);
    const availH = Math.max(0, height - GAMEPLAY.boardDeckGap);
    if (isCoreV2(state.ruleset)) {
      setBoardBox({ width: Math.round(availW), height: Math.round(availH) });
    } else {
      const size = Math.max(0, Math.round(Math.min(availW, availH)));
      setBoardBox({ width: size, height: size });
    }
  }, [state.ruleset]);

  const onBoardLayout = useCallback(() => {
    boardWrap.current?.measureInWindow((x, y) => {
      boardOrigin.current = { x, y };
    });
  }, []);

  const usefulIds = useMemo(() => {
    const colors = new Set(reachablePixels(state).map((p) => p.color));
    return new Set(holding.filter((c) => colors.has(c.color)).map((c) => c.id));
  // View state is a new object on every shot; pixels/holding are the inputs that matter.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.pixels, holding, state.width, state.height]);
  const next = nextLevelId(levelId);
  // M2B: launching is allowed while charges orbit — only the full rail or a
  // finished level closes the controls.
  const controlsLocked = !session.canLaunch;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <GameplayEnvironment
        worldAccent={worldAccent}
        worldSecondaryAccent={skin.secondaryAccent}
        ambientId={skin.ambientId}
        active={active}
        reducedMotion={reducedMotion}
      />

      <Hud
        state={state}
        title={level.title}
        difficulty={level.difficulty}
        onRestart={session.restart}
        onHome={onExit}
      />

      <View collapsable={false} style={styles.boardArea} onLayout={onBoardArea}>
        {boardBox.width > 0 ? (
          <View
            ref={boardWrap}
            collapsable={false}
            onLayout={onBoardLayout}
            style={{ overflow: 'visible' }}
          >
            <BoardFrame
              size={boardSize}
              worldAccent={worldAccent}
              active={active}
              reducedMotion={reducedMotion}
              celebrate={celebrate}
            />
            {isCoreV2(state.ruleset) ? (
              <CoreV2Board
                size={boardSize}
                width={boardBox.width}
                height={boardBox.height}
                state={state}
                flights={session.flights}
                presentThrough={session.presentThrough}
                colorAssist={colorAssist}
                reducedMotion={reducedMotion}
              />
            ) : (
              <OrbitBoard
                size={boardSize}
                state={state}
                flights={session.flights}
                presentThrough={session.presentThrough}
                colorAssist={colorAssist}
                reducedMotion={reducedMotion}
              />
            )}
            {won ? (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <DiscoveryReveal
                  size={boardSize}
                  width={boardBox.width}
                  height={boardBox.height}
                  level={level}
                  state={state}
                  progress={revealProgress}
                  reducedMotion={reducedMotion}
                  tier={tier}
                />
              </View>
            ) : null}
            <Animated.View pointerEvents="none" style={[styles.failRing, failPulseStyle]} />
          </View>
        ) : null}
        {showTutorial ? (
          <View style={styles.tutorial} pointerEvents="none">
            <Text style={styles.tutorialText}>{tutorialIcon}  {level.tutorial}</Text>
          </View>
        ) : null}
        <TutorialCoach tutorial={session.tutorial} />
      </View>

      <Animated.View style={[styles.controls, controlsFadeStyle]} pointerEvents={won ? 'none' : 'auto'}>
        <ControlDeck
          state={state}
          activeCount={session.activeCount}
          activeCapacity={isCoreV2(state.ruleset) ? session.activeCapacity : 0}
          layoutVersion={boardBox.width + boardBox.height}
          disabled={controlsLocked}
          usefulIds={usefulIds}
          colorAssist={colorAssist}
          pixelPal={isCoreV2(state.ruleset)}
          onSourceLayout={onSourceLayout}
          onLaunchTunnel={launchTunnelPal}
          onLaunchHeld={launchHeldPal}
          message={session.message}
          tutorial={session.tutorial}
        />
      </Animated.View>

      {won ? (
        <DiscoveryOverlay
          name={reveal.name}
          source={reveal.source}
          levelId={levelId}
          worldTitle={worldTitle}
          tier={tier}
          hasNext={next !== undefined}
          progress={revealProgress}
          reducedMotion={reducedMotion}
          onNext={() => next !== undefined && onAdvance(next)}
          onHome={onExit}
        />
      ) : null}

      <ResultOverlay
        visible={lost}
        reason={state.holding.length >= state.holdingCapacity ? 'holdingFull' : 'noMoves'}
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
  safe: { flex: 1, backgroundColor: homeV2.deepNavy, overflow: 'hidden' },
  boardArea: {
    flex: 1,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: GAMEPLAY.boardSidePad,
    paddingBottom: GAMEPLAY.boardDeckGap,
  },
  controls: {
    width: '100%',
    alignItems: 'stretch',
  },
  failRing: {
    position: 'absolute',
    top: -2, left: -2, right: -2, bottom: -2,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: material.danger,
  },
  tutorial: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    maxWidth: '96%',
    zIndex: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: material.overlay,
    borderWidth: 1,
    borderColor: 'rgba(77,225,255,0.35)',
  },
  tutorialText: {
    color: material.textPrimary,
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: -0.1,
    textAlign: 'center',
  },
});
