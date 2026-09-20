import { memo, useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { Point } from '@/game/rendering/boardGeometry';
import { ColorAssistMark } from '@/components/ColorAssistMark';
import { flash, shake, usePressDepth } from '@/components/gameplay/motionKit';
import { PixelPalFace } from '@/game/rendering/pixelPal/PixelPalFace';
import { upcomingPreviewCount, visibleCharges } from '@/game/engine/selectors';
import { isCoreV2 } from '@/game/engine/ruleset';
import type { Charge, GameState, TunnelState } from '@/game/engine/types';
import { isTunnelHighlighted, isTunnelSubdued } from '@/game/presentation/tutorialCoach';
import type { TutorialView } from '@/game/tutorial';
import { markContrast } from '@/theme/colorAssist';
import { orbColors, orbGlow, orbLabel } from '@/theme/colors';
import {
  BAY_PAD, GAMEPLAY, QUEUE_GAP, queueSizes, queueSlotMargin, queueSlotOpacity, queueSlotY,
} from '@/theme/gameplayLayout';
import { GP, GP_RADIUS, gpAlpha } from '@/theme/gameplayUi';
import { GP_MOTION } from '@/theme/gameplayMotion';

interface TunnelBarProps {
  state: GameState;
  layoutVersion: number;
  disabled: boolean;
  /** Rail full: look blocked but stay pressable, so a tap can explain the refusal. */
  blocked?: boolean;
  colorAssist?: boolean;
  onLaunch: (tunnelId: string) => boolean;
  onSourceLayout: (key: string, point: Point) => void;
  tutorial?: TutorialView;
  /** Kept for call-site compatibility — tunnels always render as deck bays. */
  embedded?: boolean;
}

/**
 * Resting lip colour of a ready bay. Precomputed: `gpAlpha` is a plain JS
 * helper and must never be called inside a worklet (UI runtime).
 */
const LIP_READY = gpAlpha(GP.cyan, 0.42);

/**
 * Launch tunnels — presentation only. Renders however many tunnels the state
 * has (Legacy V1: 3, Core V2: 4). Each is a recessed launch **bay** holding the
 * ready Pal, with the next Pals feeding in below it; the hidden queue tail
 * stays in engine state.
 *
 * Interaction (all UI thread): touch-down compresses the bay slightly; an
 * accepted launch flashes the bay's cyan lip and the next Pal slides up into
 * the seat while the queue follows behind it; a refusal shakes the bay
 * horizontally — firmly with a danger lip when the rail is full, softly
 * otherwise. The bay never moves vertically and never rebounds.
 */
export const TunnelBar = memo(function TunnelBar({ state, disabled, blocked = false, colorAssist, onLaunch, onSourceLayout, layoutVersion, tutorial }: TunnelBarProps) {
  const charges = visibleCharges(state);
  const upcoming = upcomingPreviewCount(state.ruleset);
  const pixelPal = isCoreV2(state.ruleset);
  const { width } = useWindowDimensions();
  const inner = Math.max(240, width - GAMEPLAY.deckPadX * 2);
  const gap = charges.length >= 4 ? 6 : 10;
  const col = (inner - gap * Math.max(0, charges.length - 1)) / Math.max(1, charges.length);
  const readySize = Math.min(GAMEPLAY.readyPalMax, Math.max(GAMEPLAY.readyPalMin, Math.floor(col - 12)));

  return (
    <View style={[styles.row, { gap }]}>
      {charges.map(({ tunnelId, charge }, index) => (
        <Tunnel
          key={tunnelId}
          index={index}
          tunnelId={tunnelId}
          charge={charge}
          tunnel={state.tunnels[index]}
          upcoming={upcoming}
          disabled={disabled}
          blocked={blocked}
          colorAssist={colorAssist}
          pixelPal={pixelPal}
          readySize={readySize}
          onLaunch={onLaunch}
          onSourceLayout={onSourceLayout}
          layoutVersion={layoutVersion}
          highlighted={tutorial ? isTunnelHighlighted(tutorial, tunnelId) : false}
          subdued={tutorial ? isTunnelSubdued(tutorial, tunnelId) : false}
        />
      ))}
    </View>
  );
}, (prev, next) => (
  prev.state.tunnels === next.state.tunnels
  && prev.state.ruleset === next.state.ruleset
  && prev.disabled === next.disabled
  && prev.blocked === next.blocked
  && prev.layoutVersion === next.layoutVersion
  && prev.colorAssist === next.colorAssist
  && prev.onLaunch === next.onLaunch
  && prev.onSourceLayout === next.onSourceLayout
  && prev.tutorial === next.tutorial
));

const Tunnel = memo(function Tunnel({
  index, tunnelId, charge, tunnel, upcoming, disabled, blocked, colorAssist, pixelPal, readySize,
  onLaunch, onSourceLayout, layoutVersion, highlighted, subdued,
}: {
  index: number;
  tunnelId: string;
  charge: Charge | null;
  tunnel: TunnelState | undefined;
  upcoming: number;
  disabled: boolean;
  blocked: boolean;
  colorAssist?: boolean;
  pixelPal: boolean;
  readySize: number;
  onLaunch: (tunnelId: string) => boolean;
  onSourceLayout: (key: string, point: Point) => void;
  layoutVersion: number;
  highlighted: boolean;
  subdued: boolean;
}) {
  const empty = !charge;
  const reducedMotion = useReducedMotion();
  const ready = !empty && !disabled && !blocked;
  // The bay never moves with its contents, so it is the launch origin: the
  // ready Pal is always centred in it, including mid-slide.
  const bayRef = useRef<View | null>(null);

  const spotlight = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(spotlight);
    if (!highlighted) { spotlight.set(withTiming(0, { duration: 160 })); return; }
    if (reducedMotion) { spotlight.set(withTiming(1, { duration: 160 })); return; }
    spotlight.set(withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(spotlight);
  }, [highlighted, reducedMotion, spotlight]);
  const spotlightStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + spotlight.value * 0.6,
    transform: [{ scale: 1 + spotlight.value * 0.035 }],
  }));

  const measure = useCallback(() => {
    bayRef.current?.measureInWindow((x, y, width, height) =>
      onSourceLayout(tunnelId, { x: x + width / 2, y: y + height / 2 }));
  }, [onSourceLayout, tunnelId]);
  useEffect(() => { measure(); }, [layoutVersion, measure]);

  // Accepted launch changes the front charge. The bay itself stays put: the
  // response is the lip flash plus the next Pal moving into the seat.
  const seenCharge = useRef<string | null>(charge?.id ?? null);
  const advanced = seenCharge.current !== null && seenCharge.current !== (charge?.id ?? null);
  useEffect(() => { seenCharge.current = charge?.id ?? null; }, [charge?.id]);

  const { depth, pressIn, pressOut } = usePressDepth();
  const lip = useSharedValue(0);
  /** 0 = accepted (cyan), 1 = refused, rail full (danger), 2 = refused, other (muted). */
  const lipKind = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const onPressIn = () => {
    pressIn();
    if (onLaunch(tunnelId)) {
      lipKind.set(0);
      flash(lip);
      return;
    }
    lipKind.set(blocked ? 1 : 2);
    flash(lip, GP_MOTION.lipRiseMs, 300);
    if (!reducedMotion) shake(shakeX, blocked ? GP_MOTION.shakeFirm : GP_MOTION.shakeSoft);
  };

  // Touch-down compression only: no vertical travel and no rebound, so the bay
  // reads as fixed hardware. The refusal shake is horizontal, never a bob.
  const housingStyle = useAnimatedStyle(() => {
    const press = reducedMotion ? depth.value * 0.5 : depth.value;
    return {
      transform: [
        { translateX: shakeX.value },
        { scale: 1 - press * 0.04 },
      ],
    };
  });
  // Resolved on the JS side: the worklet below only captures the string.
  const lipRest = ready ? LIP_READY : GP.textFaint;
  const lipStyle = useAnimatedStyle(() => {
    const k = lipKind.value;
    const hot = k === 0 ? GP.cyan : k === 1 ? GP.danger : GP.cyanPale;
    return {
      backgroundColor: interpolateColor(lip.value, [0, 1], [lipRest, hot]),
      transform: [{ scaleX: 1 + lip.value * 0.12 }],
    };
  });
  const washStyle = useAnimatedStyle(() => ({
    opacity: lipKind.value === 2 ? lip.value * 0.05 : lip.value * 0.14,
    backgroundColor: lipKind.value === 1 ? GP.danger : GP.cyan,
  }));

  // After the first commit, any chip that mounts is a new arrival in the preview.
  const settled = useRef(false);
  useEffect(() => { settled.current = true; }, []);

  const ink = charge ? markContrast(charge.color) : null;
  const queue = Array.from({ length: upcoming }, (_, previewIdx) => tunnel?.queue[previewIdx + 1] ?? null);
  const bayH = readySize + BAY_PAD * 2;
  const chipSizes = queueSizes(readySize, upcoming);
  // Distance from the first queue chip's centre up to the seat's centre.
  const feedShift = bayH / 2 + QUEUE_GAP + (chipSizes[0] ?? 0) / 2;

  return (
    <Animated.View
      style={[styles.tunnel, empty && styles.tunnelEmpty, subdued && styles.tunnelSubdued, housingStyle]}
      accessibilityLabel={highlighted ? 'Tutorial: launch this tunnel' : undefined}
    >
      <Pressable
        disabled={disabled || empty}
        onPressIn={onPressIn}
        onPressOut={pressOut}
        accessibilityState={{ disabled: disabled || empty }}
        accessibilityRole="button"
        accessibilityLabel={
          charge
            ? `Launch tunnel ${index + 1}, ${orbLabel[charge.color]} Pal ${charge.capacity}`
            : `Tunnel ${index + 1} empty`
        }
        hitSlop={6}
        style={styles.pressable}
      >
        <View
          ref={bayRef}
          collapsable={false}
          onLayout={measure}
          style={[styles.bay, { height: bayH }, !empty && (disabled || blocked) && styles.bayBlocked]}
        >
          <Animated.View pointerEvents="none" style={[styles.wash, washStyle]} />
          <Animated.View pointerEvents="none" style={[styles.lip, lipStyle]} />
          {highlighted ? (
            <Animated.View pointerEvents="none" style={[styles.spotlightRing, spotlightStyle]} />
          ) : null}

          {charge ? (
            <ReadySeat
              key={charge.id}
              charge={charge}
              size={readySize}
              from={(chipSizes[0] ?? readySize) / readySize}
              shift={feedShift}
              animateIn={advanced}
              reducedMotion={reducedMotion}
              colorAssist={colorAssist}
              pixelPal={pixelPal}
              ready={ready}
              ink={ink?.fill}
            />
          ) : (
            <View style={[styles.emptyMouth, { width: readySize * 0.62, height: readySize * 0.62, borderRadius: readySize * 0.2 }]} />
          )}
        </View>

        <View style={styles.queue}>
          {queue.map((nextCharge, previewIdx) => (nextCharge ? (
            <QueueChip
              key={nextCharge.id}
              charge={nextCharge}
              previewIdx={previewIdx}
              arriving={settled.current}
              upcoming={upcoming}
              size={chipSizes[previewIdx] ?? 0}
              sizes={chipSizes}
              pixelPal={pixelPal}
              reducedMotion={reducedMotion}
            />
          ) : null))}
        </View>
      </Pressable>
    </Animated.View>
  );
});

