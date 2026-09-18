import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  ENABLE_GAMEPLAY_ITEM_PLACEHOLDERS,
  GAMEPLAY_ITEM_PREVIEW,
  GAMEPLAY_ITEMS,
  type GameplayItemId,
} from '@/game/presentation/itemPlaceholders';
import { GAMEPLAY } from '@/theme/gameplayLayout';
import { NEON, neonAlpha } from '@/theme/neon';

const SIZE = GAMEPLAY.itemButton;

/**
 * Placeholder item dock. Pressed state only — no gameplay, economy, or solver.
 * Icons are drawn locally; the supplied illustrated PNGs are not used here.
 */
export const ItemRack = memo(function ItemRack() {
  if (!ENABLE_GAMEPLAY_ITEM_PLACEHOLDERS) return null;
  return (
    <View style={styles.row} accessibilityRole="toolbar" accessibilityLabel="Items">
      {GAMEPLAY_ITEMS.map((item) => (
        <ItemButton key={item.id} id={item.id} label={item.accessibilityLabel} count={GAMEPLAY_ITEM_PREVIEW[item.id]} />
      ))}
    </View>
  );
});

const ItemButton = memo(function ItemButton({
  id, label, count,
}: {
  id: GameplayItemId;
  label: string;
  count: number;
}) {
  const empty = count <= 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${count}`}
      accessibilityState={{ disabled: empty }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.btn,
        empty && styles.btnEmpty,
        pressed && !empty && styles.btnPressed,
      ]}
    >
      <ItemGlyph id={id} empty={empty} />
      {count > 0 ? (
        <View style={styles.badge} pointerEvents="none">
          <Text style={styles.badgeNum}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
});

function ItemGlyph({ id, empty }: { id: GameplayItemId; empty: boolean }) {
  const ink = empty ? neonAlpha(NEON.cyan, 0.4) : NEON.cyan;
  
  if (id === 'undo') {
    return (
      <View style={styles.glyph}>
        <View style={[styles.undoArc, { borderColor: ink, borderRightColor: 'transparent', borderBottomColor: 'transparent' }]} />
        <View style={[styles.undoArrow, { borderBottomColor: ink }]} />
      </View>
    );
  }
  
  if (id === 'scanner') {
    return (
      <View style={styles.glyph}>
        <View style={[styles.scannerCircle, { borderColor: ink }]} />
        <View style={[styles.scannerCrossH, { backgroundColor: ink }]} />
        <View style={[styles.scannerCrossV, { backgroundColor: ink }]} />
      </View>
    );
  }

  // extraSlot
  return (
    <View style={styles.glyph}>
      <View style={[styles.slotWell, { borderColor: ink }]} />
      <View style={[styles.plusH, { backgroundColor: ink }]} />
      <View style={[styles.plusV, { backgroundColor: ink }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    alignSelf: 'center',
    paddingTop: 8,
  },
  // Same ink-well + single neon ring language as Holding/Tunnels — one
  // control-deck material, no bevel-pair hardware, no drop shadows.
  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: 14,
    backgroundColor: neonAlpha(NEON.ink, 0.55),
    borderWidth: 1.5,
    borderColor: neonAlpha(NEON.cyan, 0.25),
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnEmpty: {
    borderStyle: 'dashed',
    borderColor: neonAlpha(NEON.cyan, 0.18),
    opacity: 0.6,
    backgroundColor: 'transparent',
  },
  btnPressed: {
    transform: [{ scale: 0.94 }],
    backgroundColor: neonAlpha(NEON.ink, 0.85),
    borderColor: NEON.cyan,
  },
  // Slightly bigger/higher-contrast than a generic badge — this number is
  // how the player judges whether a booster is worth tapping.
  badge: {
    position: 'absolute',
    right: -5,
    bottom: -5,
    minWidth: 23,
    height: 23,
    paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: NEON.inkDeep,
    borderWidth: 2,
    borderColor: NEON.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeNum: {
    color: NEON.cyanPale,
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    lineHeight: 15,
  },
  glyph: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  undoArc: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2.5,
    transform: [{ rotate: '-45deg' }],
  },
  undoArrow: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    transform: [{ rotate: '-45deg' }],
  },
  scannerCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  scannerCrossH: {
    position: 'absolute',
    width: 26,
    height: 2,
  },
  scannerCrossV: {
    position: 'absolute',
    width: 2,
    height: 26,
  },
  slotWell: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
  },
  plusH: { position: 'absolute', width: 10, height: 2, borderRadius: 1 },
  plusV: { position: 'absolute', width: 2, height: 10, borderRadius: 1 },
});
