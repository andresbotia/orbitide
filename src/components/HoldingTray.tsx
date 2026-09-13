import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { Charge } from '@/game/engine/types';
import type { Point } from '@/game/rendering/boardGeometry';
import { ColorAssistMark } from '@/components/ColorAssistMark';
import { markContrast } from '@/theme/colorAssist';
import { orbColors, orbGlow, orbLabel } from '@/theme/colors';
import { material } from '@/theme/material';
import { spacing, typography } from '@/theme/spacing';

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
}

/**
 * Holding — three permanent recessed sockets (UI-R4, presentation only: slot
 * count, pressure rules, and relaunch legality are unchanged). Occupied slots
 * read as dimensional Pixel Arcadia hardware; a slot plays a small local
 * arrival pop the moment its charge's id first appears in `holding` — no new
 * session/engine hook, just watching the same prop every other consumer of
 * `state.holding` already reads. The existing haptic hierarchy
 * (`holdingLand`/`holdingCritical`/`holdingFull`, fired by `useGameSession`
 * off real engine-event timing) is untouched and unduplicated here.
 */
export function HoldingTray({
  holding, capacity, overflow, disabled, usefulIds, colorAssist, onLaunch, onSourceLayout, message, layoutVersion, boosterSlot,
}: HoldingTrayProps) {
  const reducedMotion = useReducedMotion();
  const pressure = holding.length >= 2 && !overflow;

  // "Just arrived" detection: an id in `holding` that wasn't there last time
  // this prop changed. Diffed by identity, not by slot index, so a charge
  // shifting slots when a sibling is relaunched is never mistaken for an
  // arrival. Refs are only ever read/written inside the effect (never during
  // render) — the diff result lives in state instead.
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
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, tier === 'warn' && styles.labelWarn, tier === 'danger' && styles.labelDanger]}>
          HOLDING {holding.length}/{capacity}
        </Text>
        <PressureDots filled={holding.length} capacity={capacity} tier={tier} />
      </View>

      <View style={[styles.deck, tier === 'warn' && styles.deckWarn, tier === 'danger' && styles.deckDanger]}>
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
              onLaunch={onLaunch}
              onSourceLayout={onSourceLayout}
              layoutVersion={layoutVersion}
            />
          );
        })}

        {boosterSlot ? (
          <View style={[styles.socket, styles.boosterSlot]}>
            <Text style={styles.boosterMark}>+</Text>
          </View>
        ) : null}
      </View>

      <Text accessibilityLiveRegion="polite" style={styles.help}>
        {message || (holding.length ? 'Tap a held charge to launch it again.' : ' ')}
      </Text>
    </View>
  );
}

const SOCKET = 56;

const Slot = memo(function Slot({
  index, charge, useful, disabled, colorAssist, justArrived, reducedMotion, onLaunch, onSourceLayout, layoutVersion,
}: {
  index: number;
  charge: Charge | undefined;
  useful: boolean;
  disabled: boolean;
  colorAssist?: boolean;
  justArrived: boolean;
  reducedMotion: boolean;
  onLaunch: (id: string) => void;
  onSourceLayout: (key: string, point: Point) => void;
  layoutVersion: number;
}) {
  const slotRef = useRef<View | null>(null);
  const key = `holding-${index}`;

  const measure = useCallback(() => {
    slotRef.current?.measureInWindow((x, y, width, height) =>
      onSourceLayout(key, { x: x + width / 2, y: y + height / 2 }));
  }, [onSourceLayout, key]);
  useEffect(() => { measure(); }, [layoutVersion, measure]);

  // Arrival pop — a brief scale overshoot + colour-glow flash the instant
  // this slot's own charge identity is newly present (never on relaunch/empty).
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
    transform: [{ scale: reducedMotion ? 1 : 1 + arrival.value * 0.16 }],
  }));
  const arrivalGlow = useAnimatedStyle(() => ({ opacity: arrival.value * 0.8 }));

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
        ? `Relaunch ${orbLabel[charge.color]} charge, capacity ${charge.capacity}`
        : `Holding slot ${index + 1}, empty`}
      accessibilityHint={useful ? 'Tap to launch again' : 'No exposed matching pixels yet'}
      style={({ pressed }) => [
        styles.socket,
        useful && styles.socketReady,
        pressed && charge && styles.socketPressed,
      ]}
    >
      {charge ? (
        <Animated.View style={[styles.orbWrap, arrivalStyle]}>
          <Animated.View pointerEvents="none" style={[styles.arrivalGlow, { backgroundColor: orbGlow[charge.color] }, arrivalGlow]} />
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
        </Animated.View>
      ) : (
        <View style={styles.socketWell} />
      )}
    </Pressable>
  );
});

