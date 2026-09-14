import { memo, useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { Point } from '@/game/rendering/boardGeometry';
import { ColorAssistMark } from '@/components/ColorAssistMark';
import { PixelPalFace } from '@/game/rendering/pixelPal/PixelPalFace';
import { upcomingPreviewCount, visibleCharges } from '@/game/engine/selectors';
import { isCoreV2 } from '@/game/engine/ruleset';
import type { Charge, GameState, TunnelState } from '@/game/engine/types';
import { isTunnelHighlighted, isTunnelSubdued } from '@/game/presentation/tutorialCoach';
import type { TutorialView } from '@/game/tutorial';
import { markContrast } from '@/theme/colorAssist';
import { orbColors, orbGlow, orbLabel } from '@/theme/colors';
import { material } from '@/theme/material';
import { spacing } from '@/theme/spacing';

interface TunnelBarProps {
  state: GameState;
  layoutVersion: number;
  disabled: boolean;
  colorAssist?: boolean;
  onLaunch: (tunnelId: string) => void;
  onSourceLayout: (key: string, point: Point) => void;
  /** M5.4C — Core V2 Level 1 tutorial spotlight/dim. Omitted (or inactive) outside that tutorial. */
  tutorial?: TutorialView;
}

/**
 * Launch tunnels — presentation only. Renders however many tunnels the state
 * has (Legacy V1: 3, Core V2: 4). Each magazine shows the loaded front plus a
 * bounded upcoming preview; the hidden queue tail stays in engine state.
 */
export const TunnelBar = memo(function TunnelBar({ state, disabled, colorAssist, onLaunch, onSourceLayout, layoutVersion, tutorial }: TunnelBarProps) {
  const charges = visibleCharges(state);
  const upcoming = upcomingPreviewCount(state.ruleset);
  const pixelPal = isCoreV2(state.ruleset);

  return (
    <View style={[styles.row, charges.length >= 4 && styles.rowCompact]}>
      {charges.map(({ tunnelId, charge }, index) => (
        <Tunnel
          key={tunnelId}
          index={index}
          tunnelId={tunnelId}
          charge={charge}
          tunnel={state.tunnels[index]}
          upcoming={upcoming}
          disabled={disabled}
          colorAssist={colorAssist}
          pixelPal={pixelPal}
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
  && prev.layoutVersion === next.layoutVersion
  && prev.colorAssist === next.colorAssist
  && prev.onLaunch === next.onLaunch
  && prev.onSourceLayout === next.onSourceLayout
  && prev.tutorial === next.tutorial
));

const Tunnel = memo(function Tunnel({
  index, tunnelId, charge, tunnel, upcoming, disabled, colorAssist, pixelPal, onLaunch, onSourceLayout, layoutVersion,
  highlighted, subdued,
}: {
  index: number;
  tunnelId: string;
  charge: Charge | null;
  tunnel: TunnelState | undefined;
  upcoming: number;
  disabled: boolean;
  colorAssist?: boolean;
  /** M5.3 — Core V2 renders the shared Pixel Pal body; Legacy V1 keeps its plain orb. */
  pixelPal: boolean;
  onLaunch: (tunnelId: string) => void;
  onSourceLayout: (key: string, point: Point) => void;
  layoutVersion: number;
  /** M5.4C — this is the tutorial's intended tunnel; spotlight it. */
  highlighted: boolean;
  /** M5.4C — the tutorial is steering the player elsewhere; read as inviting-but-quiet. */
  subdued: boolean;
}) {
  const empty = !charge;
  const reducedMotion = useReducedMotion();
  const ready = !empty && !disabled;
  const sourceRef = useRef<View | null>(null);
  const mounted = useRef(false);

  // Tutorial spotlight — a slow pulse on the intended tunnel only. Skipped
  // entirely outside the tutorial (shared value stays at rest) and reduced to
  // a steady glow (no motion) under reduced-motion.
  const spotlight = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(spotlight);
    if (!highlighted) { spotlight.set(withTiming(0, { duration: 160 })); return; }
    if (reducedMotion) { spotlight.set(withTiming(1, { duration: 160 })); return; }
    spotlight.set(withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(spotlight);
  }, [highlighted, reducedMotion, spotlight]);
  const spotlightStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + spotlight.value * 0.65,
    transform: [{ scale: 1 + spotlight.value * 0.08 }],
  }));

  const measure = useCallback(() => {
    sourceRef.current?.measureInWindow((x, y, width, height) =>
      onSourceLayout(tunnelId, { x: x + width / 2, y: y + height / 2 }));
  }, [onSourceLayout, tunnelId]);
  useEffect(() => { measure(); }, [layoutVersion, measure]);

  // Launch recoil — the housing kicks back then springs to rest the instant
  // the loaded charge changes (i.e. a launch actually happened; the queue is
  // the single source of truth, nothing is timed locally). Skipped on mount.
  const recoil = useSharedValue(0);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    cancelAnimation(recoil);
    if (reducedMotion) {
      // No travel under reduced motion — a brief flash communicates the same state change.
      recoil.set(withSequence(withTiming(1, { duration: 60 }), withTiming(0, { duration: 160 })));
    } else {
      recoil.set(withSequence(
        withTiming(1, { duration: 70, easing: Easing.out(Easing.cubic) }),
        withSpring(0, { damping: 14, stiffness: 260 }),
      ));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charge?.id]);

  // Idle readiness breathe — only while a real, launchable charge is loaded.
  const breathe = useSharedValue(0.5);
  useEffect(() => {
    cancelAnimation(breathe);
    if (!ready || reducedMotion) { breathe.set(0.5); return; }
    breathe.set(withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(breathe);
  }, [ready, reducedMotion, breathe]);

  const housingStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: reducedMotion ? 0 : -recoil.value * 2.5 },
      { scale: 1 - recoil.value * 0.03 },
    ],
  }));
  const readinessGlow = useDerivedValue(() => (ready ? 0.18 + breathe.value * 0.14 : 0) + recoil.value * 0.5);
  const glowStyle = useAnimatedStyle(() => ({ opacity: readinessGlow.value }));
  const flashStyle = useAnimatedStyle(() => (reducedMotion ? { opacity: recoil.value * 0.6 } : { opacity: 0 }));

  const ink = charge ? markContrast(charge.color) : null;

  return (
    <Animated.View
      style={[
        styles.tunnel,
        empty && styles.tunnelEmpty,
        !empty && disabled && styles.tunnelBlocked,
        subdued && styles.tunnelSubdued,
        housingStyle,
      ]}
      accessibilityLabel={highlighted ? 'Tutorial: launch this tunnel' : undefined}
    >
      <Pressable
        disabled={disabled || empty}
        onPressIn={() => onLaunch(tunnelId)}
        accessibilityState={{ disabled: disabled || empty }}
        accessibilityRole="button"
        accessibilityLabel={
          charge
            ? `Launch tunnel ${index + 1}, ${orbLabel[charge.color]} charge ${charge.capacity}`
            : `Tunnel ${index + 1} empty`
        }
        hitSlop={6}
        style={({ pressed }) => [styles.pressable, pressed && !empty && styles.tunnelPressed]}
      >
        <Text style={styles.tunnelLabel}>T{index + 1}</Text>

        <View style={styles.port}>
          {/* Tutorial spotlight ring — the M5.4C intended-tunnel highlight.
              Semantic (driven by `highlighted`), never a hardcoded position. */}
          {highlighted ? (
            <Animated.View pointerEvents="none" style={[styles.spotlightRing, spotlightStyle]} />
          ) : null}
          {/* Readiness/recoil glow ring — behind the charge, never recolors it. */}
          <Animated.View pointerEvents="none" style={[styles.readiness, glowStyle]} />
          <Animated.View pointerEvents="none" style={[styles.flash, flashStyle]} />

          {charge ? (
            <Animated.View
              key={charge.id}
              entering={reducedMotion ? FadeIn.duration(90) : FadeIn.duration(130).springify().damping(16)}
              ref={sourceRef}
              onLayout={measure}
              collapsable={false}
            >
              {pixelPal ? (
                <PixelPalFace color={charge.color} size={CHARGE} colorAssist={colorAssist}>
                  <Text style={styles.palCapacity}>{charge.capacity}</Text>
                </PixelPalFace>
              ) : (
                <View style={[styles.charge, { backgroundColor: orbColors[charge.color], borderColor: orbGlow[charge.color] }]}>
                  <View style={styles.chargeGloss} />
                  <Text
                    style={[
                      styles.capacity,
                      { color: ink?.fill },
                      ink?.halo ? { textShadowColor: ink.halo, textShadowRadius: 3, textShadowOffset: { width: 0, height: 0 } } : null,
                    ]}
                  >
                    {charge.capacity}
                  </Text>
                  {colorAssist ? (
                    <View style={styles.assist} pointerEvents="none">
                      <ColorAssistMark color={charge.color} size={15} etched />
                    </View>
                  ) : null}
                </View>
              )}
            </Animated.View>
          ) : (
            <View style={[styles.charge, styles.chargeEmpty]}>
              <Text style={styles.emptyMark}>—</Text>
            </View>
          )}
        </View>

        {/* Look-ahead: NEXT and NEXT+1 (Core V2) or the legacy magazine depth. */}
        <View style={styles.queueTray}>
          {Array.from({ length: upcoming }).map((_, previewIdx) => {
            const nextCharge = tunnel?.queue[previewIdx + 1];
            if (nextCharge) {
              if (pixelPal) {
                return (
                  <PixelPalFace key={nextCharge.id} color={nextCharge.color} size={PREVIEW_SIZE}>
                    <Text style={styles.palPreviewCapacity}>{nextCharge.capacity}</Text>
                  </PixelPalFace>
                );
              }
              const previewInk = markContrast(nextCharge.color);
              return (
                <View
                  key={nextCharge.id}
                  style={[
                    styles.previewChip,
                    {
                      backgroundColor: orbColors[nextCharge.color],
                      borderColor: orbGlow[nextCharge.color],
                    },
                  ]}
                >
                  <View style={styles.previewGloss} />
                  <Text style={[styles.previewCapacity, { color: previewInk.fill }]}>{nextCharge.capacity}</Text>
                  {colorAssist ? (
                    <View style={styles.previewAssist} pointerEvents="none">
                      <ColorAssistMark color={nextCharge.color} size={7} etched />
                    </View>
                  ) : null}
                </View>
              );
            }
            return (
              <View key={`empty-${previewIdx}`} style={[styles.previewChip, styles.previewEmpty]}>
                <View style={styles.previewDot} />
              </View>
            );
          })}
        </View>
      </Pressable>
    </Animated.View>
  );
});

