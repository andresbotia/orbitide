import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useDeviceTilt, type DeviceTilt } from '@/hooks/useDeviceTilt';
import { useHomeTilt } from '@/hooks/useHomeTilt';
import { NEON, neonAlpha } from '@/theme/neon';

import { CityLayer, FloorLayer, FxLayer, ReflectionLayer, SkyLayer } from './environment';
import { GRID_RATIO, sceneFrame } from './environment/sceneGeometry';

interface HomeEnvironmentProps {
  width: number;
  height: number;
  /** Screen focused and app foregrounded. All motion pauses when false. */
  active: boolean;
  /** Drop to a fully static scene when true. */
  reducedMotion: boolean;
}

/**
 * Scrim over the scene, under the UI. The scene is busy enough to eat white
 * text: darkest at the HUD and title, clearest through the mascot, dark again
 * under the level card, PLAY and the nav.
 */
const SCRIM_COLORS = [
  neonAlpha(NEON.inkDeep, 0.85),
  neonAlpha(NEON.inkDeep, 0.15),
  neonAlpha(NEON.inkDeep, 0.75),
] as const;
const SCRIM_LOCATIONS = [0, 0.45, 1] as const;

/** Layers render this much larger than the viewport so drift and tilt never expose an edge. */
const OVERSCAN = 1.1;

/**
 * Motion only reads as depth when depths move at different rates. `drift` is px
 * of sway either side over one full back-and-forth `periodMs`; `tilt` is px of
 * travel at the ±0.3 rad sensor clamp.
 */
const PARALLAX = {
  // No drift: the sky is at infinity, so the painted sun stays locked on the
  // floor's vanishing point.
  sky: { tilt: 4 },
  city: { drift: 14, periodMs: 11000, tilt: 12 },
  // Applied as a shear about the vanishing point: `drift` px at the near edge,
  // zero at the horizon, so the grid keeps converging on the sun.
  floor: { drift: 26, periodMs: 9000, tilt: 24 },
} as const;

/** Time for the floor to advance one grid row, i.e. scale by GRID_RATIO. */
const FLOOR_STEP_MS = 2400;
/** Phase at which one floor copy is fully opaque and the other invisible. */
const FLOOR_REST_PHASE = 0.5;
const LOG_GRID_RATIO = Math.log(GRID_RATIO);

/**
 * PIXEL ARCADIA HOME SCENE — neon skyline at dusk over a perspective grid.
 *
 * Back to front: sky, city, floor reflections, two floor copies, fx, then the
 * legibility scrim.
 * Each layer is static (painted art or a Skia picture) in its own
 * Animated.View; every frame of motion is a transform or opacity on the UI
 * thread, so nothing redraws.
 *
 * - Parallax drift: city and floor sway at their own amplitude and period,
 *   sine-eased. The sky never drifts, and the floor sways as a shear about the
 *   vanishing point, so the grid always converges on the painted sun.
 * - Floor: a perspective grid cannot scroll with translateY, because rows must
 *   accelerate toward the viewer. Each copy scales about the vanishing point
 *   from 1 to GRID_RATIO and wraps; the copies run half a phase apart and
 *   cross-fade with sin² weights that sum to exactly 1, so each copy is fully
 *   transparent at its own reset and the loop point never shows.
 * - Flicker: irregular opacity sequence on fx only, so it reads electrical.
 * - Tilt: DeviceMotion feeds the same translates, gated by the Home tilt
 *   setting and by sensor availability.
 *
 * Reduced motion or an inactive screen drops everything to a static rest pose.
 * No blur radius or shadow is ever animated; the fx glow is pre-blurred.
 */
