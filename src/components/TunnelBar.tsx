import { LinearGradient } from 'expo-linear-gradient';
import { memo, useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
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
import { AV, AV_COMPACT_HEIGHT, AV_FONT, AV_SIZE, AV_SIZE_COMPACT } from '@/theme/arcadiaV2';
import { GP } from '@/theme/gameplayUi';
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
  /** Kept for call-site compatibility — tunnels always render as deck columns. */
  embedded?: boolean;
}

/** Space above the Ready Pal inside the column (pt). */
const TOP_PAD = 4;
/** Gap between the Ready Pal and Next (pt); deeper slots use {@link QUEUE_STEP}. */
const READY_GAP = 6;
const QUEUE_STEP = 4;
/** Gap above the "+N" depth chip, and its height (pt). */
const CHIP_GAP = 6;
const CHIP_H = 16;
/** Next+1 and deeper: 60% opacity, no badge. */
const DEEP_OPACITY = 0.6;

/** v2 Pal ladder: Ready → Next → Next+1 (deeper slots repeat the last size). */
function ladder(compact: boolean): { ready: number; queue: readonly number[] } {
  const s = compact ? AV_SIZE_COMPACT : AV_SIZE;
  return { ready: s.palReady, queue: [s.palNext, s.palNextPlus] };
}

function queueSizesFor(sizes: readonly number[], count: number): number[] {
  return Array.from({ length: count }, (_, i) => sizes[i] ?? sizes[sizes.length - 1] ?? 0);
}

/** Top of queue slot `i`, measured from the top of the queue stack. */
function slotTop(i: number, sizes: readonly number[]): number {
  let y = READY_GAP;
  for (let k = 0; k < i; k++) y += (sizes[k] ?? 0) + QUEUE_STEP;
  return y;
}

/**
 * Launch tunnels — presentation only. Renders however many tunnels the state
 * has (the count is never changed here). M7A v2: each tunnel is a narrow
 * column (≤96pt) on a soft glass capsule — Ready 56 on a contact shadow, Next
 * 38, Next+1 30 at 60%, then a "+N" depth chip for the hidden tail. The whole
 * column is the tap target and launches the Ready Pal.
 *
 * Interaction (all UI thread): touch-down compresses the column slightly; an
 * accepted launch washes the capsule cyan and the next Pal slides up into the
 * seat; a refusal shakes the column horizontally — coral when the rail is
 * full, soft otherwise. Nothing moves between taps.
 */
