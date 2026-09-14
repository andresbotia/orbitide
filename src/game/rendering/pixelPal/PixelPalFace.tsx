import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ColorAssistMark } from '@/components/ColorAssistMark';
import type { OrbColor } from '@/game/engine/types';
import { orbColors, orbGlow } from '@/theme/colors';

/** North-star character pass — a Pixel Pal's momentary expression. Kept to
 * three cheap states, never a full animation framework:
 *  - calm: default round eyes (idle, resting/held)
 *  - focused: narrower eyes, faster blink (ready-to-launch / in flight)
 *  - happy: round eyes + a small smile (celebration contexts) */
export type PixelPalMood = 'calm' | 'focused' | 'happy';

/**
 * M5.3 — the single Pixel Pal body used everywhere a Core V2 charge appears:
 * traveling the perimeter, loaded in a tunnel, parked in Holding, or shown as
 * an upcoming queue preview (spec §3: "the SAME character species/body is
 * used for all gameplay colors"). A rounded-square cabinet-like shell with
 * two small side pods, plus a glossy dark visor carrying two eyes and the
 * capacity readout.
 *
 * Split into two pure, unanimated pieces on purpose: `PixelPalShell` (the
 * colored body — everything that should visibly reorient with travel) and
 * `PixelPalVisor` (the eyes + number — spec §4 requires the count stay
 * readable "in all states", including mid-corner, so the traveling wrapper
 * keeps this layer upright while the shell banks/orients underneath it).
 * `PixelPalFace` composes both at zero rotation for static contexts (a
 * Tunnel port, a Holding slot, a queue preview chip).
 */

/** Below this size (px), skip feet/blush — queue-preview chips stay clean, not noisy. */
const DETAIL_FLOOR = 28;

export function PixelPalShell({ color, size, colorAssist }: { color: OrbColor; size: number; colorAssist?: boolean }) {
  const shell = orbColors[color];
  const glow = orbGlow[color];
  const podSize = size * 0.26;
  const detailed = size >= DETAIL_FLOOR;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Feet — small grounded nubs, standing presence. Behind the shell. */}
      {detailed ? (
        <>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute', left: size * 0.24, bottom: -size * 0.05,
              width: size * 0.2, height: size * 0.16, borderRadius: size * 0.08,
              backgroundColor: glow,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute', right: size * 0.24, bottom: -size * 0.05,
              width: size * 0.2, height: size * 0.16, borderRadius: size * 0.08,
              backgroundColor: glow,
            }}
          />
        </>
      ) : null}

      {/* Side pods — small limb-like forms, clearly proud of the shell edge so the
          silhouette reads as a creature (not a plain rounded square) even tiny. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', left: -podSize * 0.34, top: size * 0.32,
          width: podSize, height: podSize, borderRadius: podSize / 2,
          backgroundColor: shell, borderWidth: Math.max(1, size * 0.032), borderColor: glow,
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', top: podSize * 0.16, left: podSize * 0.2,
            width: podSize * 0.32, height: podSize * 0.22, borderRadius: podSize * 0.16,
            backgroundColor: '#FFFFFF', opacity: 0.4,
          }}
        />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', right: -podSize * 0.34, top: size * 0.32,
          width: podSize, height: podSize, borderRadius: podSize / 2,
          backgroundColor: shell, borderWidth: Math.max(1, size * 0.032), borderColor: glow,
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', top: podSize * 0.16, left: podSize * 0.2,
            width: podSize * 0.32, height: podSize * 0.22, borderRadius: podSize * 0.16,
            backgroundColor: '#FFFFFF', opacity: 0.4,
          }}
        />
      </View>

      {/* Shell — rounded-square cabinet body. */}
      <View
        style={{
          width: size, height: size, borderRadius: size * 0.32,
          backgroundColor: shell, borderWidth: Math.max(1.5, size * 0.05), borderColor: glow,
          overflow: 'hidden',
        }}
      >
        {/* Top-left specular sheen — the big soft highlight reads as glossy plastic. */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', top: size * 0.08, left: size * 0.1,
            width: size * 0.46, height: size * 0.3, borderRadius: size * 0.22,
            backgroundColor: '#FFFFFF', opacity: 0.34,
          }}
        />
        {/* A small bright bead near the sheen's edge — the "toy" catch-light. */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', top: size * 0.12, left: size * 0.16,
            width: size * 0.09, height: size * 0.09, borderRadius: size * 0.05,
            backgroundColor: '#FFFFFF', opacity: 0.75,
          }}
        />
        {/* Lower shadow. */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: size * 0.3,
            backgroundColor: '#000000', opacity: 0.16,
          }}
        />
        {colorAssist ? (
          <View style={{ position: 'absolute', bottom: size * 0.04, alignSelf: 'center' }} pointerEvents="none">
            <ColorAssistMark color={color} size={size * 0.2} etched />
          </View>
        ) : null}
      </View>

      {/* Blush — sits just outside the visor's lower corners (the visor itself is a
          separate layer rendered on top of this shell), a small "cute" accent that
          reads as cheeks without touching the number's legibility. */}
      {detailed ? (
        <>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute', left: size * 0.06, top: size * 0.58,
              width: size * 0.15, height: size * 0.11, borderRadius: size * 0.07,
              backgroundColor: '#FF9EC4', opacity: 0.55,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute', right: size * 0.06, top: size * 0.58,
              width: size * 0.15, height: size * 0.11, borderRadius: size * 0.07,
              backgroundColor: '#FF9EC4', opacity: 0.55,
            }}
          />
        </>
      ) : null}
    </View>
  );
}