export const HomeEnvironment = memo(function HomeEnvironment({
  width,
  height,
  active,
  reducedMotion,
}: HomeEnvironmentProps) {
  const motionOn = active && !reducedMotion;
  const tiltSetting = useHomeTilt();
  const tilt = useDeviceTilt(motionOn && tiltSetting);

  const cityDrift = useSharedValue(0);
  const floorDrift = useSharedValue(0);
  const floorPhase = useSharedValue(FLOOR_REST_PHASE);
  const flicker = useSharedValue(1);

  useEffect(() => {
    const values = [cityDrift, floorDrift, floorPhase, flicker];
    values.forEach((v) => cancelAnimation(v));
    cityDrift.set(0);
    floorDrift.set(0);
    floorPhase.set(FLOOR_REST_PHASE);
    flicker.set(1);
    if (!motionOn) return;

    sway(cityDrift, PARALLAX.city.periodMs);
    sway(floorDrift, PARALLAX.floor.periodMs);

    floorPhase.set(0);
    floorPhase.set(withRepeat(withTiming(1, { duration: FLOOR_STEP_MS, easing: Easing.linear }), -1, false));

    flicker.set(
      withRepeat(
        withSequence(
          withTiming(0.55, { duration: 90 }),
          withTiming(1, { duration: 140 }),
          withTiming(0.7, { duration: 60 }),
          withTiming(1, { duration: 900 }),
          withDelay(2400, withTiming(0.82, { duration: 60 })),
          withTiming(1, { duration: 120 }),
          withDelay(3100, withTiming(1, { duration: 0 })),
        ),
        -1,
        false,
      ),
    );

    return () => values.forEach((v) => cancelAnimation(v));
  }, [motionOn, cityDrift, floorDrift, floorPhase, flicker]);

  const layerW = Math.round(width * OVERSCAN);
  const layerH = Math.round(height * OVERSCAN);
  const frameStyle = useMemo(
    () => ({
      width: layerW,
      height: layerH,
      left: -(layerW - width) / 2,
      top: -(layerH - height) / 2,
    }),
    [layerW, layerH, width, height],
  );
  // Offset from the layer centre (the RN transform origin) to the vanishing
  // point, which sits on the painted sun rather than at centre.
  const frame = sceneFrame(layerW, layerH);
  const vanishDx = frame.vanishX - layerW / 2;
  const vanishDy = frame.horizon - layerH / 2;
  const floorDepth = frame.height - frame.horizon;

  const skyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: -tilt.x.get() * PARALLAX.sky.tilt },
      { translateY: -tilt.y.get() * PARALLAX.sky.tilt },
    ],
  }));

  const cityStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: cityDrift.get() * PARALLAX.city.drift - tilt.x.get() * PARALLAX.city.tilt },
      { translateY: -tilt.y.get() * PARALLAX.city.tilt },
    ],
  }));

  // Fx is the city's lit neon, so it rides the city's parallax exactly.
  const fxStyle = useAnimatedStyle(() => ({
    opacity: flicker.get(),
    transform: [
      { translateX: cityDrift.get() * PARALLAX.city.drift - tilt.x.get() * PARALLAX.city.tilt },
      { translateY: -tilt.y.get() * PARALLAX.city.tilt },
    ],
  }));

  const floorA = useFloorCopyStyle(floorDrift, floorPhase, tilt, 0, vanishDx, vanishDy, floorDepth);
  const floorB = useFloorCopyStyle(floorDrift, floorPhase, tilt, 0.5, vanishDx, vanishDy, floorDepth);

  return (
    <View pointerEvents="none" style={styles.clip}>
      <Animated.View style={[styles.layer, frameStyle, skyStyle]}>
        <SkyLayer width={layerW} height={layerH} />
      </Animated.View>
      <Animated.View style={[styles.layer, frameStyle, cityStyle]}>
        <CityLayer width={layerW} height={layerH} />
      </Animated.View>
      {/* Reflections ride the city's parallax so each streak stays under its building. */}
      <Animated.View style={[styles.layer, frameStyle, cityStyle]}>
        <ReflectionLayer width={layerW} height={layerH} />
      </Animated.View>
      <Animated.View style={[styles.layer, frameStyle, floorA]}>
        <FloorLayer width={layerW} height={layerH} />
      </Animated.View>
      <Animated.View style={[styles.layer, frameStyle, floorB]}>
        <FloorLayer width={layerW} height={layerH} />
      </Animated.View>
      <Animated.View style={[styles.layer, frameStyle, fxStyle]}>
        <FxLayer width={layerW} height={layerH} />
      </Animated.View>

      <LinearGradient colors={SCRIM_COLORS} locations={SCRIM_LOCATIONS} style={StyleSheet.absoluteFill} />
    </View>
  );
});

/**
 * Sine sway in [-1, 1]. Eases out from rest to +1 over a quarter period first,
 * so the layer never jumps when motion starts, then reverses forever.
 */
function sway(value: SharedValue<number>, periodMs: number) {
  value.set(
    withSequence(
      withTiming(1, { duration: periodMs / 4, easing: Easing.out(Easing.sin) }),
      withRepeat(
        withTiming(-1, { duration: periodMs / 2, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    ),
  );
}

/**
 * One floor copy. `offset` is its phase lead (0 or 0.5). Scale runs
 * GRID_RATIO^q for q in [0, 1) about the vanishing point; opacity is sin²(πq).
 */
function useFloorCopyStyle(
  drift: SharedValue<number>,
  phase: SharedValue<number>,
  tilt: DeviceTilt,
  offset: number,
  vanishDx: number,
  vanishDy: number,
  floorDepth: number,
) {
  return useAnimatedStyle(() => {
    const q = (phase.get() + offset) % 1;
    const fade = Math.sin(Math.PI * q);
    return {
      opacity: fade * fade,
      transform: [
        { translateX: -tilt.x.get() * PARALLAX.floor.tilt + vanishDx },
        { translateY: -tilt.y.get() * PARALLAX.floor.tilt + vanishDy },
        // Sway as a shear about the vanishing point: full drift at the near
        // edge, none at the horizon.
        { skewX: `${Math.atan((drift.get() * PARALLAX.floor.drift) / floorDepth)}rad` },
        { scale: Math.exp(q * LOG_GRID_RATIO) },
        { translateX: -vanishDx },
        { translateY: -vanishDy },
      ],
    };
  });
}

const styles = StyleSheet.create({
  clip: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  layer: {
    position: 'absolute',
  },
});
