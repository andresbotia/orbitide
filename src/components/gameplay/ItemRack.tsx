import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  ENABLE_GAMEPLAY_ITEM_PLACEHOLDERS,
  GAMEPLAY_ITEM_PREVIEW,
  GAMEPLAY_ITEMS,
  type GameplayItemId,
} from '@/game/presentation/itemPlaceholders';
import { GAMEPLAY } from '@/theme/gameplayLayout';
import { homeAlpha, homeV2 } from '@/theme/homeV2';

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
      hitSlop={2}
      style={({ pressed }) => [
        styles.btn,
        empty && styles.btnEmpty,
        pressed && styles.btnPressed,
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
  const ink = empty ? homeAlpha(homeV2.cyan, 0.4) : homeV2.cyan;
  const gold = empty ? homeAlpha(homeV2.yellow, 0.4) : homeV2.yellow;
  if (id === 'extraSlot') {
    return (
      <View style={styles.glyph}>
        <View style={[styles.slotWell, { borderColor: ink }]} />
        <View style={[styles.plusH, { backgroundColor: ink }]} />
        <View style={[styles.plusV, { backgroundColor: ink }]} />
        <View style={[styles.goldNode, { backgroundColor: gold }]} />
      </View>
    );
  }
  return (
    <View style={styles.glyph}>
      <View style={[styles.bomb, { borderColor: ink, backgroundColor: homeAlpha('#000C28', 0.9) }]} />
      <View style={[styles.fuse, { backgroundColor: gold }]} />
      <View style={[styles.spark, { backgroundColor: gold }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    alignSelf: 'center',
    paddingTop: 2,
  },
  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: 11,
    backgroundColor: homeAlpha('#000C28', 0.92),
    borderWidth: 1.5,
    borderColor: homeAlpha(homeV2.cyan, 0.5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnEmpty: {
    borderColor: homeAlpha(homeV2.cyan, 0.18),
    opacity: 0.55,
  },
  btnPressed: {
    transform: [{ scale: 0.94 }],
    borderColor: homeV2.cyan,
    backgroundColor: homeAlpha(homeV2.cyan, 0.12),
  },
  badge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: homeV2.deepNavy,
    borderWidth: 1,
    borderColor: homeV2.yellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeNum: {
    color: homeV2.white,
    fontSize: 10,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    lineHeight: 12,
  },
  glyph: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotWell: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  plusH: { position: 'absolute', width: 10, height: 2, borderRadius: 1 },
  plusV: { position: 'absolute', width: 2, height: 10, borderRadius: 1 },
  goldNode: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  bomb: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    marginTop: 3,
  },
  fuse: {
    position: 'absolute',
    top: 2,
    width: 2,
    height: 5,
    borderRadius: 1,
  },
  spark: {
    position: 'absolute',
    top: 0,
    right: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});
