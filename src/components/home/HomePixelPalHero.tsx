import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { PixelPalShell } from '@/game/rendering/pixelPal/PixelPalFace';
import { NEON, neonAlpha } from '@/theme/neon';

interface HomePixelPalHeroProps {
  size: number;
  active: boolean;
  reducedMotion: boolean;
}

type Charm = 'tilt' | 'look' | 'happy' | 'hop';

const HOVER_MS = 3400;
const HOVER_AMP = 3;
const BLINK_MS = 120;
const PULSE_MS = 2300;
/** Podium footprint. Fixed by design: the mascot scales, the stage does not. */
const PODIUM_W = 200;
const PODIUM_H = 56;
/** Share of the podium's height the mascot sits down into. */
const PODIUM_OVERLAP = 0.55;

/**
 * White Pixel Pal hero idle: hover (±3pt / 3.4s), squash from hover, blink
 * (120ms / 3.5–6.5s), core pulse (0.6→1.0 / 2.3s), occasional charm beat.
 */
export const HomePixelPalHero = memo(function HomePixelPalHero({
  size,
  active,
  reducedMotion,
}: HomePixelPalHeroProps) {
  const hover = useSharedValue(0.5);
  const tilt = useSharedValue(0);
  const look = useSharedValue(0);
  const hop = useSharedValue(0);
  const happy = useSharedValue(0);
  const blink = useSharedValue(0);
  const pulse = useSharedValue(0.6);

  useEffect(() => {
    cancelAnimation(hover);
    cancelAnimation(pulse);
    hover.set(0.5);
    const pulseFrom = reducedMotion ? 0.8 : 0.6;
    pulse.set(pulseFrom);
    if (!active) return;
    if (!reducedMotion) {
      hover.set(0);
      hover.set(
        withRepeat(withTiming(1, { duration: HOVER_MS, easing: Easing.inOut(Easing.sin) }), -1, true),
      );
    }
    pulse.set(
      withRepeat(withTiming(1, { duration: PULSE_MS, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
    return () => {
      cancelAnimation(hover);
      cancelAnimation(pulse);
    };
  }, [active, reducedMotion, hover, pulse]);

  useEffect(() => {
    cancelAnimation(blink);
    blink.set(0);
    if (!active) return;
    let alive = true;
    const schedule = () => {
      if (!alive) return;
      const gap = 3500 + Math.random() * 3000;
      blink.set(
        withDelay(
          gap,
          withSequence(
            withTiming(1, { duration: BLINK_MS / 2, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: BLINK_MS / 2, easing: Easing.out(Easing.quad) }, (finished) => {
              if (finished) runOnJS(schedule)();
            }),
          ),
        ),
      );
    };
    schedule();
    return () => {
      alive = false;
      cancelAnimation(blink);
    };
  }, [active, blink]);

  useEffect(() => {
    cancelAnimation(tilt);
    cancelAnimation(look);
    cancelAnimation(hop);
    cancelAnimation(happy);
    tilt.set(0);
    look.set(0);
    hop.set(0);
    happy.set(0);
    if (!active) return;

    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last: Charm | null = null;
    const motionCharms: Charm[] = ['tilt', 'look', 'happy', 'hop'];
    const expressionCharms: Charm[] = ['look', 'happy'];
    const pool = reducedMotion ? expressionCharms : motionCharms;

    const play = (kind: Charm) => {
      if (kind === 'tilt' && !reducedMotion) {
        tilt.set(
          withSequence(
            withTiming(1, { duration: 280, easing: Easing.inOut(Easing.sin) }),
            withTiming(1, { duration: 420 }),
            withTiming(0, { duration: 280, easing: Easing.inOut(Easing.sin) }),
          ),
        );
      } else if (kind === 'look') {
        const dir = Math.random() < 0.5 ? -1 : 1;
        look.set(
          withSequence(
            withTiming(dir, { duration: 220, easing: Easing.inOut(Easing.sin) }),
            withTiming(dir, { duration: 500 }),
            withTiming(0, { duration: 220, easing: Easing.inOut(Easing.sin) }),
          ),
        );
      } else if (kind === 'happy') {
        happy.set(
          withSequence(
            withTiming(1, { duration: 180 }),
            withTiming(1, { duration: 700 }),
            withTiming(0, { duration: 220 }),
          ),
        );
      } else if (kind === 'hop' && !reducedMotion) {
        hop.set(
          withSequence(
            withTiming(-10, { duration: 140, easing: Easing.out(Easing.quad) }),
            withSpring(0, { damping: 12, stiffness: 240 }),
          ),
        );
      }
    };

    const schedule = () => {
      if (!alive) return;
      const gap = 9000 + Math.random() * 5000;
      timer = setTimeout(() => {
        if (!alive) return;
        const options = pool.filter((c) => c !== last);
        const pick = options[Math.floor(Math.random() * options.length)] ?? pool[0]!;
        last = pick;
        play(pick);
        schedule();
      }, gap);
    };
    schedule();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      cancelAnimation(tilt);
      cancelAnimation(look);
      cancelAnimation(hop);
      cancelAnimation(happy);
    };
  }, [active, reducedMotion, tilt, look, hop, happy]);

  const bodyStyle = useAnimatedStyle(() => {
    const hoverAmt = reducedMotion ? 0 : (hover.get() - 0.5) * 2 * HOVER_AMP;
    const stretch = reducedMotion ? 0 : (hover.get() - 0.5) * 0.06;
    return {
      transform: [
        { translateY: -hoverAmt + hop.get() },
        { rotate: `${tilt.get() * 8}deg` },
        { scaleX: 1 - stretch },
        { scaleY: 1 + stretch },
      ],
    };
  });

  const coreStyle = useAnimatedStyle(() => ({ opacity: pulse.get() }));

  return (
    <View style={{ width: Math.max(size, PODIUM_W), height: size + PODIUM_H * (1 - PODIUM_OVERLAP), alignItems: 'center' }}>
      <Animated.View style={[styles.body, { width: size, height: size }, bodyStyle]}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.core,
            {
              width: size * 1.16,
              height: size * 1.16,
              borderRadius: size * 0.58,
              top: -size * 0.08,
              left: -size * 0.08,
            },
            coreStyle,
          ]}
        />
        <PixelPalShell color="white" size={size} />
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <HomePalVisor size={size} blink={blink} look={look} happy={happy} />
        </View>
      </Animated.View>

      {/* Podium: two stacked ellipses behind the sprite. RN has no ellipse
          primitive, so each is a fully rounded View. */}
      <View pointerEvents="none" style={[styles.podium, { marginTop: -PODIUM_H * PODIUM_OVERLAP }]}>
        <View style={styles.podiumBase} />
        <View style={styles.podiumTop} />
      </View>
    </View>
  );
});

function HomePalVisor({
  size,
  blink,
  look,
  happy,
}: {
  size: number;
  blink: SharedValue<number>;
  look: SharedValue<number>;
  happy: SharedValue<number>;
}) {
  const eyeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: look.get() * size * 0.06 },
      { scaleY: 1 - blink.get() * 0.86 },
      { scale: 1 + happy.get() * 0.08 },
    ],
  }));
  const smileStyle = useAnimatedStyle(() => ({ opacity: happy.get() }));
  const eyeSize = size * 0.078;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: size * 0.74,
          height: size * 0.6,
          borderRadius: size * 0.2,
          backgroundColor: neonAlpha(NEON.inkDeep, 0.76),
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            position: 'absolute',
            top: size * 0.02,
            left: size * 0.06,
            width: size * 0.3,
            height: size * 0.1,
            borderRadius: size * 0.06,
            backgroundColor: NEON.cyanPale,
            opacity: 0.2,
          }}
        />
        <Animated.View
          style={[{ flexDirection: 'row', gap: size * 0.15, marginBottom: size * 0.02 }, eyeStyle]}
        >
          <View
            style={{
              width: eyeSize,
              height: size * 0.078,
              borderRadius: size * 0.039,
              backgroundColor: NEON.cyanPale,
            }}
          />
          <View
            style={{
              width: eyeSize,
              height: size * 0.078,
              borderRadius: size * 0.039,
              backgroundColor: NEON.cyanPale,
            }}
          />
        </Animated.View>
        <Animated.View
          style={[
            {
              width: size * 0.16,
              height: size * 0.08,
              marginTop: size * 0.02,
              borderBottomLeftRadius: size * 0.08,
              borderBottomRightRadius: size * 0.08,
              borderWidth: Math.max(1, size * 0.018),
              borderTopWidth: 0,
              borderColor: NEON.cyanPale,
            },
            smileStyle,
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  core: {
    position: 'absolute',
    backgroundColor: neonAlpha(NEON.cyan, 0.45),
  },
  podium: {
    width: PODIUM_W,
    height: PODIUM_H,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
  podiumBase: {
    width: PODIUM_W,
    height: PODIUM_H,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: NEON.cyan,
    backgroundColor: neonAlpha(NEON.ink, 0.85),
  },
  podiumTop: {
    position: 'absolute',
    width: 150,
    height: 40,
    borderRadius: 100,
    borderWidth: 1.5,
    borderColor: NEON.cyanPale,
    backgroundColor: neonAlpha(NEON.cyan, 0.18),
    transform: [{ translateY: -8 }],
  },
});