export const TunnelBar = memo(function TunnelBar({ state, disabled, blocked = false, colorAssist, onLaunch, onSourceLayout, layoutVersion, tutorial }: TunnelBarProps) {
  const charges = visibleCharges(state);
  const upcoming = upcomingPreviewCount(state.ruleset);
  const pixelPal = isCoreV2(state.ruleset);
  const { width, height } = useWindowDimensions();
  const compact = height <= AV_COMPACT_HEIGHT;
  const count = Math.max(1, charges.length);
  const gap = count >= 4 ? 8 : AV_SIZE.tunnelGap;
  const inner = Math.max(240, width - AV_SIZE.sideMargin * 2);
  const col = Math.min(AV_SIZE.tunnelCol, Math.floor((inner - gap * (count - 1)) / count));
  const { ready: readyBase, queue: queueBase } = ladder(compact);
  // Very narrow columns (many tunnels on a small phone) step the ladder down.
  const shrink = Math.min(1, (col - 8) / readyBase);
  const readySize = Math.round(readyBase * shrink);
  const sizes = queueSizesFor(queueBase.map((s) => Math.round(s * shrink)), upcoming);
  const columnH = TOP_PAD + readySize + slotTop(upcoming, sizes) + CHIP_GAP + CHIP_H;

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
          col={col}
          columnH={columnH}
          readySize={readySize}
          sizes={sizes}
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
  index, tunnelId, charge, tunnel, upcoming, disabled, blocked, colorAssist, pixelPal, col, columnH, readySize, sizes,
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
  col: number;
  columnH: number;
  readySize: number;
  sizes: readonly number[];
  onLaunch: (tunnelId: string) => boolean;
  onSourceLayout: (key: string, point: Point) => void;
  layoutVersion: number;
  highlighted: boolean;
  subdued: boolean;
}) {
  const empty = !charge;
  const reducedMotion = useReducedMotion();
  const ready = !empty && !disabled && !blocked;
  // The seat never moves with its contents, so it is the launch origin: the
  // ready Pal is always centred in it, including mid-slide.
  const seatRef = useRef<View | null>(null);

  // Tutorial spotlight: fades in and holds — a static ring, never a pulse.
  const spotlight = useSharedValue(highlighted ? 1 : 0);
  useEffect(() => {
    cancelAnimation(spotlight);
    spotlight.set(withTiming(highlighted ? 1 : 0, { duration: reducedMotion ? 0 : 160 }));
  }, [highlighted, reducedMotion, spotlight]);
  const spotlightStyle = useAnimatedStyle(() => ({ opacity: spotlight.value }));

  const measure = useCallback(() => {
    seatRef.current?.measureInWindow((x, y, width, height) =>
      onSourceLayout(tunnelId, { x: x + width / 2, y: y + height / 2 }));
  }, [onSourceLayout, tunnelId]);
  useEffect(() => { measure(); }, [layoutVersion, measure]);

  // Accepted launch changes the front charge. The column itself stays put:
  // the response is the capsule wash plus the next Pal moving into the seat.
  const seenCharge = useRef<string | null>(charge?.id ?? null);
  const advanced = seenCharge.current !== null && seenCharge.current !== (charge?.id ?? null);
  useEffect(() => { seenCharge.current = charge?.id ?? null; }, [charge?.id]);

  const { depth, pressIn, pressOut } = usePressDepth();
  const wash = useSharedValue(0);
  /** 0 = accepted (cyan), 1 = refused, rail full (coral), 2 = refused, other (soft). */
  const washKind = useSharedValue(0);
  const shakeX = useSharedValue(0);
  const onPressIn = () => {
    pressIn();
    if (onLaunch(tunnelId)) {
      washKind.set(0);
      flash(wash);
      return;
    }
    washKind.set(blocked ? 1 : 2);
    flash(wash, GP_MOTION.lipRiseMs, 300);
    if (!reducedMotion) shake(shakeX, blocked ? GP_MOTION.shakeFirm : GP_MOTION.shakeSoft);
  };

  // Touch-down compression only: no vertical travel and no rebound. The
  // refusal shake is horizontal, never a bob.
  const columnStyle = useAnimatedStyle(() => {
    const press = reducedMotion ? depth.value * 0.5 : depth.value;
    return { transform: [{ translateX: shakeX.value }, { scale: 1 - press * 0.04 }] };
  });
  const washStyle = useAnimatedStyle(() => ({
    opacity: washKind.value === 2 ? wash.value * 0.08 : wash.value * 0.22,
    backgroundColor: washKind.value === 1 ? GP.danger : GP.cyan,
  }));

  // After the first commit, any chip that mounts is a new arrival in the preview.
  const settled = useRef(false);
  useEffect(() => { settled.current = true; }, []);

  const ink = charge ? markContrast(charge.color) : null;
  const queue = Array.from({ length: upcoming }, (_, previewIdx) => tunnel?.queue[previewIdx + 1] ?? null);
  const hidden = Math.max(0, (tunnel?.queue.length ?? 0) - 1 - upcoming);
  const capsuleW = Math.min(col, readySize + 12);
  // Distance from the Next chip's centre up to the seat's centre.
  const feedShift = readySize / 2 + READY_GAP + (sizes[0] ?? 0) / 2;

  return (
    <Animated.View
      style={[{ width: col, height: columnH }, subdued && styles.subdued, columnStyle]}
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
            ? `Launch tunnel ${index + 1}, ${orbLabel[charge.color]} Pal ${charge.capacity}${hidden > 0 ? `, ${hidden} more queued` : ''}`
            : `Tunnel ${index + 1} empty`
        }
        hitSlop={4}
        style={styles.pressable}
      >
        {/* Soft glass capsule behind the stack (11% → 2% white; 4% flat when empty). */}
        {empty ? (
          <View pointerEvents="none" style={[styles.capsule, styles.capsuleEmpty, { width: capsuleW }]} />
        ) : (
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,255,255,0.11)', 'rgba(255,255,255,0.02)']}
            style={[styles.capsule, { width: capsuleW }, (disabled || blocked) && styles.capsuleBlocked]}
          />
        )}
        <Animated.View pointerEvents="none" style={[styles.capsule, { width: capsuleW }, washStyle]} />
        {highlighted ? (
          <Animated.View pointerEvents="none" style={[styles.spotlightRing, spotlightStyle]} />
        ) : null}

        {/* The seat is exactly the Ready Pal's box, so its measured centre is the Pal's. */}
        <View ref={seatRef} collapsable={false} onLayout={measure} style={[styles.seat, { height: readySize }]}>
          {charge ? (
            <>
              <View
                pointerEvents="none"
                style={[styles.contact, { width: readySize * 0.93, height: Math.max(6, readySize * 0.18), top: readySize * 0.86 }]}
              />
              <ReadySeat
                key={charge.id}
                charge={charge}
                size={readySize}
                from={(sizes[0] ?? readySize) / readySize}
                shift={feedShift}
                animateIn={advanced}
                reducedMotion={reducedMotion}
                colorAssist={colorAssist}
                pixelPal={pixelPal}
                ready={ready}
                ink={ink?.fill}
              />
            </>
          ) : (
            <View style={[styles.emptyMouth, { width: readySize * 0.86, height: readySize * 0.86, borderRadius: readySize * 0.28 }]} />
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
              size={sizes[previewIdx] ?? 0}
              sizes={sizes}
              pixelPal={pixelPal}
              reducedMotion={reducedMotion}
            />
          ) : null))}
        </View>

        {hidden > 0 ? (
          <View pointerEvents="none" style={styles.depthChip}>
            <Text style={styles.depthText}>+{hidden}</Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
});

