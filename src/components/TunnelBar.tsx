import { memo, useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  useAnimatedStyle,
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
import { homeAlpha, homeV2 } from '@/theme/homeV2';

interface TunnelBarProps {
  state: GameState;
  layoutVersion: number;
  disabled: boolean;
  colorAssist?: boolean;
  onLaunch: (tunnelId: string) => void;
  onSourceLayout: (key: string, point: Point) => void;
  tutorial?: TutorialView;
  /** Recessed mouths in the control deck — no cards, T-labels, or ghost circles. */
  embedded?: boolean;
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
  const { width } = useWindowDimensions();
  const inner = Math.max(240, width - 40);
  const gap = charges.length >= 4 ? 8 : 12;
  const col = (inner - gap * Math.max(0, charges.length - 1)) / Math.max(1, charges.length);
  const readySize = Math.min(64, Math.max(56, Math.floor(col - 12)));
  const queueSize = Math.round(readySize * 0.75);

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
          colorAssist={colorAssist}
          pixelPal={pixelPal}
          readySize={readySize}
          queueSize={queueSize}
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
  index, tunnelId, charge, tunnel, upcoming, disabled, colorAssist, pixelPal, readySize, queueSize,
  onLaunch, onSourceLayout, layoutVersion, highlighted, subdued,
}: {
  index: number;
  tunnelId: string;
  charge: Charge | null;
  tunnel: TunnelState | undefined;
  upcoming: number;
  disabled: boolean;
  colorAssist?: boolean;
  pixelPal: boolean;
  readySize: number;
  queueSize: number;
  onLaunch: (tunnelId: string) => void;
  onSourceLayout: (key: string, point: Point) => void;
  layoutVersion: number;
  highlighted: boolean;
  subdued: boolean;
}) {
  const empty = !charge;
  const reducedMotion = useReducedMotion();
  const ready = !empty && !disabled;
  const sourceRef = useRef<View | null>(null);
  const mounted = useRef(false);

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
    transform: [{ scale: 1 + spotlight.value * 0.05 }],
  }));

  const measure = useCallback(() => {
    sourceRef.current?.measureInWindow((x, y, width, height) =>
      onSourceLayout(tunnelId, { x: x + width / 2, y: y + height / 2 }));
  }, [onSourceLayout, tunnelId]);
  useEffect(() => { measure(); }, [layoutVersion, measure]);

  const recoil = useSharedValue(0);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    cancelAnimation(recoil);
    if (reducedMotion) {
      recoil.set(withSequence(withTiming(1, { duration: 60 }), withTiming(0, { duration: 160 })));
    } else {
      recoil.set(withSequence(
        withTiming(1, { duration: 70, easing: Easing.out(Easing.cubic) }),
        withSpring(0, { damping: 14, stiffness: 260 }),
      ));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [charge?.id]);

  const housingStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: reducedMotion ? 0 : -recoil.value * 2.5 },
      { scale: 1 - recoil.value * 0.03 },
    ],
  }));

  const ink = charge ? markContrast(charge.color) : null;
  const queue = Array.from({ length: upcoming }, (_, previewIdx) => tunnel?.queue[previewIdx + 1] ?? null);

  return (
    <Animated.View
      style={[styles.tunnel, empty && styles.tunnelEmpty, !empty && disabled && styles.tunnelBlocked, subdued && styles.tunnelSubdued, housingStyle]}
      accessibilityLabel={highlighted ? 'Tutorial: launch this tunnel' : undefined}
    >
      <Pressable
        disabled={disabled || empty}
        onPressIn={() => onLaunch(tunnelId)}
        accessibilityState={{ disabled: disabled || empty }}
        accessibilityRole="button"
        accessibilityLabel={
          charge
            ? `Launch tunnel ${index + 1}, ${orbLabel[charge.color]} Pal ${charge.capacity}`
            : `Tunnel ${index + 1} empty`
        }
        hitSlop={6}
        style={({ pressed }) => [styles.pressable, pressed && !empty && styles.tunnelPressed]}
      >
        <View style={styles.mouth}>
          {highlighted ? (
            <Animated.View pointerEvents="none" style={[styles.spotlightRing, { width: readySize + 16, height: readySize + 16, borderRadius: (readySize + 16) / 2 }, spotlightStyle]} />
          ) : null}

          {charge ? (
            <Animated.View
              key={charge.id}
              entering={reducedMotion ? FadeIn.duration(90) : FadeIn.duration(130).springify().damping(16)}
              ref={sourceRef}
              onLayout={measure}
              collapsable={false}
              style={styles.readySeat}
            >
              {pixelPal ? (
                <PixelPalFace color={charge.color} size={readySize} colorAssist={colorAssist} mood={ready ? 'focused' : 'calm'} capacity={charge.capacity} />
              ) : (
                <View style={[styles.charge, { width: readySize, height: readySize, borderRadius: readySize / 2, backgroundColor: orbColors[charge.color], borderColor: orbGlow[charge.color] }]}>
                  <Text style={[styles.capacity, { color: ink?.fill, fontSize: readySize * 0.34 }]}>{charge.capacity}</Text>
                  {colorAssist ? (
                    <View style={styles.assist} pointerEvents="none">
                      <ColorAssistMark color={charge.color} size={15} etched />
                    </View>
                  ) : null}
                </View>
              )}
            </Animated.View>
          ) : (
            <View style={[styles.emptyMouth, { width: readySize, height: readySize, borderRadius: readySize * 0.32 }]} />
          )}
        </View>

        <View style={styles.queue}>
          {queue.map((nextCharge, previewIdx) => {
            if (!nextCharge) return null;
            return (
              <View
                key={nextCharge.id}
                style={[
                  styles.queued,
                  {
                    marginTop: -queueSize * 0.6,
                    zIndex: upcoming - previewIdx,
                    opacity: 0.55,
                  },
                ]}
              >
                {pixelPal ? (
                  <PixelPalFace color={nextCharge.color} size={queueSize} capacity={nextCharge.capacity} />
                ) : (
                  <View
                    style={[
                      styles.charge,
                      {
                        width: queueSize,
                        height: queueSize,
                        borderRadius: queueSize / 2,
                        backgroundColor: orbColors[nextCharge.color],
                        borderColor: orbGlow[nextCharge.color],
                      },
                    ]}
                  >
                    <Text style={[styles.capacity, { color: markContrast(nextCharge.color).fill, fontSize: queueSize * 0.34 }]}>
                      {nextCharge.capacity}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      </Pressable>
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
  tunnel: { flex: 1, maxWidth: 88, alignItems: 'center' },
  pressable: { alignItems: 'center', width: '100%' },
  tunnelEmpty: { opacity: 0.45 },
  tunnelBlocked: { opacity: 0.72 },
  tunnelSubdued: { opacity: 0.55 },
  tunnelPressed: { transform: [{ translateY: 1 }, { scale: 0.97 }] },
  mouth: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 68,
  },
  readySeat: {
    zIndex: 4,
    marginBottom: 4,
  },
  emptyMouth: {
    backgroundColor: homeAlpha('#000C28', 0.9),
  },
  spotlightRing: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: homeV2.cyan,
    backgroundColor: 'transparent',
    zIndex: 5,
  },
  queue: {
    alignItems: 'center',
    marginTop: -4,
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
