import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
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
import { AV, AV_SIZE } from '@/theme/arcadiaV2';
import { GAMEPLAY } from '@/theme/gameplayLayout';
import { GP, GP_TYPE, gpAlpha } from '@/theme/gameplayUi';
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
  /** v2 slot edge (pt). The tray may step this down so a 4th (Extra Slot) well fits. */
  slotSize?: number;
  /** Held Pal size (pt). */
  palSize?: number;
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

type HoldingTier = 'calm' | 'occupied' | 'warning' | 'danger';

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
  calm: AV.white,
  occupied: AV.white,
  warning: GP.gold,
  danger: GP.danger,
};

/**
 * "HOLDING n/cap" for the v2 tray, right-aligned beside the wells. The count
 * colour follows the tier (gold at the warning tier, coral when full). Static:
 * no pop, no pulse — the wells' rims carry the pressure too, so colour is
 * never the only signal.
 */
export const HoldingStatus = memo(function HoldingStatus({ count, capacity }: { count: number; capacity: number }) {
  const tier = holdingTier(count, capacity);
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Holding ${count} of ${capacity}${tier === 'danger' ? ', full' : ''}`}
      style={styles.status}
    >
      <Text style={[styles.label, { color: AV.textSecondary }]}>HOLDING</Text>
      <Text style={[styles.labelCount, { color: TIER_COLOR[tier] }]}>
        {tier === 'danger' ? 'FULL' : `${count}/${capacity}`}
      </Text>
    </View>
  );
});

/**
 * Holding tray — slot count comes from `capacity` (Legacy V1: 3, Core V2: 3).
 * Pressure uses `capacity - 1` / `capacity`, not hardcoded 2/3.
 * Recessed physical wells with clear occupied/empty states.
 */
export const HoldingTray = memo(function HoldingTray({
  holding, capacity, disabled, usefulIds, colorAssist, onLaunch, onSourceLayout, layoutVersion, boosterSlot, pixelPal,
  tutorial, slotSize = SLOT, palSize = PAL,
}: HoldingTrayProps) {
  const reducedMotion = useReducedMotion();
  const geom = useMemo(() => ({ slot: slotSize, pal: palSize }), [slotSize, palSize]);

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
                slot={slotSize}
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
                geom={geom}
              />
            ))}
          </View>
        </View>

        {boosterSlot ? (
          <View style={[styles.socket, styles.boosterSlot, { width: slotSize, height: slotSize }]}>
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
  && prev.slotSize === next.slotSize
  && prev.palSize === next.palSize
));

/** v2: 40pt recessed slots, 32pt Pal inside. */
const SLOT = GAMEPLAY.holdingWell;
const PAL = GAMEPLAY.holdingPal;
/** Tap target is 48pt: the slop around each 40pt well. */
const WELL_SLOP = Math.max(0, (AV_SIZE.holdingTap - SLOT) / 2);

/** Horizontal gap between wells (also the tray row gap). */
const WELL_GAP = 6;
/** TUNABLE — how long a held Pal takes to slide to its new well. Quick, not a show. */
const RESHUFFLE_MS = 160;

interface WellGeom { slot: number; pal: number }

/** Held Pal's top-left inside the wells row, centred in well `index`. */
function palX(index: number, g: WellGeom): number {
  return index * (g.slot + WELL_GAP) + (g.slot - g.pal) / 2;
}

type WellRim = 'normal' | 'warning' | 'danger';
/** v2: rims are invisible at rest; the next free well goes gold at the warning tier; full = coral 2pt, static. */
const RIM_COLOR: Record<WellRim, string> = { normal: 'transparent', warning: gpAlpha(GP.gold, 0.6), danger: GP.danger };
const RIM_WIDTH: Record<WellRim, number> = { normal: 0, warning: 1.5, danger: 2 };

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
  index, charge, useful, captured, rim, slot, disabled, reducedMotion, onLaunch, onDenied, onSourceLayout, layoutVersion,
  highlighted, subdued,
}: {
  index: number;
  slot: number;
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

  // Tutorial spotlight: fades in and holds — a static ring, never a pulse.
  const spotlight = useSharedValue(highlighted ? 1 : 0);
  useEffect(() => {
    cancelAnimation(spotlight);
    spotlight.set(withTiming(highlighted ? 1 : 0, { duration: reducedMotion ? 0 : 160, easing: Easing.out(Easing.cubic) }));
  }, [highlighted, reducedMotion, spotlight]);
  const spotlightStyle = useAnimatedStyle(() => ({ opacity: spotlight.value }));

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

  return (
    <Pressable
      ref={slotRef}
      collapsable={false}
      onLayout={measure}
      disabled={disabled || !charge}
      onPressIn={onPressIn}
      onPressOut={pressOut}
      hitSlop={WELL_SLOP}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || !charge }}
      accessibilityLabel={charge
        ? `Relaunch ${orbLabel[charge.color]} Pal, capacity ${charge.capacity}`
        : `Holding slot ${index + 1}, empty`}
      accessibilityHint={useful ? 'Tap to launch again' : 'Tap to launch again. No matching pixel is exposed yet'}
      style={subdued ? styles.socketSubdued : null}
    >
      <Animated.View
        style={[
          styles.socket,
          { width: slot, height: slot, borderColor: RIM_COLOR[rim], borderWidth: RIM_WIDTH[rim] },
          wellStyle,
        ]}
      >
        <View pointerEvents="none" style={styles.socketInset} />
        {highlighted ? (
          <Animated.View pointerEvents="none" style={[styles.spotlightRing, { width: slot + 10, height: slot + 10 }, spotlightStyle]} />
        ) : null}
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
  charge, index, useful, colorAssist, pixelPal, justArrived, reducedMotion, subdued, shakeSeq, geom,
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
  geom: WellGeom;
}) {
  const PAL_SIZE = geom.pal;
  const palY = (geom.slot - geom.pal) / 2;
  const x = useSharedValue(palX(index, geom));
  const placedAt = useRef(index);
  const placedGeom = useRef(geom.slot);
  useEffect(() => {
    const target = palX(index, geom);
    if (placedAt.current === index && placedGeom.current === geom.slot) return;
    // A geometry change (Extra Slot shrinking the wells) re-seats instantly.
    const resized = placedGeom.current !== geom.slot;
    placedAt.current = index;
    placedGeom.current = geom.slot;
    x.set(reducedMotion || resized
      ? target
      : withTiming(target, { duration: RESHUFFLE_MS, easing: Easing.out(Easing.cubic) }));
  }, [index, reducedMotion, x, geom]);

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
      { translateY: palY },
      { scale: 1 + arrival.value * 0.1 },
    ],
  }));

  const ink = markContrast(charge.color);

  // Every held Pal may be relaunched now, so none is drawn as disabled.
  // `selected` is the positive hint instead: this one has an exposed match.
  return (
    <Animated.View style={[styles.heldPal, { width: PAL_SIZE, height: PAL_SIZE }, subdued && styles.socketSubdued, style]}>
      {pixelPal ? (
        <View>
          <PixelPalFace
            color={charge.color}
            size={PAL_SIZE}
            colorAssist={colorAssist}
            mood="calm"
            capacity={charge.capacity}
            selected={useful}
            animate={false}
          />
        </View>
      ) : (
        <View
          style={[
            styles.orb,
            {
              width: PAL_SIZE,
              height: PAL_SIZE,
              borderRadius: PAL_SIZE / 2,
              backgroundColor: orbColors[charge.color],
              borderColor: orbGlow[charge.color],
            },
          ]}
        >
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
    alignItems: 'flex-end',
    gap: 2,
  },
  label: { ...GP_TYPE.label },
  labelCount: { ...GP_TYPE.numeral, textAlign: 'right' },
  slots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: WELL_GAP,
  },
  // v2 recessed slot: dark glass, radius 12, a 2pt inset shade along the top.
  socket: {
    borderRadius: 12,
    backgroundColor: AV.recess,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  socketInset: {
    position: 'absolute',
    top: 0,
    left: 3,
    right: 3,
    height: 2,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  socketSubdued: { opacity: 0.55 },
  ring: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 15,
    borderWidth: 2,
  },
  spotlightRing: {
    position: 'absolute',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: GP.cyan,
    backgroundColor: 'transparent',
  },
  wells: { flexDirection: 'row', gap: WELL_GAP },
  heldPal: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center' },
  orb: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  orbGloss: {
    position: 'absolute',
    top: '10%',
    left: '14%',
    width: '32%',
    height: '22%',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    opacity: 0.4,
  },
  assist: { position: 'absolute', bottom: 2, alignSelf: 'center' },
  boosterSlot: { borderWidth: 1, borderStyle: 'dashed', borderColor: GP.textFaint, opacity: 0.5 },
  boosterMark: { color: GP.textMuted, fontSize: 22, fontWeight: '700' },
  count: { fontSize: 13, fontWeight: '800' },
});