const CHARGE = 46;
const PREVIEW_SIZE = 18;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md },
  rowCompact: { gap: spacing.sm },
  tunnel: {
    borderRadius: 16,
    minWidth: 84,
  },
  pressable: {
    alignItems: 'center',
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderTopColor: material.bevelHighlight,
    borderLeftColor: material.bevelHighlight,
    borderRightColor: material.bevelShadow,
    borderBottomColor: material.bevelShadow,
    backgroundColor: material.structuralSurface,
    minWidth: 84,
  },
  tunnelEmpty: { opacity: 0.4 },
  // Rail-full or otherwise blocked, but this tunnel still has a loaded charge —
  // dimmer than active, but distinguishable from a truly-empty tunnel.
  tunnelBlocked: { opacity: 0.72 },
  // M5.4C — tutorial is steering the player to a different tunnel. Gentle,
  // not the heavy `tunnelBlocked` dim (this tunnel isn't actually broken).
  tunnelSubdued: { opacity: 0.55 },
  tunnelPressed: { transform: [{ translateY: 1 }, { scale: 0.97 }], backgroundColor: material.recessedSurface },
  port: {
    width: CHARGE + 12,
    height: CHARGE + 12,
    borderRadius: (CHARGE + 12) / 2,
    backgroundColor: material.recessedSurface,
    borderWidth: 1,
    borderTopColor: material.bevelShadow,
    borderLeftColor: material.bevelShadow,
    borderRightColor: material.outline,
    borderBottomColor: material.outline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readiness: {
    position: 'absolute',
    width: CHARGE + 20,
    height: CHARGE + 20,
    borderRadius: (CHARGE + 20) / 2,
    backgroundColor: material.accentCyan,
  },
  // M5.4C — tutorial spotlight ring, larger and brighter than `readiness` so
  // the intended tunnel reads as obvious at a glance without darkening the rest.
  spotlightRing: {
    position: 'absolute',
    width: CHARGE + 32,
    height: CHARGE + 32,
    borderRadius: (CHARGE + 32) / 2,
    borderWidth: 2.5,
    borderColor: material.accentCyan,
    backgroundColor: 'transparent',
  },
  flash: {
    position: 'absolute',
    width: CHARGE + 20,
    height: CHARGE + 20,
    borderRadius: (CHARGE + 20) / 2,
    backgroundColor: material.energyWarm,
  },
  charge: {
    width: CHARGE,
    height: CHARGE,
    borderRadius: CHARGE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chargeGloss: {
    position: 'absolute',
    top: CHARGE * 0.16,
    left: CHARGE * 0.2,
    width: CHARGE * 0.5,
    height: CHARGE * 0.36,
    borderRadius: CHARGE * 0.3,
    backgroundColor: '#FFFFFF',
    opacity: 0.4,
  },
  chargeEmpty: { backgroundColor: material.recessedSurface, borderColor: material.outline },
  assist: { position: 'absolute', bottom: 3, alignSelf: 'center' },
  capacity: { fontSize: 18, fontWeight: '800' },
  palCapacity: { fontSize: CHARGE * 0.34, fontWeight: '900', color: '#F4F8FF' },
  palPreviewCapacity: { fontSize: PREVIEW_SIZE * 0.42, fontWeight: '900', color: '#F4F8FF' },
  emptyMark: { color: material.textSecondary, fontSize: 16 },
  tunnelLabel: { marginBottom: 3, color: material.textSecondary, fontSize: 10, letterSpacing: 2, fontWeight: '700' },
  queueTray: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: spacing.xs,
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderRadius: 11,
    backgroundColor: material.recessedSurface,
    borderWidth: 1,
    borderTopColor: material.bevelShadow,
    borderLeftColor: material.bevelShadow,
    borderRightColor: material.outline,
    borderBottomColor: material.outline,
  },
  previewChip: {
    width: PREVIEW_SIZE,
    height: PREVIEW_SIZE,
    borderRadius: PREVIEW_SIZE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  previewGloss: {
    position: 'absolute',
    top: 1.5,
    left: 2.5,
    width: PREVIEW_SIZE * 0.5,
    height: PREVIEW_SIZE * 0.35,
    borderRadius: PREVIEW_SIZE * 0.25,
    backgroundColor: '#FFFFFF',
    opacity: 0.4,
  },
  previewCapacity: {
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 11,
  },
  previewAssist: {
    position: 'absolute',
    bottom: 0.5,
    alignSelf: 'center',
  },
  previewEmpty: {
    backgroundColor: material.recessedSurface,
    borderColor: material.outline,
    opacity: 0.35,
  },
  previewDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: material.textSecondary,
  },
});
