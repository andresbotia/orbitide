import { memo, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { AmbientChargeSpec, Point } from '@/game/rendering/homeGeometry';
import { orbColors, orbGlow } from '@/theme/colors';

interface PortalMotesProps {
  specs: AmbientChargeSpec[];
  center: Point;
  /** Radius at which motes rest — NOT a drawn rail/orbit track, just a placement radius. */
  restRadius: number;
  active: boolean;
  reducedMotion: boolean;
}

/**
 * Small floating pixel fragments near the portal housing — colours drawn from
 * the level you're about to play, matching the icon's loose floating pixel
 * squares. Deliberately NOT an orbit: each mote rests at a fixed angle around
 * the portal and gently bobs/drifts in a small radius around that point,
 * replacing the old `AmbientCharge`'s circular-rail motion (UI-R2 — the
 * redesign brief calls out "orbit rails used only as visual decoration" as
 * Orbitide identity to remove from Home).
 */
export const PortalMotes = memo(function PortalMotes({ specs, center, restRadius, active, reducedMotion }: PortalMotesProps) {
  return (
    <>
      {specs.map((spec, i) => (
        <Mote key={i} spec={spec} center={center} restRadius={restRadius} active={active} reducedMotion={reducedMotion} />
      ))}
    </>
  );
});

function Mote({ spec, center, restRadius, active, reducedMotion }: {
  spec: AmbientChargeSpec;
  center: Point;
  restRadius: number;
  active: boolean;
  reducedMotion: boolean;
}) {
  const t = useSharedValue(spec.phase);
  const size = 10 + spec.trail * 20;
  // Fixed rest position around the portal (evenly-ish spread by phase),
  // never a drawn track — the mote simply lives near this point.
  const angle = spec.phase * Math.PI * 2;
  const anchorX = center.x + Math.cos(angle) * restRadius;
  const anchorY = center.y + Math.sin(angle) * restRadius * 0.6;
  const bobAmp = reducedMotion ? 3 : 9;
  const period = spec.periodMs * (reducedMotion ? 1.6 : 1);

  useEffect(() => {
    cancelAnimation(t);
    if (!active) return;
    const start = t.get();
    t.set(withRepeat(withTiming(start + 1, { duration: period, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(t);
  }, [active, period, t]);

  const style = useAnimatedStyle(() => {
    const local = t.value * Math.PI * 2;
    return {
      transform: [
        { translateX: anchorX - size / 2 + Math.cos(local) * bobAmp * 0.6 },
        { translateY: anchorY - size / 2 + Math.sin(local * 1.3) * bobAmp },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.mote,
        { width: size, height: size, borderRadius: size * 0.32, backgroundColor: orbColors[spec.color], borderColor: orbGlow[spec.color] },
        style,
      ]}
    >
      <Animated.View style={[styles.gloss, { width: size * 0.5, height: size * 0.35, top: size * 0.14, left: size * 0.16 }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  mote: { position: 'absolute', left: 0, top: 0, borderWidth: 1.5, overflow: 'hidden' },
  gloss: { position: 'absolute', backgroundColor: '#FFFFFF', opacity: 0.45, borderRadius: 6 },
});