/**
 * The ready Pal. Keyed by charge, so a new front charge is a fresh mount: when
 * it replaced a launched Pal it slides up out of the queue (Next scale → ready
 * scale) instead of popping in. Reduced motion: a short fade.
 */
const ReadySeat = memo(function ReadySeat({
  charge, size, from, shift, animateIn, reducedMotion, colorAssist, pixelPal, ready, ink,
}: {
  charge: Charge;
  size: number;
  /** Next-chip scale relative to the ready size. */
  from: number;
  /** Distance (pt) from the Next slot up to the seat. */
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
      {pixelPal ? (
        <PixelPalFace
          color={charge.color}
          size={size}
          colorAssist={colorAssist}
          mood={ready ? 'focused' : 'calm'}
          capacity={charge.capacity}
          animate={false}
        />
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
 * that newly enters the visible preview scales/fades in. Next carries its
 * count badge; Next+1 and deeper sit at 60% with no badge.
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
      offset.set(slotTop(prev, sizes) - slotTop(previewIdx, sizes));
      offset.set(withTiming(0, { duration: GP_MOTION.queueAdvanceMs, easing: Easing.out(Easing.cubic) }));
    }
    // `arriving` is read at mount only; `sizes` only to measure this slot's move.
  }, [previewIdx, size, sizes, arriving, reducedMotion, offset, enter]);

  const style = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateY: offset.value }, { scale: 0.85 + enter.value * 0.15 }],
  }));

  const deep = previewIdx > 0;
  return (
    <Animated.View
      style={[
        styles.queued,
        {
          marginTop: previewIdx === 0 ? READY_GAP : QUEUE_STEP,
          zIndex: upcoming - previewIdx,
          opacity: deep ? DEEP_OPACITY : 1,
        },
      ]}
    >
      <Animated.View style={style}>
        {pixelPal ? (
          <PixelPalFace color={charge.color} size={size} capacity={deep ? undefined : charge.capacity} animate={false} />
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
            {deep ? null : (
              <Text style={[styles.capacity, { color: markContrast(charge.color).fill, fontSize: size * 0.34 }]}>
                {charge.capacity}
              </Text>
            )}
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
  },
  pressable: { alignItems: 'center', width: '100%', height: '100%' },
  subdued: { opacity: 0.55 },
  capsule: {
    position: 'absolute',
    top: TOP_PAD,
    bottom: 0,
    alignSelf: 'center',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  capsuleEmpty: { backgroundColor: 'rgba(255,255,255,0.04)' },
  capsuleBlocked: { opacity: 0.6 },
  spotlightRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: GP.cyan,
    zIndex: 6,
  },
  seat: {
    width: '100%',
    marginTop: TOP_PAD,
    alignItems: 'center',
  },
  contact: {
    position: 'absolute',
    alignSelf: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(15,35,85,0.35)',
  },
  readySeat: {
    zIndex: 4,
    alignItems: 'center',
  },
  emptyMouth: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.28)',
  },
  queue: {
    alignItems: 'center',
    zIndex: 5,
  },
  queued: {
    alignItems: 'center',
  },
  depthChip: {
    marginTop: CHIP_GAP,
    height: CHIP_H,
    paddingHorizontal: 7,
    borderRadius: CHIP_H / 2,
    backgroundColor: AV.glassDeep,
    justifyContent: 'center',
  },
  depthText: {
    fontSize: 10,
    fontFamily: AV_FONT.extraBold,
    color: AV.textSecondary,
    fontVariant: ['tabular-nums'],
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