/**
 * The ready Pal. Keyed by charge, so a new front charge is a fresh mount: when
 * it replaced a launched Pal it slides up out of the queue (queue scale →
 * ready scale) instead of popping in. Reduced motion: a short fade.
 */
const ReadySeat = memo(function ReadySeat({
  charge, size, from, shift, animateIn, reducedMotion, colorAssist, pixelPal, ready, ink,
}: {
  charge: Charge;
  size: number;
  /** Queue-chip scale relative to the ready size. */
  from: number;
  /** Distance (pt) from the first queue slot up to the seat. */
  shift: number;
  animateIn: boolean;
  reducedMotion: boolean;
  colorAssist?: boolean;
  pixelPal: boolean;
  ready: boolean;
  ink?: string;
}) {
  const t = useSharedValue(animateIn ? 0 : 1);
  useEffect(() => {
    if (!animateIn) return;
    t.set(withTiming(1, {
      duration: reducedMotion ? GP_MOTION.queueAdvanceReducedMs : GP_MOTION.queueAdvanceMs,
      easing: Easing.out(Easing.cubic),
    }));
    // Mount-only: the seat animates in once per charge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => {
    if (reducedMotion) return { opacity: t.value };
    const p = t.value;
    return {
      transform: [
        { translateY: (1 - p) * shift },
        { scale: from + (1 - from) * p },
      ],
    };
  });

  return (
    <Animated.View style={[styles.readySeat, style]}>
      <View
        pointerEvents="none"
        style={[
          styles.pedestal,
          {
            width: size * 0.8,
            height: size * 0.22,
            borderRadius: size * 0.11,
            backgroundColor: gpAlpha(orbColors[charge.color], 0.16),
          },
        ]}
      />
      {pixelPal ? (
        <PixelPalFace color={charge.color} size={size} colorAssist={colorAssist} mood={ready ? 'focused' : 'calm'} capacity={charge.capacity} />
      ) : (
        <View style={[styles.charge, { width: size, height: size, borderRadius: size / 2, backgroundColor: orbColors[charge.color], borderColor: orbGlow[charge.color] }]}>
          <Text style={[styles.capacity, { color: ink, fontSize: size * 0.34 }]}>{charge.capacity}</Text>
          {colorAssist ? (
            <View style={styles.assist} pointerEvents="none">
              <ColorAssistMark color={charge.color} size={15} etched />
            </View>
          ) : null}
        </View>
      )}
    </Animated.View>
  );
});

