import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
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
import { GAMEPLAY } from '@/theme/gameplayLayout';
import { material } from '@/theme/material';
import { NEON, neonAlpha } from '@/theme/neon';

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


  // Pure gameplay-pressure ladder — a function of occupancy only, never of
  // win/loss status. "danger" means the tray is literally full, whether or
  // not that turns out to be fatal.
  const atCapacity = capacity > 0 && holding.length >= capacity;
  const pressure = holding.length >= holdingWarnAt(capacity) && !atCapacity;
  const tier: HoldingTier = holding.length === 0 ? 'calm' : atCapacity ? 'danger' : pressure ? 'warning' : 'occupied';

  // One-shot pop on the label when pressure *escalates* into warning/danger —
  // never a standing pulse, never on de-escalation (a relaunch freeing a slot).
  const prevRank = useRef(TIER_RANK[tier]);
  const tierPulse = useSharedValue(0);
  useEffect(() => {
    const rank = TIER_RANK[tier];
    if (rank >= TIER_RANK.warning && rank > prevRank.current) {
      cancelAnimation(tierPulse);
      tierPulse.set(withSequence(withTiming(1, { duration: 100 }), withTiming(0, { duration: 240 })));
    }
    prevRank.current = rank;
  }, [tier, tierPulse]);
  const tierPulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + tierPulse.value * 0.1 }] }));

  return (
    <View style={styles.row}>
      {/* Holding label — compact, functional */}
      <Animated.View style={[styles.labelWrap, tierPulseStyle]}>
        <Text style={[
          styles.label,
          tier === 'occupied' && styles.labelOccupied,
          tier === 'warning' && styles.labelWarn,
          tier === 'danger' && styles.labelDanger,
        ]}>
          HOLDING
        </Text>
        <Text style={[
          styles.labelCount,
          tier === 'occupied' && styles.labelOccupied,
          tier === 'warning' && styles.labelWarn,
          tier === 'danger' && styles.labelDanger,
        ]}>
          {holding.length}/{capacity}
        </Text>
      </Animated.View>
      <View style={styles.slots}>
        {Array.from({ length: capacity }, (_, index) => {
          const charge = holding[index];
          const useful = !!charge && usefulIds.has(charge.id);
          return (
            <Slot
              key={charge ? `slot-${index}-${charge.id}` : `slot-${index}-empty`}
              index={index}
              charge={charge}
              useful={useful}
              disabled={disabled}
              colorAssist={colorAssist}
              justArrived={!!charge && arrivedIds.has(charge.id)}
              reducedMotion={reducedMotion}
              pixelPal={!!pixelPal}
              onLaunch={onLaunch}
              onSourceLayout={onSourceLayout}
              layoutVersion={layoutVersion}
              highlighted={!!charge && !!tutorial && isHeldChargeHighlighted(tutorial, charge.id)}
              subdued={!!charge && !!tutorial && isHeldChargeSubdued(tutorial, charge.id)}
            />
          );
        })}

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

const Slot = memo(function Slot({
  index, charge, useful, disabled, colorAssist, justArrived, reducedMotion, pixelPal, onLaunch, onSourceLayout, layoutVersion,
  highlighted, subdued,
}: {
  index: number;
  charge: Charge | undefined;
  useful: boolean;
  disabled: boolean;
  colorAssist?: boolean;
  justArrived: boolean;
  reducedMotion: boolean;
  pixelPal: boolean;
  onLaunch: (id: string) => boolean;
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

  const arrival = useSharedValue(0);
  useEffect(() => {
    if (!justArrived) return;
    cancelAnimation(arrival);
    if (reducedMotion) {
      arrival.set(withSequence(withTiming(1, { duration: 60 }), withTiming(0, { duration: 200 })));
    } else {
      arrival.set(withSequence(
        withTiming(1, { duration: 90, easing: Easing.out(Easing.cubic) }),
        withSpring(0, { damping: 13, stiffness: 220 }),
      ));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justArrived]);

  // One-shot rejection shake — never a standing state, distinct from the
  // arrival bounce above (which fires when a Pal actually lands here).
  const shakeX = useSharedValue(0);
  const triggerDeniedShake = useCallback(() => {
    cancelAnimation(shakeX);
    shakeX.set(withSequence(
      withTiming(-4, { duration: 35 }), withTiming(4, { duration: 60 }),
      withTiming(-3, { duration: 60 }), withTiming(0, { duration: 50 }),
    ));
  }, [shakeX]);

  const arrivalStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: reducedMotion ? 1 : 1 + arrival.value * 0.1 },
      { translateX: shakeX.value },
    ],
  }));

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

  // Removed per-slot idle bob animation. It was a subtle floating motion that
  // ran an infinite withRepeat per slot — 3-4 concurrent animation loops just
  // for visual ambience. The Pal character already has expression/blink, making
  // the bob redundant and expensive (3+ UI-thread worklets running permanently).

  const ink = charge ? markContrast(charge.color) : null;

  return (
    <Pressable
      ref={slotRef}
      collapsable={false}
      onLayout={measure}
      disabled={disabled || !charge}
      onPressIn={() => { if (charge && !onLaunch(charge.id)) triggerDeniedShake(); }}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || !charge }}
      accessibilityLabel={charge
        ? `Relaunch ${orbLabel[charge.color]} Pal, capacity ${charge.capacity}`
        : `Holding slot ${index + 1}, empty`}
      accessibilityHint={useful ? 'Tap to launch again' : 'No exposed matching pixels yet'}
      style={({ pressed }) => [
        styles.socket,
        charge ? styles.socketOccupied : null,
        subdued && styles.socketSubdued,
        pressed && charge && styles.socketPressed,
      ]}
    >
      {highlighted ? (
        <Animated.View pointerEvents="none" style={[styles.spotlightRing, spotlightStyle]} />
      ) : null}
      {charge ? (
        <Animated.View style={[styles.orbWrap, arrivalStyle]}>
          {pixelPal ? (
            <View style={{ opacity: useful ? 1 : 0.65 }}>
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
            <View style={[styles.orb, { backgroundColor: orbColors[charge.color], borderColor: orbGlow[charge.color], opacity: useful ? 1 : 0.65 }]}>
              <View style={styles.orbGloss} />
              <Text
                style={[
                  styles.count,
                  { color: ink?.fill },
                  ink?.halo ? { textShadowColor: ink.halo, textShadowRadius: 3, textShadowOffset: { width: 0, height: 0 } } : null,
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
      ) : (
        <View style={styles.socketWell} />
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    gap: 4,
  },
  labelWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    alignSelf: 'flex-start',
    paddingLeft: 4,
  },
  label: {
    color: neonAlpha(NEON.cyanPale, 0.5),
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  labelCount: {
    color: neonAlpha(NEON.cyanPale, 0.45),
    fontSize: 10,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  labelOccupied: { color: NEON.cyanPale },
  labelWarn: { color: NEON.gold },
  labelDanger: { color: material.danger },
  slots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  // Dark ink well + a single neon ring — Home's socket/pill language, not the
  // old two-tone bevel-pair hardware trick.
  socket: {
    width: SOCKET,
    height: SOCKET,
    borderRadius: 16,
    backgroundColor: neonAlpha(NEON.ink, 0.55),
    borderWidth: 1,
    borderColor: neonAlpha(NEON.cyan, 0.16),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  socketOccupied: {
    backgroundColor: neonAlpha(NEON.ink, 0.78),
    borderColor: neonAlpha(NEON.cyan, 0.3),
  },
  socketWell: {
    width: SOCKET * 0.3,
    height: SOCKET * 0.3,
    borderRadius: SOCKET * 0.15,
    backgroundColor: NEON.inkDeep,
    borderWidth: 1,
    borderColor: neonAlpha(NEON.cyan, 0.08),
  },
  socketPressed: { transform: [{ scale: 0.94 }] },
  socketSubdued: { opacity: 0.55 },
  spotlightRing: {
    position: 'absolute',
    width: SOCKET + 8,
    height: SOCKET + 8,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: NEON.cyan,
    backgroundColor: 'transparent',
  },
  orbWrap: { alignItems: 'center', justifyContent: 'center' },
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
  boosterSlot: { borderWidth: 1, borderStyle: 'dashed', borderColor: neonAlpha(NEON.cyanPale, 0.2), opacity: 0.5 },
  boosterMark: { color: neonAlpha(NEON.cyanPale, 0.45), fontSize: 22, fontWeight: '700' },
  count: { fontSize: 17, fontWeight: '800' },
});
