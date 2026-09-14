import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
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
import { homeAlpha, homeV2 } from '@/theme/homeV2';

interface HoldingTrayProps {
  holding: Charge[];
  capacity: number;
  overflow: boolean;
  disabled: boolean;
  usefulIds: Set<string>;
  colorAssist?: boolean;
  onLaunch: (id: string) => void;
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

/**
 * Holding tray — slot count comes from `capacity` (Legacy V1: 3, Core V2: 4).
 * Pressure uses `capacity - 1` / `capacity`, not hardcoded 2/3.
 */
export const HoldingTray = memo(function HoldingTray({
  holding, capacity, overflow, disabled, usefulIds, colorAssist, onLaunch, onSourceLayout, layoutVersion, boosterSlot, pixelPal,
  tutorial,
}: HoldingTrayProps) {
  const reducedMotion = useReducedMotion();
  const pressure = holding.length >= holdingWarnAt(capacity) && !overflow;

  const prevIds = useRef<Set<string>>(new Set(holding.map((c) => c.id)));
  const [arrivedIds, setArrivedIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const prev = prevIds.current;
    const next = new Set(holding.filter((c) => !prev.has(c.id)).map((c) => c.id));
    prevIds.current = new Set(holding.map((c) => c.id));
    if (next.size > 0) setArrivedIds(next);
    else setArrivedIds((current) => (current.size > 0 ? new Set() : current));
  }, [holding]);

  const tier: 'normal' | 'warn' | 'danger' = overflow ? 'danger' : pressure ? 'warn' : 'normal';

  return (
    <View style={[styles.row, tier === 'warn' && styles.rowWarn, tier === 'danger' && styles.rowDanger]}>
      {Array.from({ length: capacity }, (_, index) => {
        const charge = holding[index];
        const useful = !!charge && usefulIds.has(charge.id);
        return (
          <Slot
            key={index}
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
  );
});

const SOCKET = 52;
const PAL = 44;

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
  onLaunch: (id: string) => void;
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

  const arrivalStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reducedMotion ? 1 : 1 + arrival.value * 0.12 }],
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

  const bob = useSharedValue(0);
  const chargeId = charge?.id;
  useEffect(() => {
    cancelAnimation(bob);
    if (!chargeId || reducedMotion) { bob.set(0); return; }
    bob.set(withDelay(
      (index * 420) % 1700,
      withRepeat(withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.sin) }), -1, true),
    ));
    return () => cancelAnimation(bob);
  }, [chargeId, reducedMotion, index, bob]);
  const bobStyle = useAnimatedStyle(() => ({ transform: [{ translateY: -bob.value * 1.6 }] }));

  const ink = charge ? markContrast(charge.color) : null;

  return (
    <Pressable
      ref={slotRef}
      collapsable={false}
      onLayout={measure}
      disabled={disabled || !charge}
      onPressIn={() => charge && onLaunch(charge.id)}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || !charge }}
      accessibilityLabel={charge
        ? `Relaunch ${orbLabel[charge.color]} Pal, capacity ${charge.capacity}`
        : `Holding slot ${index + 1}, empty`}
      accessibilityHint={useful ? 'Tap to launch again' : 'No exposed matching pixels yet'}
      style={({ pressed }) => [
        styles.socket,
        subdued && styles.socketSubdued,
        pressed && charge && styles.socketPressed,
      ]}
    >
      {highlighted ? (
        <Animated.View pointerEvents="none" style={[styles.spotlightRing, spotlightStyle]} />
      ) : null}
      {charge ? (
        <Animated.View style={bobStyle}>
          <Animated.View style={[styles.orbWrap, arrivalStyle]}>
            {pixelPal ? (
              <View style={{ opacity: useful ? 1 : 0.7 }}>
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
              <View style={[styles.orb, { backgroundColor: orbColors[charge.color], borderColor: orbGlow[charge.color], opacity: useful ? 1 : 0.7 }]}>
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
        </Animated.View>
      ) : (
        <View style={styles.socketWell} />
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    height: 64,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  rowWarn: { borderColor: homeV2.yellow },
  rowDanger: { borderColor: '#F24B5D' },
  socket: {
    width: SOCKET,
    height: SOCKET,
    borderRadius: 14,
    backgroundColor: homeAlpha('#000C28', 0.85),
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  socketWell: {
    width: SOCKET * 0.42,
    height: SOCKET * 0.42,
    borderRadius: SOCKET * 0.21,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  socketPressed: { transform: [{ scale: 0.94 }] },
  socketSubdued: { opacity: 0.55 },
  spotlightRing: {
    position: 'absolute',
    width: SOCKET + 10,
    height: SOCKET + 10,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: homeV2.cyan,
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
  boosterSlot: { borderWidth: 1, borderStyle: 'dashed', borderColor: homeAlpha(homeV2.white, 0.2), opacity: 0.5 },
  boosterMark: { color: homeAlpha(homeV2.white, 0.45), fontSize: 22, fontWeight: '700' },
  count: { fontSize: 17, fontWeight: '800' },
});