/**
 * The glossy dark visor + eyes + capacity readout, sized to the same `size`
 * bounding box as `PixelPalShell` and centered so it overlays exactly on top
 * of it. Transparent everywhere else so the shell shows through.
 *
 * Eyes carry a self-contained, organic blink loop: each instance schedules
 * its own next blink at a random 2.2-4.8s interval (not a synchronized
 * `withRepeat`), so a row of Pals never blinks in unison — "occasionally
 * notice the Pal doing something charming," not a metronome. Skipped below
 * `DETAIL_FLOOR` (tiny preview chips) and resolves to open eyes under
 * reduced motion.
 */
export function PixelPalVisor({ size, mood = 'calm', children }: { size: number; mood?: PixelPalMood; children?: ReactNode }) {
  const reducedMotion = useReducedMotion();
  const detailed = size >= DETAIL_FLOOR;
  const blink = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion || !detailed) { cancelAnimation(blink); blink.set(0); return; }
    let alive = true;
    const focusedNow = () => mood === 'focused';
    const scheduleBlink = () => {
      if (!alive) return;
      const gap = (focusedNow() ? 1400 : 2200) + Math.random() * (focusedNow() ? 1600 : 2600);
      blink.set(withDelay(gap, withSequence(
        withTiming(1, { duration: 65, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 90, easing: Easing.in(Easing.quad) }, (finished) => {
          if (finished) runOnJS(scheduleBlink)();
        }),
      )));
    };
    scheduleBlink();
    return () => { alive = false; cancelAnimation(blink); };
    // `mood` intentionally excluded — a mood change should not restart the
    // in-flight blink timer, only the NEXT scheduled gap reads it fresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion, detailed, blink]);

  const eyeStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: 1 - blink.value * 0.86 }] }));
  const focused = mood === 'focused';
  const eyeSize = focused ? size * 0.078 * 0.82 : size * 0.078;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
      <View
        style={{
          width: size * 0.74, height: size * 0.6, borderRadius: size * 0.2,
          backgroundColor: 'rgba(6,8,20,0.76)',
          alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        }}
      >
        <View
          style={{
            position: 'absolute', top: size * 0.02, left: size * 0.06,
            width: size * 0.3, height: size * 0.1, borderRadius: size * 0.06,
            backgroundColor: '#FFFFFF', opacity: 0.2,
          }}
        />
        {/* Simple expressive eyes — slightly larger and rounder for more charm.
            `focused` narrows them for a determined/ready look; both blink together. */}
        <Animated.View style={[{ flexDirection: 'row', gap: size * (focused ? 0.13 : 0.15), marginBottom: size * 0.02 }, eyeStyle]}>
          <View style={{ width: eyeSize, height: size * 0.078, borderRadius: size * 0.039, backgroundColor: '#EEF8FF' }} />
          <View style={{ width: eyeSize, height: size * 0.078, borderRadius: size * 0.039, backgroundColor: '#EEF8FF' }} />
        </Animated.View>
        {mood === 'happy' && detailed ? (
          <View
            pointerEvents="none"
            style={{
              width: size * 0.16, height: size * 0.08, marginTop: size * 0.02,
              borderBottomLeftRadius: size * 0.08, borderBottomRightRadius: size * 0.08,
              borderWidth: Math.max(1, size * 0.018), borderTopWidth: 0, borderColor: '#EEF8FF',
            }}
          />
        ) : null}
        {children}
      </View>
    </View>
  );
}

/** Static composition (zero rotation) for a Tunnel port / Holding slot / preview chip. */
export function PixelPalFace({ color, size, colorAssist, mood, children }: {
  color: OrbColor; size: number; colorAssist?: boolean; mood?: PixelPalMood; children?: ReactNode;
}) {
  return (
    <View style={{ width: size, height: size }}>
      <PixelPalShell color={color} size={size} colorAssist={colorAssist} />
      <View style={StyleSheet.absoluteFill}>
        <PixelPalVisor size={size} mood={mood}>{children}</PixelPalVisor>
      </View>
    </View>
  );
}
