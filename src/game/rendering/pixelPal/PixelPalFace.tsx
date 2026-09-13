import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ColorAssistMark } from '@/components/ColorAssistMark';
import type { OrbColor } from '@/game/engine/types';
import { orbColors, orbGlow } from '@/theme/colors';

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

export function PixelPalShell({ color, size, colorAssist }: { color: OrbColor; size: number; colorAssist?: boolean }) {
  const shell = orbColors[color];
  const glow = orbGlow[color];
  const podSize = size * 0.24;
  const podOffset = size * 0.5 - podSize * 0.32;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Side pods — small limb-like forms, behind the shell. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', left: -podOffset * 0.32, top: size * 0.34,
          width: podSize, height: podSize, borderRadius: podSize / 2,
          backgroundColor: shell, borderWidth: Math.max(1, size * 0.03), borderColor: glow, opacity: 0.9,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute', right: -podOffset * 0.32, top: size * 0.34,
          width: podSize, height: podSize, borderRadius: podSize / 2,
          backgroundColor: shell, borderWidth: Math.max(1, size * 0.03), borderColor: glow, opacity: 0.9,
        }}
      />

      {/* Shell — rounded-square cabinet body. */}
      <View
        style={{
          width: size, height: size, borderRadius: size * 0.32,
          backgroundColor: shell, borderWidth: Math.max(1.5, size * 0.045), borderColor: glow,
          overflow: 'hidden',
        }}
      >
        {/* Top-left highlight — premium 2.5D depth. */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', top: size * 0.1, left: size * 0.12,
            width: size * 0.42, height: size * 0.28, borderRadius: size * 0.2,
            backgroundColor: '#FFFFFF', opacity: 0.32,
          }}
        />
        {/* Lower shadow. */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: size * 0.3,
            backgroundColor: '#000000', opacity: 0.14,
          }}
        />
        {colorAssist ? (
          <View style={{ position: 'absolute', bottom: size * 0.04, alignSelf: 'center' }} pointerEvents="none">
            <ColorAssistMark color={color} size={size * 0.2} etched />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * The glossy dark visor + eyes + capacity readout, sized to the same `size`
 * bounding box as `PixelPalShell` and centered so it overlays exactly on top
 * of it. Transparent everywhere else so the shell shows through.
 */
export function PixelPalVisor({ size, children }: { size: number; children?: ReactNode }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
      <View
        style={{
          width: size * 0.74, height: size * 0.6, borderRadius: size * 0.2,
          backgroundColor: 'rgba(8,10,22,0.68)',
          alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        }}
      >
        <View
          style={{
            position: 'absolute', top: size * 0.02, left: size * 0.06,
            width: size * 0.3, height: size * 0.1, borderRadius: size * 0.06,
            backgroundColor: '#FFFFFF', opacity: 0.18,
          }}
        />
        {/* Simple expressive eyes. */}
        <View style={{ flexDirection: 'row', gap: size * 0.14, marginBottom: size * 0.02 }}>
          <View style={{ width: size * 0.07, height: size * 0.07, borderRadius: size * 0.035, backgroundColor: '#EAF6FF' }} />
          <View style={{ width: size * 0.07, height: size * 0.07, borderRadius: size * 0.035, backgroundColor: '#EAF6FF' }} />
        </View>
        {children}
      </View>
    </View>
  );
}

/** Static composition (zero rotation) for a Tunnel port / Holding slot / preview chip. */
export function PixelPalFace({ color, size, colorAssist, children }: {
  color: OrbColor; size: number; colorAssist?: boolean; children?: ReactNode;
}) {
  return (
    <View style={{ width: size, height: size }}>
      <PixelPalShell color={color} size={size} colorAssist={colorAssist} />
      <View style={StyleSheet.absoluteFill}>
        <PixelPalVisor size={size}>{children}</PixelPalVisor>
      </View>
    </View>
  );
}