/**
 * One upcoming Pal. Keyed by charge, so when the queue advances the same chip
 * moves up a slot: it slides from where it was instead of snapping. A chip
 * that newly enters the visible preview scales/fades in.
 */
const QueueChip = memo(function QueueChip({ charge, previewIdx, arriving, upcoming, size, sizes, pixelPal, reducedMotion }: {
  charge: Charge;
  previewIdx: number;
  /** Mounted after the tunnel's first commit, i.e. it just entered the preview. */
  arriving: boolean;
  upcoming: number;
  size: number;
  /** Every slot's size, so a chip moving up knows how far it travels. */
  sizes: readonly number[];
  pixelPal: boolean;
  reducedMotion: boolean;
}) {
  const offset = useSharedValue(0);
  const enter = useSharedValue(arriving && !reducedMotion ? 0 : 1);
  const placedAt = useRef<number | null>(null);
  useEffect(() => {
    const prev = placedAt.current;
    placedAt.current = previewIdx;
    if (reducedMotion) return;
    if (prev === null) {
      if (arriving) enter.set(withTiming(1, { duration: GP_MOTION.queueAdvanceMs, easing: Easing.out(Easing.cubic) }));
    } else if (prev !== previewIdx) {
      offset.set(queueSlotY(prev, sizes) - queueSlotY(previewIdx, sizes));
      offset.set(withTiming(0, { duration: GP_MOTION.queueAdvanceMs, easing: Easing.out(Easing.cubic) }));
    }
    // `arriving` is read at mount only; `sizes` only to measure this slot's move.
  }, [previewIdx, size, sizes, arriving, reducedMotion, offset, enter]);

  const style = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: offset.value }, { scale: 0.85 + enter.value * 0.15 }],
  }));

  return (
    <Animated.View
      style={[
        styles.queued,
        {
          marginTop: queueSlotMargin(previewIdx, size),
          zIndex: upcoming - previewIdx,
          opacity: queueSlotOpacity(previewIdx),
        },
      ]}
    >
      <Animated.View style={style}>
        {pixelPal ? (
          <PixelPalFace color={charge.color} size={size} capacity={charge.capacity} animate={false} />
        ) : (
          <View
            style={[
              styles.charge,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: orbColors[charge.color],
                borderColor: orbGlow[charge.color],
              },
            ]}
          >
            <Text style={[styles.capacity, { color: markContrast(charge.color).fill, fontSize: size * 0.34 }]}>
              {charge.capacity}
            </Text>
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    minHeight: 120,
  },
  tunnel: { flex: 1, maxWidth: 100, alignItems: 'center' },
  pressable: { alignItems: 'center', width: '100%' },
  tunnelEmpty: { opacity: 0.4 },
  tunnelSubdued: { opacity: 0.55 },
  bay: {
    width: '100%',
    borderRadius: GP_RADIUS.bay,
    backgroundColor: GP.well,
    borderWidth: 1,
    borderColor: GP.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  bayBlocked: { opacity: 0.78 },
  lip: {
    position: 'absolute',
    top: -1,
    left: 14,
    right: 14,
    height: 2,
    borderRadius: 1,
  },
  wash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
    borderTopLeftRadius: GP_RADIUS.bay,
    borderTopRightRadius: GP_RADIUS.bay,
  },
  readySeat: {
    zIndex: 4,
    alignItems: 'center',
  },
  pedestal: {
    position: 'absolute',
    bottom: -5,
    zIndex: 0,
  },
  emptyMouth: {
    backgroundColor: GP.wellDeep,
    borderWidth: 1,
    borderColor: GP.hairline,
  },
  spotlightRing: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    borderRadius: GP_RADIUS.bay + 5,
    borderWidth: 2,
    borderColor: GP.cyan,
    backgroundColor: 'transparent',
    zIndex: 5,
  },
  queue: {
    alignItems: 'center',
    zIndex: 5,
  },
  queued: {
    alignItems: 'center',
  },
  charge: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  assist: { position: 'absolute', bottom: 3, alignSelf: 'center' },
  capacity: { fontWeight: '800' },
});
