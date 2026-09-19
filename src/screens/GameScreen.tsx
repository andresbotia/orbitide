import { createGame } from '@/game/engine/createGame';
import { iceLayers, shieldLayers } from '@/game/engine/frozen';
import { linkedGroupId } from '@/game/engine/linked';
import { isPixelReachable, remainingPixelCount, renderExteriorMask } from '@/game/engine/pixels';
import type { Point } from '@/game/rendering/boardGeometry';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming,
} from 'react-native-reanimated';

import { ControlDeck } from '@/components/gameplay/ControlDeck';
import { LEVEL_INTRO_MIN_MS, LevelIntro } from '@/components/gameplay/LevelIntro';
import { GameplayEnvironment } from '@/components/gameplay/GameplayEnvironment';
import { DebugOverlay } from '@/components/DebugOverlay';
import { DiscoveryOverlay } from '@/components/DiscoveryOverlay';
import { Hud } from '@/components/Hud';
import { RESULT_BEAT_MS, ResultOverlay } from '@/components/ResultOverlay';
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
import { GP, GP_RADIUS, GP_TYPE } from '@/theme/gameplayUi';
import { GP_MOTION } from '@/theme/gameplayMotion';
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

const EMPTY_USEFUL_IDS = new Set<string>();

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
    return launch(id, boardPoint(id), slots);
  }, [launch, holdingCapacity]);

  const launchHeldPal = useCallback((id: string) => {
    const slots = Array.from({ length: holdingCapacity }, (_, index) => boardPoint(`holding-${index}`));
    return launchHeld(
      id,
      boardPoint(`holding-${holding.findIndex((c) => c.id === id)}`),
      slots,
    );
  }, [launchHeld, holding, holdingCapacity]);

  // Lightweight, non-modal teaching cue (Level 21's Frozen intro). Shows while
  // the level still has all its ice and the player is in their first few moves;
  // the first successful ice break — or a fourth launch — retires it.
  // Performance: only initialized on levels that actually specify a tutorial.
  const initialTutorialState = useMemo(() => {
    if (!level.tutorial) return null;
    const pixels = createGame(level).pixels;
    const linkedGroups = new Set(pixels.map(linkedGroupId).filter((group): group is string => group !== undefined));
    const hasShields = pixels.some((p) => shieldLayers(p) > 0);
    return {
      protectedCount: pixels.filter((p) => iceLayers(p) > 0 || shieldLayers(p) > 0).length,
      linkedGroups,
      hasShields,
    };
  }, [level]);

  const showTutorial = useMemo(() => {
    if (!initialTutorialState || state.status !== 'playing' || state.movesApplied >= 4) return false;
    if (initialTutorialState.linkedGroups.size > 0) {
      let activeLinked = 0;
      for (const p of state.pixels) {
        if (!p.cleared && linkedGroupId(p) !== undefined) activeLinked++;
      }
      return activeLinked >= initialTutorialState.linkedGroups.size;
    }
    const currentProtected = state.pixels.filter((p) => iceLayers(p) > 0 || shieldLayers(p) > 0).length;
    return currentProtected >= initialTutorialState.protectedCount;
  }, [initialTutorialState, state.status, state.movesApplied, state.pixels]);

  const tutorialIcon = initialTutorialState?.linkedGroups.size && initialTutorialState.linkedGroups.size > 0
    ? '⋈'
    : initialTutorialState?.hasShields ? '◌' : '❄';

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

  // Failure beat: the danger-edge pulse fires on the reject burst itself (the
  // rejecting Pal's clock, `RejectPulse`). When the loss is presented the board
  // dims over the same beat `ResultOverlay` waits before entering, so the modal
  // arrives on a settled, dimmed board — never on top of motion.
  const lost = state.status === 'lost';
  const failDim = useSharedValue(0);
  useEffect(() => {
    failDim.set(lost
      ? withTiming(1, { duration: reducedMotion ? 120 : RESULT_BEAT_MS, easing: Easing.out(Easing.quad) })
      : withTiming(0, { duration: reducedMotion ? 0 : 160 }));
  }, [lost, reducedMotion, failDim]);
  const failDimStyle = useAnimatedStyle(() => ({ opacity: failDim.value * 0.5 }));

  // Gameplay -> Results (UI-R7): controls used to hard-cut opacity 1 -> 0 the
  // instant `won` flipped. A quick cross-fade instead — short enough not to
  // delay `DiscoveryOverlay`'s own entrance (which is already timed off the
  // reveal progress, not this).
  const controlsFade = useSharedValue(1);
  useEffect(() => {
    controlsFade.set(withTiming(won ? 0 : 1, { duration: reducedMotion ? 90 : 180 }));
  }, [won, reducedMotion, controlsFade]);
  const controlsFadeStyle = useAnimatedStyle(() => ({ opacity: controlsFade.value }));

  // Board (re)entry: settles in as the intro lifts and re-arms on retry.
  // Opacity only — a transform here would skew `boardWrap`'s measured origin,
  // which launch and Holding coordinates are converted against.
  const boardEntry = useSharedValue(0);
  const armBoard = useCallback(() => {
    boardEntry.set(0);
    boardEntry.set(withTiming(1, {
      duration: reducedMotion ? GP_MOTION.reducedFadeMs : GP_MOTION.boardEntryMs,
      easing: Easing.out(Easing.quad),
    }));
  }, [boardEntry, reducedMotion]);
  const boardEntryStyle = useAnimatedStyle(() => ({ opacity: 0.45 + boardEntry.value * 0.55 }));
  const { restart } = session;
  const handleRestart = useCallback(() => {
    restart();
    armBoard();
  }, [restart, armBoard]);

  // NEXT fades the whole screen to the intro's navy BEFORE navigating, so
  // win -> next level's intro -> board reads as one continuous field.
  const exitFade = useSharedValue(0);
  const leaving = useRef(false);
  const exitStyle = useAnimatedStyle(() => ({ opacity: exitFade.value }));

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

  // ---- Gameplay readiness ------------------------------------------------
  // "Ready" is not a timer. It is: the level resolved, the session built (both
  // synchronous, above), tutorial persistence settled, the board area measured,
  // the geometry valid, and the board subtree having actually laid out and
  // produced a frame. Until all of that holds, `LevelIntro` covers the screen,
  // because the first committed frame is otherwise the HUD and deck over an
  // empty board area.
  const [boardPainted, setBoardPainted] = useState(false);
  const [minIntroElapsed, setMinIntroElapsed] = useState(false);
  const [readyTimedOut, setReadyTimedOut] = useState(false);
  const [introDone, setIntroDone] = useState(false);

  useEffect(() => {
    const minimum = setTimeout(() => setMinIntroElapsed(true), LEVEL_INTRO_MIN_MS);
    // Failsafe, not a delay: nothing in the readiness chain is allowed to strand
    // the player on the card — not a layout edge case that never fires
    // `onLayout`, not slow tutorial persistence. It has no effect on the normal
    // path, which lifts well inside this.
    const failsafe = setTimeout(() => setReadyTimedOut(true), 2500);
    return () => { clearTimeout(minimum); clearTimeout(failsafe); };
  }, []);

  const onBoardLayout = useCallback(() => {
    boardWrap.current?.measureInWindow((x, y) => {
      boardOrigin.current = { x, y };
    });
    // The board has been laid out. One more frame guarantees it has been drawn
    // before the intro lifts, so the player never sees a partial board.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setBoardPainted(true));
    });
  }, []);

  const usefulIds = useMemo(() => {
    if (holding.length === 0) return EMPTY_USEFUL_IDS;
    if (isCoreV2(state.ruleset)) {
      const colors = new Set<string>();
      for (const p of state.pixels) {
        if (!p.cleared) colors.add(p.color);
      }
      return new Set(holding.filter((c) => colors.has(c.color)).map((c) => c.id));
    }
    // Render-only reachability: presented states must not fill the engine's shape cache.
    const mask = renderExteriorMask(state);
    const colors = new Set(state.pixels.filter((p) => !p.cleared && isPixelReachable(mask, p)).map((p) => p.color));
    return new Set(holding.filter((c) => colors.has(c.color)).map((c) => c.id));
  // View state is a new object on every shot; pixels/holding are the inputs that matter.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.pixels, holding, state.width, state.height, state.ruleset]);
  const next = nextLevelId(levelId);
  const gameplayReady = (
    boardPainted && boardBox.width > 0 && boardSize > 0 && tutorials.ready
  ) || readyTimedOut;
  const introVisible = !introDone;
  const handleIntroDone = useCallback(() => setIntroDone(true), []);
  const introLifting = gameplayReady && minIntroElapsed;
  useEffect(() => {
    if (introLifting) armBoard();
  }, [introLifting, armBoard]);
  const handleNext = useCallback(() => {
    if (next === undefined || leaving.current) return;
    leaving.current = true;
    exitFade.set(withTiming(1, {
      duration: reducedMotion ? GP_MOTION.reducedFadeMs : GP_MOTION.exitFadeMs,
      easing: Easing.in(Easing.quad),
    }, (finished) => {
      if (finished) runOnJS(onAdvance)(next);
    }));
  }, [next, onAdvance, exitFade, reducedMotion]);
  const total = state.pixels.length;
  const cleared = total - remainingPixelCount(state);
  // M2B: launching is allowed while charges orbit. Only a finished level
  // (presented or already decided in truth) disables the controls; a full rail
  // only makes them LOOK blocked, so a tap there reaches the session and gets
  // its "rail is full" refusal feedback instead of silently doing nothing.
  const controlsLocked = state.status !== 'playing' || session.engineState.status !== 'playing';
  const railFull = !controlsLocked && !session.canLaunch;
  const capacityRefusalSeq = session.lastDenial?.reason === 'activeFull' ? session.lastDenial.seq : 0;

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
        levelId={state.levelId}
        cleared={cleared}
        total={total}
        onRestart={handleRestart}
        onHome={onExit}
      />

      <View collapsable={false} style={styles.boardArea} onLayout={onBoardArea}>
        {boardBox.width > 0 ? (
          // Restrained board frame — a single ink panel + hairline cyan border
          // so the board reads as sitting inside the same machine as the HUD/
          // deck, not floating. `boardWrap` (measured for launch/holding
          // coordinates) is unchanged and has no padding of its own; this is a
          // new, uninvolved parent, so `boardOrigin` still measures the
          // board's own true position.
          <Animated.View style={[styles.boardFrame, boardEntryStyle]}>
            <View pointerEvents="none" style={styles.boardLitEdge} />
            <View
              ref={boardWrap}
              collapsable={false}
              onLayout={onBoardLayout}
              style={{ overflow: 'visible' }}
            >
              {isCoreV2(state.ruleset) ? (
                <CoreV2Board
                  size={boardSize}
                  width={boardBox.width}
                  height={boardBox.height}
                  state={state}
                  flights={session.flights}
                  landingFlights={session.landingFlights}
                  presentThrough={session.presentThrough}
                  colorAssist={colorAssist}
                  reducedMotion={reducedMotion}
                />
              ) : (
                <OrbitBoard
                  size={boardSize}
                  state={state}
                  flights={session.flights}
                  landingFlights={session.landingFlights}
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
              <Animated.View pointerEvents="none" style={[styles.failDim, failDimStyle]} />
            </View>
          </Animated.View>
        ) : null}
        {showTutorial ? (
          <View style={styles.tutorial} pointerEvents="none">
            <View style={styles.tutorialEdge} />
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
          blocked={railFull}
          capacityRefusalSeq={capacityRefusalSeq}
          usefulIds={usefulIds}
          colorAssist={colorAssist}
          pixelPal={isCoreV2(state.ruleset)}
          onSourceLayout={onSourceLayout}
          onLaunchTunnel={launchTunnelPal}
          onLaunchHeld={launchHeldPal}
          denial={session.lastDenial}
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
          onNext={handleNext}
          onHome={onExit}
        />
      ) : null}

      <ResultOverlay
        visible={lost}
        reason={state.holding.length >= state.holdingCapacity ? 'holdingFull' : 'noMoves'}
        onRetry={handleRestart}
        onHome={onExit}
      />

      <DebugOverlay
        state={session.engineState}
        locked={session.locked}
        onResetProgress={onResetProgress}
      />

      {introVisible ? (
        <LevelIntro
          levelId={levelId}
          title={level.title}
          ready={gameplayReady && minIntroElapsed}
          reducedMotion={reducedMotion}
          onDone={handleIntroDone}
        />
      ) : null}

      <Animated.View pointerEvents="none" style={[styles.exitFade, exitStyle]} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: GP.canvas, overflow: 'hidden' },
  boardArea: {
    flex: 1,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: GAMEPLAY.boardSidePad,
    paddingBottom: GAMEPLAY.boardDeckGap,
  },
  // One thin ink panel + hairline + a lit top edge — the same "lit edge"
  // motif as the deck and panels, not a cabinet. No shadow/blur: free per frame.
  boardFrame: {
    padding: 2,
    borderRadius: GP_RADIUS.panel,
    backgroundColor: GP.wellDeep,
    borderWidth: 1,
    borderColor: GP.hairline,
  },
  boardLitEdge: {
    position: 'absolute',
    top: -1,
    left: 28,
    right: 28,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: GP.litEdge,
  },
  controls: {
    width: '100%',
    alignItems: 'stretch',
  },
  failDim: {
    position: 'absolute',
    top: -2, left: -2, right: -2, bottom: -2,
    borderRadius: 18,
    backgroundColor: GP.canvas,
  },
  exitFade: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: GP.canvas,
    zIndex: 200,
  },
  tutorial: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    maxWidth: '94%',
    zIndex: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: GP.panel,
    borderWidth: 1,
    borderColor: GP.hairlineStrong,
  },
  tutorialEdge: {
    position: 'absolute',
    top: -1,
    left: 16,
    right: 16,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: GP.cyan,
  },
  tutorialText: {
    ...GP_TYPE.body,
    color: GP.text,
    textAlign: 'center',
  },
});
