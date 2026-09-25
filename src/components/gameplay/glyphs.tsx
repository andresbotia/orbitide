import { memo } from 'react';

import { AvBombIcon, AvIcon } from '@/components/v2/AvIcon';
import { AV } from '@/theme/arcadiaV2';

/**
 * Gameplay control glyphs. M7A: the v2 icon family — rounded strokes on a
 * 24-unit grid in a single blue, filled colour only on the Bomb item.
 * Decorative: parents own the accessibility label.
 */
interface GlyphProps { color?: string; size?: number }

export const HomeGlyph = memo(function HomeGlyph({ color = AV.icon, size = 22 }: GlyphProps) {
  return <AvIcon name="home" size={size} color={color} stroke={2.4} />;
});

export const RestartGlyph = memo(function RestartGlyph({ color = AV.icon, size = 22 }: GlyphProps) {
  return <AvIcon name="restart" size={size} color={color} stroke={2.4} />;
});

export const UndoGlyph = memo(function UndoGlyph({ color = AV.icon, size = 26 }: GlyphProps) {
  return <AvIcon name="undo" size={size} color={color} stroke={2.6} />;
});

/** A Holding well with a plus — Extra Slot. */
export const SlotGlyph = memo(function SlotGlyph({ color = AV.icon, size = 28 }: GlyphProps) {
  return <AvIcon name="extraSlot" size={size} color={color} stroke={2.4} />;
});

/** Coral bomb, blue fuse, gold spark. `muted` for an unavailable state. */
export const BombGlyph = memo(function BombGlyph({ size = 28, muted = false }: { size?: number; muted?: boolean }) {
  return <AvBombIcon size={size} muted={muted} />;
});
