import { createGame } from '@/game/engine/createGame';
import { iceLayers, shieldLayers } from '@/game/engine/frozen';
import { linkedGroupId } from '@/game/engine/linked';
import { isPixelReachable, remainingPixelCount, renderExteriorMask } from '@/game/engine/pixels';
import { cellCenter, computeBoardGeometry, type Point } from '@/game/rendering/boardGeometry';
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
import { BombDetonationFlash, BombTargetingOverlay } from '@/components/gameplay/BombTargetingOverlay';
import { RestockModal } from '@/components/gameplay/RestockModal';
import { CoreV2Board } from '@/game/rendering/CoreV2Board';
import { DiscoveryReveal } from '@/game/rendering/DiscoveryReveal';
import { OrbitBoard } from '@/game/rendering/OrbitBoard';
import { resolveReveal, revealTimeline, type CelebrationTier } from '@/game/rendering/revealGeometry';
import { CAMPAIGN_MANIFEST } from '@/game/levels/campaign';
import { nextLevelId, requireLevel } from '@/game/levels/levels';
import { isCoreV2 } from '@/game/engine/ruleset';
import type { LevelDefinition } from '@/game/engine/types';
import { type GameplayItemId } from '@/game/economy/config';
import { feedback } from '@/game/feedback';
import { useColorAssist } from '@/hooks/useColorAssist';
import { useEconomy } from '@/hooks/useEconomy';
import { useGameSession } from '@/hooks/useGameSession';
import { useTutorialCompletion } from '@/hooks/useTutorialCompletion';
import { GAMEPLAY } from '@/theme/gameplayLayout';
import { GP, GP_TYPE } from '@/theme/gameplayUi';
import { GP_MOTION } from '@/theme/gameplayMotion';

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

  const economyApi = useEconomy();
  const [earnedCoins, setEarnedCoins] = useState<number | undefined>(undefined);
  const [restockItem, setRestockItem] = useState<GameplayItemId | null>(null);
  const [bombFlash, setBombFlash] = useState<{ point: Point; size: number } | null>(null);

  const handleWin = useCallback(async () => {
    const res = await economyApi.settleFirstClear(levelId);
    if (res.awarded) {
      setEarnedCoins(res.reward);
    }
    onWin(levelId);
  }, [levelId, onWin, economyApi]);

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
    setEarnedCoins(undefined);
    setBombFlash(null);
    restart();
    armBoard();
  }, [restart, armBoard]);

  const controlsLocked = state.status !== 'playing';

  const handleItemPress = useCallback(async (itemId: GameplayItemId) => {
    if (controlsLocked) return;

    if (itemId === 'undo') {
      if (economyApi.hasItem('undo')) {
        if (session.canUndo) {
          const success = session.undo();
          if (success) {
            await economyApi.consumeItem('undo');
          } else {
            feedback.emit('denied');
          }
        } else {
          feedback.emit('denied');
        }
      } else {
        setRestockItem('undo');
      }
    } else if (itemId === 'extraSlot') {
      if (economyApi.hasItem('extraSlot')) {
        if (session.extraSlotActive || session.state.holdingCapacity >= 4) {
          feedback.emit('denied');
        } else {
          const success = session.activateExtraSlot();
          if (success) {
            await economyApi.consumeItem('extraSlot');
          } else {
            feedback.emit('denied');
          }
        }
      } else {
        setRestockItem('extraSlot');
      }
    } else if (itemId === 'bomb') {
      if (economyApi.hasItem('bomb')) {
        session.armBomb();
      } else {
        setRestockItem('bomb');
      }
    }
  }, [controlsLocked, economyApi, session]);

  const handleBombTarget = useCallback(async (target: Point) => {
    if (!economyApi.hasItem('bomb')) {
      session.cancelBomb();
      setRestockItem('bomb');
      return;
    }

    const outcome = session.triggerBomb(target);
    if (outcome.accepted) {
      await economyApi.consumeItem('bomb');

      const availW = boardBox.width;
      const availH = boardBox.height;
      const geo = computeBoardGeometry(Math.max(availW, availH), state.width, state.height, {
        roundedRect: isCoreV2(state.ruleset),
        box: { width: availW, height: availH },
      });
      const center = cellCenter(geo, target.x, target.y);
      setBombFlash({ point: center, size: geo.cell * 3 + 12 });
      setTimeout(() => setBombFlash(null), 300);
    }
  }, [economyApi, session, boardBox.width, boardBox.height, state.width, state.height, state.ruleset]);

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

  // Which held Pals read as useful. This MUST be computed from engine truth,
  // not from the presented board: admission (`actionRejection`) runs against
  // truth, and presentation lags it by up to a full lap while Pals are in the
  // air. Reading the presented board let the tray show a Pal as usable that the
  // engine would refuse (and dim one it would accept) — on Legacy V1, where a
  // held relaunch is only legal with an exposed matching target, that made the
  // affordance an outright lie. Measured: 22 disagreements in a 1,179-tap fuzz.
  const truthState = session.engineState;
  const usefulIds = useMemo(() => {
    if (holding.length === 0) return EMPTY_USEFUL_IDS;
    if (isCoreV2(truthState.ruleset)) {
      const colors = new Set<string>();
      for (const p of truthState.pixels) {
        if (!p.cleared) colors.add(p.color);
      }
      return new Set(holding.filter((c) => colors.has(c.color)).map((c) => c.id));
    }
    // Render-only reachability: presented states must not fill the engine's shape cache.
    const mask = renderExteriorMask(truthState);
    const colors = new Set(truthState.pixels.filter((p) => !p.cleared && isPixelReachable(mask, p)).map((p) => p.color));
    return new Set(holding.filter((c) => colors.has(c.color)).map((c) => c.id));
  // Truth's pixels/holding are the inputs that matter; the object identity changes per launch.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [truthState.pixels, holding, truthState.width, truthState.height, truthState.ruleset]);
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
  // M2B: launching is allowed while charges orbit. Controls are disabled only
  // once the player can SEE the level is over; a full rail only makes them LOOK
  // blocked, so a tap there reaches the session and gets its "rail is full"
  // refusal instead of silently doing nothing.
  //
  // Device QA: this used to also lock on `engineState.status`, which is decided
  // a full lap before the loss is presented (a Holding overflow decides at
  // launch time). For those seconds the board looked playable but every
  // Pressable was disabled, so taps produced nothing at all — no launch, no
  // refusal, no haptic. The session still refuses those taps; now they reach it
  // and are answered (`gameOver`).
  const resultPending = state.status === 'playing' && session.engineState.status !== 'playing';
  // Strictly "the rail is full" — never a stand-in for any other refusal, so a
  // pending result cannot masquerade as capacity pressure.
  const railFull = !controlsLocked && !resultPending && session.activeCount >= session.activeCapacity;
  const capacityRefusalSeq = session.lastDenial?.reason === 'activeFull' ? session.lastDenial.seq : 0;
  // Presentation only: the colours of the Pals on the track fill the ACTIVE pips.
  const activeColors = useMemo(() => session.flights.map((f) => f.charge.color), [session.flights]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <GameplayEnvironment />

      <Hud
        levelId={state.levelId}
        difficulty={level.difficulty}
        cleared={cleared}
        total={total}
        coins={economyApi.economy.coins}
        onRestart={handleRestart}
        onHome={onExit}
      />

      <View collapsable={false} style={styles.boardArea} onLayout={onBoardArea}>
        {boardBox.width > 0 ? (
          // v2: the board canvas paints its own track band and well, so the
          // frame is only a soft lift — no ink panel, no cyan outline, no
          // padding. `boardWrap` (measured for launch/holding coordinates) is
          // unchanged; this is an uninvolved parent, so `boardOrigin` still
          // measures the board's own true position.
          <Animated.View style={boardEntryStyle}>
            {/* Core V2 paints its own lift at the track's corner radius. */}
            {isCoreV2(state.ruleset) ? null : <View pointerEvents="none" style={styles.boardLift} />}
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
              {session.bombTargeting && !won && !lost ? (
                <BombTargetingOverlay
                  width={boardBox.width}
                  height={boardBox.height}
                  state={state}
                  onTarget={handleBombTarget}
                  onCancel={session.cancelBomb}
                />
              ) : null}
              {bombFlash ? (
                <BombDetonationFlash point={bombFlash.point} size={bombFlash.size} />
              ) : null}
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
          activeColors={activeColors}
          layoutVersion={boardBox.width + boardBox.height}
          disabled={controlsLocked || session.bombTargeting}
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
          inventory={economyApi.economy.inventory}
          canUndo={session.canUndo}
          extraSlotActive={session.extraSlotActive}
          bombArmed={session.bombTargeting}
          onPressItem={handleItemPress}
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
          earnedCoins={earnedCoins}
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

      <RestockModal
        itemId={restockItem}
        coins={economyApi.economy.coins}
        onClose={() => setRestockItem(null)}
        onBuy={economyApi.buyItem}
      />

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
  // v2 lift: 0 14 28 rgba(10,25,70,.35). Cast by a static, opaque sibling
  // behind the board — a shadow on the board's own container would be
  // re-rasterised from its moving content every frame.
  boardLift: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: 6,
    bottom: 6,
    borderRadius: 30,
    backgroundColor: '#5F86FF',
    shadowColor: '#0A1946',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 14 },
  },
  controls: {
    width: '100%',
    alignItems: 'stretch',
  },
  failDim: {
    position: 'absolute',
    top: -2, left: -2, right: -2, bottom: -2,
    borderRadius: 24,
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