/** Shape-based pressure cue (not colour-only): fills left-to-right with the tray. */
function PressureDots({ filled, capacity, tier }: { filled: number; capacity: number; tier: 'normal' | 'warn' | 'danger' }) {
  const color = tier === 'danger' ? material.danger : tier === 'warn' ? material.warning : material.textSecondary;
  return (
    <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: capacity }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: i < filled ? color : material.outline, opacity: i < filled ? 1 : 0.6 },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { ...typography.label, color: material.textSecondary },
  labelWarn: { color: material.warning },
  labelDanger: { color: material.danger },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  deck: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: 16,
    backgroundColor: material.structuralSurface,
    borderWidth: 1,
    borderTopColor: material.bevelHighlight,
    borderLeftColor: material.bevelHighlight,
    borderRightColor: material.bevelShadow,
    borderBottomColor: material.bevelShadow,
  },
  deckWarn: { borderTopColor: material.warning, borderLeftColor: material.warning },
  deckDanger: { borderColor: material.danger, borderTopColor: material.danger, borderLeftColor: material.danger },
  socket: {
    width: SOCKET,
    height: SOCKET,
    borderRadius: 14,
    backgroundColor: material.recessedSurface,
    borderWidth: 1,
    borderTopColor: material.bevelShadow,
    borderLeftColor: material.bevelShadow,
    borderRightColor: material.outline,
    borderBottomColor: material.outline,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  socketWell: {
    width: SOCKET * 0.5,
    height: SOCKET * 0.5,
    borderRadius: SOCKET * 0.25,
    backgroundColor: material.bevelShadow,
    opacity: 0.7,
  },
  socketReady: {
    borderColor: material.accentCyan,
    borderTopColor: material.accentCyan,
    borderLeftColor: material.accentCyan,
    borderRightColor: material.accentCyan,
    borderBottomColor: material.accentCyan,
  },
  socketPressed: { transform: [{ scale: 0.94 }], backgroundColor: material.bevelShadow },
  orbWrap: { alignItems: 'center', justifyContent: 'center' },
  arrivalGlow: {
    position: 'absolute',
    width: SOCKET * 0.95,
    height: SOCKET * 0.95,
    borderRadius: SOCKET * 0.48,
  },
  orb: {
    width: SOCKET * 0.68,
    height: SOCKET * 0.68,
    borderRadius: SOCKET * 0.34,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  orbGloss: {
    position: 'absolute',
    top: SOCKET * 0.1,
    left: SOCKET * 0.14,
    width: SOCKET * 0.32,
    height: SOCKET * 0.22,
    borderRadius: SOCKET * 0.2,
    backgroundColor: '#FFFFFF',
    opacity: 0.4,
  },
  assist: { position: 'absolute', bottom: 2, alignSelf: 'center' },
  boosterSlot: { borderStyle: 'dashed', borderColor: material.outline, opacity: 0.5 },
  boosterMark: { color: material.textSecondary, fontSize: 22, fontWeight: '700' },
  count: { fontSize: 17, fontWeight: '800' },
  help: { color: material.textSecondary, fontSize: 12, minHeight: 16, textAlign: 'center', paddingHorizontal: 12 },
});
