import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { holdingWarnAt } from '@/game/engine/selectors';
import type { Charge } from '@/game/engine/types';
import type { Point } from '@/game/rendering/boardGeometry';
import { PixelPalFace } from '@/game/rendering/pixelPal/PixelPalFace';
import { ColorAssistMark } from '@/components/ColorAssistMark';
import { isHeldChargeHighlighted, isHeldChargeSubdued } from '@/game/presentation/tutorialCoach';
import type { TutorialView } from '@/game/tutorial';
import { markContrast } from '@/theme/colorAssist';
import { orbColors, orbGlow, orbLabel } from '@/theme/colors';
import { flash, kick, shake, usePressDepth } from '@/components/gameplay/motionKit';
import { GAMEPLAY } from '@/theme/gameplayLayout';
import { GP, GP_RADIUS, GP_TYPE, gpAlpha } from '@/theme/gameplayUi';
import { GP_MOTION } from '@/theme/gameplayMotion';

interface HoldingTrayProps {
  holding: Charge[];
  capacity: number;
  disabled: boolean;
  usefulIds: Set<string>;
  colorAssist?: boolean;
  onLaunch: (id: string) => boolean;
  onSourceLayout: (key: string, point: Point) => void;
  message: string;
  layoutVersion: number;
  /** Future Extra Slot booster — draws the inert [+] affordance when true. */
  boosterSlot?: boolean;
  /** M5.3 — Core V2 renders the shared Pixel Pal body; Legacy V1 keeps its plain orb. */
  pixelPal?: boolean;
  /** M5.4C — Core V2 Level 1 tutorial spotlight/dim. Omitted (or inactive) outside that tutorial. */
  tutorial?: TutorialView;
  /** Recessed wells in the control deck — no card chrome, no helper copy. */
  embedded?: boolean;
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

type HoldingTier = 'calm' | 'occupied' | 'warning' | 'danger';
/** Pressure ranking — used only to detect an *escalation* worth a one-shot pulse. */
const TIER_RANK: Record<HoldingTier, number> = { calm: 0, occupied: 1, warning: 2, danger: 3 };

/**
 * Pure gameplay-pressure ladder — a function of occupancy only, never of
 * win/loss status. "danger" means the tray is literally full, whether or not
 * that turns out to be fatal. Pressure uses `holdingWarnAt(capacity)`.
 */
function holdingTier(count: number, capacity: number): HoldingTier {
  if (count === 0) return 'calm';
  if (capacity > 0 && count >= capacity) return 'danger';
  return count >= holdingWarnAt(capacity) ? 'warning' : 'occupied';
}

const TIER_COLOR: Record<HoldingTier, string> = {
  calm: GP.textMuted,
  occupied: GP.cyanPale,
  warning: GP.gold,
  danger: GP.danger,
};

/**
 * HOLDING n/cap for the deck's status strip. Colour follows the tier; FULL
 * gets a small danger chip. A one-shot pop on *escalation* into warning/full —
 * never a standing pulse, never on de-escalation.
 */
export const HoldingStatus = memo(function HoldingStatus({ count, capacity }: { count: number; capacity: number }) {
  const reducedMotion = useReducedMotion();
  const tier = holdingTier(count, capacity);
  const prevRank = useRef(TIER_RANK[tier]);
  const tierPulse = useSharedValue(0);
  useEffect(() => {
    const rank = TIER_RANK[tier];
    if (rank >= TIER_RANK.warning && rank > prevRank.current && !reducedMotion) flash(tierPulse, 100, 240);
    prevRank.current = rank;
  }, [tier, tierPulse, reducedMotion]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + tierPulse.value * 0.1 }] }));
  const color = TIER_COLOR[tier];

  return (
    <Animated.View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Holding ${count} of ${capacity}${tier === 'danger' ? ', full' : ''}`}
      style={[styles.status, pulseStyle]}
    >
      <Text style={[styles.label, { color: tier === 'calm' ? GP.textSecondary : color }]}>HOLDING</Text>
      {tier === 'danger' ? (
        <View style={styles.fullChip}><Text style={styles.fullText}>FULL</Text></View>
      ) : null}
      <Text style={[styles.labelCount, { color }]}>{count}/{capacity}</Text>
    </Animated.View>
  );
});

/**
 * Holding tray — slot count comes from `capacity` (Legacy V1: 3, Core V2: 3).
 * Pressure uses `capacity - 1` / `capacity`, not hardcoded 2/3.
 * Recessed physical wells with clear occupied/empty states.
 */
export const HoldingTray = memo(function HoldingTray({
  holding, capacity, disabled, usefulIds, colorAssist, onLaunch, onSourceLayout, layoutVersion, boosterSlot, pixelPal,
  tutorial,
}: HoldingTrayProps) {
  const reducedMotion = useReducedMotion();

  const prevIds = useRef<Set<string>>(new Set(holding.map((c) => c.id)));
  const [arrivedIds, setArrivedIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const prev = prevIds.current;
    const next = new Set(holding.filter((c) => !prev.has(c.id)).map((c) => c.id));
    prevIds.current = new Set(holding.map((c) => c.id));
    if (next.size > 0) setArrivedIds(next);
    else setArrivedIds((current) => (current.size > 0 ? new Set() : current));
  }, [holding]);

  // A refused tap shakes that Pal (a rare React update, only on refusal).
  const [denied, setDenied] = useState<{ id: string; seq: number }>({ id: '', seq: 0 });
  const onDenied = useCallback((id: string) => setDenied((current) => ({ id, seq: current.seq + 1 })), []);
  const tier = holdingTier(holding.length, capacity);

  return (
    <View style={styles.row}>
      <View style={styles.slots}>
        <View style={styles.wells}>
          {Array.from({ length: capacity }, (_, index) => {
            const charge = holding[index];
            return (
              <Well
                key={`well-${index}`}
                index={index}
                charge={charge}
                useful={!!charge && usefulIds.has(charge.id)}
                captured={!!charge && arrivedIds.has(charge.id)}
                rim={tier === 'danger' ? 'danger' : tier === 'warning' && index === holding.length ? 'warning' : 'normal'}
                disabled={disabled}
                reducedMotion={reducedMotion}
                onLaunch={onLaunch}
                onDenied={onDenied}
                onSourceLayout={onSourceLayout}
                layoutVersion={layoutVersion}
                highlighted={!!charge && !!tutorial && isHeldChargeHighlighted(tutorial, charge.id)}
                subdued={!!charge && !!tutorial && isHeldChargeSubdued(tutorial, charge.id)}
              />
            );
          })}
          {/* Held Pals ride above the wells, keyed by Pal: when slot ownership
              changes they slide to their new well instead of remounting. */}
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {holding.slice(0, capacity).map((charge, index) => (
              <HeldPal
                key={charge.id}
                charge={charge}
                index={index}
                useful={usefulIds.has(charge.id)}
                colorAssist={colorAssist}
                pixelPal={!!pixelPal}
                justArrived={arrivedIds.has(charge.id)}
                reducedMotion={reducedMotion}
                subdued={!!tutorial && isHeldChargeSubdued(tutorial, charge.id)}
                shakeSeq={denied.id === charge.id ? denied.seq : 0}
              />
            ))}
          </View>
        </View>

        {boosterSlot ? (
          <View style={[styles.socket, styles.boosterSlot]}>
            <Text style={styles.boosterMark}>+</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}, (prev, next) => (
  prev.holding === next.holding
  && prev.capacity === next.capacity
  && prev.disabled === next.disabled
  && setsEqual(prev.usefulIds, next.usefulIds)
  && prev.colorAssist === next.colorAssist
  && prev.layoutVersion === next.layoutVersion
  && prev.boosterSlot === next.boosterSlot
  && prev.pixelPal === next.pixelPal
  && prev.tutorial === next.tutorial
  && prev.onLaunch === next.onLaunch
  && prev.onSourceLayout === next.onSourceLayout
));

const SOCKET = GAMEPLAY.holdingWell;
const PAL = GAMEPLAY.holdingPal;

/** Horizontal gap between wells (also the tray row gap). */
const WELL_GAP = 10;
/** TUNABLE — how long a held Pal takes to slide to its new well. Quick, not a show. */
const RESHUFFLE_MS = 160;

/** Held Pal's top-left inside the wells row, centred in well `index`. */
function palX(index: number): number {
  return index * (SOCKET + WELL_GAP) + (SOCKET - PAL) / 2;
}
const PAL_Y = (SOCKET - PAL) / 2;

type WellRim = 'normal' | 'warning' | 'danger';
const RIM_EMPTY: Record<WellRim, string> = { normal: GP.hairline, warning: gpAlpha(GP.gold, 0.55), danger: gpAlpha(GP.danger, 0.45) };
const RIM_OCCUPIED: Record<WellRim, string> = { normal: GP.hairlineStrong, warning: GP.hairlineStrong, danger: gpAlpha(GP.danger, 0.45) };

/**
 * A physical Holding well: fixed position (keyed by index), owns the press,
 * the slot measurement Holding landings aim at, and the tutorial spotlight.
 * The Pal it holds is drawn by {@link HeldPal} above it.
 *
 * Feedback: touch-down depth (UI thread); a gold→cyan capture ring when a Pal
 * lands here; a cyan release ring when its Pal is relaunched; a dip on both.
 * The rim carries tray pressure: the last free well goes gold at the warning
 * tier, every rim goes danger when the tray is full. Static — never flashing.
 */
const Well = memo(function Well({
  index, charge, useful, captured, rim, disabled, reducedMotion, onLaunch, onDenied, onSourceLayout, layoutVersion,
  highlighted, subdued,
}: {
  index: number;
  charge: Charge | undefined;
  useful: boolean;
  /** Its Pal just landed from the Gate. */
  captured: boolean;
  rim: WellRim;
  disabled: boolean;
  reducedMotion: boolean;
  onLaunch: (id: string) => boolean;
  onDenied: (id: string) => void;
  onSourceLayout: (key: string, point: Point) => void;
  layoutVersion: number;
  highlighted: boolean;
  subdued: boolean;
}) {
  const slotRef = useRef<View | null>(null);
  const key = `holding-${index}`;

  const measure = useCallback(() => {
    slotRef.current?.measureInWindow((x, y, width, height) =>
      onSourceLayout(key, { x: x + width / 2, y: y + height / 2 }));
  }, [onSourceLayout, key]);
  useEffect(() => { measure(); }, [layoutVersion, measure]);

  const spotlight = useSharedValue(0);
  const wasHighlighted = useRef(false);
  useEffect(() => {
    cancelAnimation(spotlight);
    if (!highlighted) { spotlight.set(withTiming(0, { duration: 160 })); wasHighlighted.current = false; return; }
    const justBecameTarget = !wasHighlighted.current;
    wasHighlighted.current = true;
    if (reducedMotion) { spotlight.set(withTiming(1, { duration: 160 })); return; }
    const pulse = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true);
    spotlight.set(justBecameTarget
      ? withSequence(withTiming(1, { duration: 140, easing: Easing.out(Easing.cubic) }), pulse)
      : pulse);
    return () => cancelAnimation(spotlight);
  }, [highlighted, reducedMotion, spotlight]);
  const spotlightStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + spotlight.value * 0.55,
    transform: [{ scale: 1 + spotlight.value * 0.04 }],
  }));

  const { depth, pressIn, pressOut } = usePressDepth();
  const dip = useSharedValue(0);
  const ring = useSharedValue(0);
  /** 1 = capture (gold → cyan), 0 = release (cyan). */
  const ringKind = useSharedValue(0);
  useEffect(() => {
    if (!captured) return;
    ringKind.set(1);
    flash(ring, 60, GP_MOTION.captureMs - 60);
    if (!reducedMotion) kick(dip, 1, GP_MOTION.wellDip);
  }, [captured, ring, ringKind, dip, reducedMotion]);

  const onPressIn = () => {
    if (!charge) return;
    pressIn();
    if (onLaunch(charge.id)) {
      ringKind.set(0);
      flash(ring, 40, GP_MOTION.releaseMs - 40);
      if (!reducedMotion) kick(dip, 1, GP_MOTION.wellDip);
    } else {
      onDenied(charge.id);
    }
  };

  const wellStyle = useAnimatedStyle(() => {
    const press = reducedMotion ? depth.value * 0.5 : depth.value;
    return { transform: [{ scale: 1 - press * 0.06 - dip.value * 0.06 }] };
  });
  const ringStyle = useAnimatedStyle(() => {
    const v = ring.value;
    return {
      opacity: v,
      borderColor: ringKind.value === 1 ? interpolateColor(v, [0, 1], [GP.cyan, GP.gold]) : GP.cyan,
      transform: [{ scale: reducedMotion ? 1 : 1 + (1 - v) * 0.16 }],
    };
  });

  const rimColor = charge ? RIM_OCCUPIED[rim] : RIM_EMPTY[rim];
  return (
    <Pressable
      ref={slotRef}
      collapsable={false}
      onLayout={measure}
      disabled={disabled || !charge}
      onPressIn={onPressIn}
      onPressOut={pressOut}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || !charge }}
      accessibilityLabel={charge
        ? `Relaunch ${orbLabel[charge.color]} Pal, capacity ${charge.capacity}`
        : `Holding slot ${index + 1}, empty`}
      accessibilityHint={useful ? 'Tap to launch again' : 'Tap to launch again. No matching pixel is exposed yet'}
      style={subdued ? styles.socketSubdued : null}
    >
      <Animated.View style={[styles.socket, charge ? styles.socketOccupied : null, { borderColor: rimColor }, wellStyle]}>
        {highlighted ? (
          <Animated.View pointerEvents="none" style={[styles.spotlightRing, spotlightStyle]} />
        ) : null}
        {charge ? null : <View style={styles.socketWell} />}
        <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
      </Animated.View>
    </Pressable>
  );
});

/**
 * One held Pal, keyed by the Pal (never by slot). Its horizontal position is a
 * UI-thread value: when truth moves it to another well it slides there — the
 * React commit only changes the target, so there is no snap and no remount.
 */
const HeldPal = memo(function HeldPal({
  charge, index, useful, colorAssist, pixelPal, justArrived, reducedMotion, subdued, shakeSeq,
}: {
  charge: Charge;
  index: number;
  useful: boolean;
  colorAssist?: boolean;
  pixelPal: boolean;
  justArrived: boolean;
  reducedMotion: boolean;
  subdued: boolean;
  /** Bumped when a tap on this Pal's well was refused. */
  shakeSeq: number;
}) {
  const x = useSharedValue(palX(index));
  const placedAt = useRef(index);
  useEffect(() => {
    if (placedAt.current === index) return;
    placedAt.current = index;
    x.set(reducedMotion
      ? palX(index)
      : withTiming(palX(index), { duration: RESHUFFLE_MS, easing: Easing.out(Easing.cubic) }));
  }, [index, reducedMotion, x]);

  const arrival = useSharedValue(0);
  useEffect(() => {
    if (!justArrived || reducedMotion) return;
    cancelAnimation(arrival);
    arrival.set(withSequence(
      withTiming(1, { duration: 90, easing: Easing.out(Easing.cubic) }),
      withSpring(0, { damping: 13, stiffness: 220 }),
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justArrived]);

  // One-shot rejection shake — never a standing state, distinct from the
  // arrival bounce above (which fires when a Pal actually lands here).
  const shakeX = useSharedValue(0);
  useEffect(() => {
    if (!shakeSeq || reducedMotion) return;
    shake(shakeX, GP_MOTION.shakeSoft);
  }, [shakeSeq, shakeX, reducedMotion]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value + shakeX.value },
      { translateY: PAL_Y },
      { scale: 1 + arrival.value * 0.1 },
    ],
  }));

  const ink = markContrast(charge.color);

  // Every held Pal may be relaunched now, so none is drawn as disabled.
  // `selected` is the positive hint instead: this one has an exposed match.
  return (
    <Animated.View style={[styles.heldPal, subdued && styles.socketSubdued, style]}>
      {pixelPal ? (
        <View>
          <PixelPalFace
            color={charge.color}
            size={PAL}
            colorAssist={colorAssist}
            mood="calm"
            capacity={charge.capacity}
            selected={useful}
          />
        </View>
      ) : (
        <View style={[styles.orb, { backgroundColor: orbColors[charge.color], borderColor: orbGlow[charge.color] }]}>
          <View style={styles.orbGloss} />
          <Text
            style={[
              styles.count,
              { color: ink.fill },
              ink.halo ? { textShadowColor: ink.halo, textShadowRadius: 3, textShadowOffset: { width: 0, height: 0 } } : null,
            ]}
          >
            {charge.capacity}
          </Text>
          {colorAssist ? (
            <View style={styles.assist} pointerEvents="none">
              <ColorAssistMark color={charge.color} size={16} etched />
            </View>
          ) : null}
        </View>
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 18,
  },
  label: { ...GP_TYPE.label },
  labelCount: { ...GP_TYPE.numeral, minWidth: 24, textAlign: 'right' },
  fullChip: {
    paddingHorizontal: 5,
    height: 15,
    borderRadius: 4,
    justifyContent: 'center',
    backgroundColor: gpAlpha(GP.danger, 0.16),
    borderWidth: 1,
    borderColor: gpAlpha(GP.danger, 0.55),
  },
  fullText: { ...GP_TYPE.label, fontSize: 8.5, letterSpacing: 1.2, color: GP.danger },
  slots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: WELL_GAP,
  },
  // Recessed ink well + a single hairline rim — the deck's one well material.
  socket: {
    width: SOCKET,
    height: SOCKET,
    borderRadius: GP_RADIUS.well,
    backgroundColor: GP.well,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  socketOccupied: {
    backgroundColor: GP.wellDeep,
  },
  socketWell: {
    width: SOCKET * 0.3,
    height: SOCKET * 0.3,
    borderRadius: SOCKET * 0.1,
    backgroundColor: GP.wellDeep,
    borderWidth: 1,
    borderColor: GP.hairline,
  },
  socketSubdued: { opacity: 0.55 },
  ring: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: GP_RADIUS.well + 3,
    borderWidth: 2,
  },
  spotlightRing: {
    position: 'absolute',
    width: SOCKET + 10,
    height: SOCKET + 10,
    borderRadius: GP_RADIUS.well + 5,
    borderWidth: 2,
    borderColor: GP.cyan,
    backgroundColor: 'transparent',
  },
  wells: { flexDirection: 'row', gap: WELL_GAP },
  heldPal: { position: 'absolute', left: 0, top: 0, width: PAL, height: PAL, alignItems: 'center', justifyContent: 'center' },
  orb: {
    width: PAL,
    height: PAL,
    borderRadius: PAL / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  orbGloss: {
    position: 'absolute',
    top: PAL * 0.1,
    left: PAL * 0.14,
    width: PAL * 0.32,
    height: PAL * 0.22,
    borderRadius: PAL * 0.2,
    backgroundColor: '#FFFFFF',
    opacity: 0.4,
  },
  assist: { position: 'absolute', bottom: 2, alignSelf: 'center' },
  boosterSlot: { borderWidth: 1, borderStyle: 'dashed', borderColor: GP.textFaint, opacity: 0.5 },
  boosterMark: { color: GP.textMuted, fontSize: 22, fontWeight: '700' },
  count: { fontSize: 17, fontWeight: '800' },
});
