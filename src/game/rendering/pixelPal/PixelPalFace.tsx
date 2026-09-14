import { memo, type ReactNode } from 'react';
import { useEffect } from 'react';
import { StyleSheet, Text, type TextStyle, View } from 'react-native';
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
import { orbColors } from '@/theme/colors';

/** North-star character pass — a Pixel Pal's momentary expression. Kept to
 * three cheap states, never a full animation framework:
 *  - calm: default round eyes (idle, resting/held)
 *  - focused: narrower eyes, faster blink (ready-to-launch / in flight)
 *  - happy: round eyes + a small smile (celebration contexts) */
export type PixelPalMood = 'calm' | 'focused' | 'happy';

/**
 * The single Pixel Pal body used everywhere a Core V2 charge appears.
 * Visor is reserved for eyes and expression — remaining-count lives on
 * {@link PixelPalBadge}, never inside the face.
 */

/** Below this size (px), skip feet/blush — queue-preview chips stay clean, not noisy. */
const DETAIL_FLOOR = 28;
/** Full count plate at this size and above; numeral-only below; hidden at {@link BADGE_HIDE}. */
const BADGE_PLATE = 34;
const BADGE_HIDE = 22;
const BADGE_FILL = 'rgba(0, 23, 66, 0.92)';

export function PixelPalShell({ color, size, colorAssist }: { color: OrbColor; size: number; colorAssist?: boolean }) {
  const shell = orbColors[color];
  const podSize = size * 0.26;
  const detailed = size >= DETAIL_FLOOR;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Contact shadow — silhouette only, not a radial bloom. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: size * 0.16,
          right: size * 0.16,
          bottom: -size * 0.06,
          height: size * 0.14,
          borderRadius: size,
          backgroundColor: 'rgba(0,0,0,0.35)',
        }}
      />

      {detailed ? (
        <>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute', left: size * 0.24, bottom: -size * 0.05,
              width: size * 0.2, height: size * 0.16, borderRadius: size * 0.08,
              backgroundColor: shell,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: 'absolute', right: size * 0.24, bottom: -size * 0.05,
              width: size * 0.2, height: size * 0.16, borderRadius: size * 0.08,
              backgroundColor: shell,
            }}
          />
        </>
      ) : null}

      <View
        pointerEvents="none"
        style={{
          position: 'absolute', left: -podSize * 0.34, top: size * 0.32,
          width: podSize, height: podSize, borderRadius: podSize / 2,
          backgroundColor: shell,
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
          backgroundColor: shell,
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
        style={{
          width: size, height: size, borderRadius: size * 0.32,
          backgroundColor: shell,
          overflow: 'hidden',
        }}
      >
        {/* 1pt top-edge light. */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: Math.max(1, size * 0.04),
            backgroundColor: '#FFFFFF', opacity: 0.4,
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', top: size * 0.08, left: size * 0.1,
            width: size * 0.46, height: size * 0.3, borderRadius: size * 0.22,
            backgroundColor: '#FFFFFF', opacity: 0.34,
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', top: size * 0.12, left: size * 0.16,
            width: size * 0.09, height: size * 0.09, borderRadius: size * 0.05,
            backgroundColor: '#FFFFFF', opacity: 0.75,
          }}
        />
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
 * Glossy dark visor + eyes + expression. The visor never carries a numeral.
 */
export function PixelPalVisor({ size, mood = 'calm' }: { size: number; mood?: PixelPalMood }) {
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
  const eyeSize = focused ? size * 0.14 : size * 0.16;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
      <View
        style={{
          width: size * 0.74, height: size * 0.56, borderRadius: size * 0.2,
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
        <Animated.View style={[{ flexDirection: 'row', gap: size * (focused ? 0.12 : 0.14) }, eyeStyle]}>
          <View style={{ width: eyeSize, height: eyeSize, borderRadius: eyeSize / 2, backgroundColor: '#EEF8FF' }} />
          <View style={{ width: eyeSize, height: eyeSize, borderRadius: eyeSize / 2, backgroundColor: '#EEF8FF' }} />
        </Animated.View>
        {mood === 'happy' && detailed ? (
          <View
            pointerEvents="none"
            style={{
              width: size * 0.18, height: size * 0.09, marginTop: size * 0.04,
              borderBottomLeftRadius: size * 0.09, borderBottomRightRadius: size * 0.09,
              borderWidth: Math.max(1, size * 0.02), borderTopWidth: 0, borderColor: '#EEF8FF',
            }}
          />
        ) : null}
      </View>
    </View>
  );
}

export function palBadgeNumeralStyle(palSize: number): TextStyle {
  const plate = palSize > BADGE_PLATE;
  const height = palSize * 0.34;
  const fontSize = Math.max(8, height * 0.62);
  return {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize,
    lineHeight: fontSize + 1,
    textAlign: 'center',
    padding: 0,
    fontVariant: ['tabular-nums'],
    ...(plate ? {} : {
      textShadowColor: '#001742',
      textShadowRadius: 2,
      textShadowOffset: { width: 0, height: 0 },
    }),
  };
}

interface PixelPalBadgeProps {
  palSize: number;
  color: OrbColor;
  text?: string;
  children?: ReactNode;
}

/**
 * Remaining-count badge, mounted at the Pal's lower-right. Never drawn in the visor.
 * ≤34pt: numeral only with a navy outline. ≤22pt: hidden (color carries identity).
 */
export const PixelPalBadge = memo(function PixelPalBadge({ palSize, color, text, children }: PixelPalBadgeProps) {
  if (palSize <= BADGE_HIDE) return null;
  const plate = palSize > BADGE_PLATE;
  const height = palSize * 0.34;
  const fontSize = Math.max(8, height * 0.62);
  const digits = text?.length ?? 2;
  const width = Math.max(height, fontSize * Math.max(1, digits) * 0.7 + (plate ? 8 : 0));
  const overlap = width * 0.2;
  const numeralStyle = palBadgeNumeralStyle(palSize);
  const numeral = children ?? (text !== undefined ? <Text style={numeralStyle}>{text}</Text> : null);

  if (!plate) {
    return (
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: -overlap,
          bottom: -height * 0.12,
          minWidth: width,
          alignItems: 'center',
        }}
      >
        {numeral}
      </View>
    );
  }

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        right: -overlap,
        bottom: -height * 0.12,
        minWidth: height,
        height,
        paddingHorizontal: 4,
        borderRadius: Math.min(6, height * 0.28),
        backgroundColor: BADGE_FILL,
        borderWidth: 1.5,
        borderColor: orbColors[color],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {numeral}
    </View>
  );
});

/** Static composition (zero rotation) for a Tunnel port / Holding slot / preview chip. */
export function PixelPalFace({ color, size, colorAssist, mood, capacity, selected }: {
  color: OrbColor; size: number; colorAssist?: boolean; mood?: PixelPalMood;
  /** Remaining count. Rendered on the badge, never in the visor. */
  capacity?: number;
  /** Tight colored outline + 1.06 scale — selection, not a glow. */
  selected?: boolean;
}) {
  return (
    <View style={{ width: size, height: size, transform: selected ? [{ scale: 1.06 }] : undefined }}>
      {selected ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -2, left: -2, right: -2, bottom: -2,
            borderRadius: size * 0.32 + 2,
            borderWidth: 1.5,
            borderColor: orbColors[color],
          }}
        />
      ) : null}
      <PixelPalShell color={color} size={size} colorAssist={colorAssist} />
      <View style={StyleSheet.absoluteFill}>
        <PixelPalVisor size={size} mood={mood} />
      </View>
      {capacity !== undefined ? (
        <PixelPalBadge palSize={size} color={color} text={String(capacity)} />
      ) : null}
    </View>
  );
}
