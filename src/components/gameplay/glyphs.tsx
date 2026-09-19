import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { GP } from '@/theme/gameplayUi';

/**
 * Gameplay control glyphs, drawn from plain views at one stroke weight so the
 * HUD and item deck share an icon family. Decorative: parents own the
 * accessibility label.
 */
interface GlyphProps { color?: string; size?: number }

export const HomeGlyph = memo(function HomeGlyph({ color = GP.cyanPale, size = 16 }: GlyphProps) {
  const half = size / 2;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'flex-end' }} accessibilityElementsHidden>
      <View style={{
        width: 0, height: 0,
        borderLeftWidth: half, borderRightWidth: half, borderBottomWidth: size * 0.44,
        borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color,
        marginBottom: -1,
      }} />
      <View style={{ width: size * 0.7, height: size * 0.48, backgroundColor: color, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, alignItems: 'center', justifyContent: 'flex-end' }}>
        <View style={{ width: size * 0.22, height: size * 0.26, backgroundColor: GP.canvas, borderTopLeftRadius: 1, borderTopRightRadius: 1 }} />
      </View>
    </View>
  );
});

/** Circular arrow. `mirror` flips it into an undo arrow. */
function ArcArrow({ color, size, mirror }: { color: string; size: number; mirror: boolean }) {
  const ring = size * 0.78;
  const stroke = Math.max(2, size * 0.13);
  const head = size * 0.2;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ scaleX: mirror ? -1 : 1 }] }} accessibilityElementsHidden>
      <View style={{
        width: ring, height: ring, borderRadius: ring / 2, borderWidth: stroke,
        borderColor: color, borderTopColor: 'transparent', transform: [{ rotate: '-35deg' }],
      }} />
      <View style={[styles.head, {
        top: size * 0.04, right: size * 0.14,
        borderLeftWidth: head, borderRightWidth: head, borderBottomWidth: head * 1.3,
        borderBottomColor: color, transform: [{ rotate: '62deg' }],
      }]} />
    </View>
  );
}

export const RestartGlyph = memo(function RestartGlyph({ color = GP.cyanPale, size = 18 }: GlyphProps) {
  return <ArcArrow color={color} size={size} mirror={false} />;
});

export const UndoGlyph = memo(function UndoGlyph({ color = GP.cyan, size = 26 }: GlyphProps) {
  return <ArcArrow color={color} size={size} mirror />;
});

/** A Holding well with a plus — Extra Slot. */
export const SlotGlyph = memo(function SlotGlyph({ color = GP.cyan, size = 26 }: GlyphProps) {
  const well = size * 0.76;
  const bar = Math.max(2, size * 0.1);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityElementsHidden>
      <View style={{ position: 'absolute', width: well, height: well, borderRadius: size * 0.2, borderWidth: bar, borderColor: color, borderStyle: 'dashed' }} />
      <View style={{ position: 'absolute', width: size * 0.4, height: bar, borderRadius: bar / 2, backgroundColor: color }} />
      <View style={{ position: 'absolute', width: bar, height: size * 0.4, borderRadius: bar / 2, backgroundColor: color }} />
    </View>
  );
});

/** Round bomb, cap, fuse and a gold spark. */
export const BombGlyph = memo(function BombGlyph({ color = GP.cyan, size = 26, spark = GP.gold }: GlyphProps & { spark?: string }) {
  const body = size * 0.64;
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden>
      <View style={{ position: 'absolute', left: size * 0.08, bottom: size * 0.04, width: body, height: body, borderRadius: body / 2, backgroundColor: color }}>
        <View style={{ position: 'absolute', top: body * 0.18, left: body * 0.2, width: body * 0.26, height: body * 0.18, borderRadius: body * 0.1, backgroundColor: GP.canvas, opacity: 0.35 }} />
      </View>
      <View style={{ position: 'absolute', left: size * 0.5, top: size * 0.2, width: size * 0.2, height: size * 0.16, borderRadius: 2, backgroundColor: color, transform: [{ rotate: '40deg' }] }} />
      <View style={{ position: 'absolute', left: size * 0.62, top: size * 0.1, width: size * 0.2, height: Math.max(1.5, size * 0.07), borderRadius: 1, backgroundColor: color, transform: [{ rotate: '-35deg' }] }} />
      <View style={{ position: 'absolute', right: 0, top: 0, width: size * 0.2, height: size * 0.2, borderRadius: size * 0.1, backgroundColor: spark }} />
    </View>
  );
});

const styles = StyleSheet.create({
  head: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
