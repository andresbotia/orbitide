import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor, useAnimatedStyle, useReducedMotion, useSharedValue,
} from 'react-native-reanimated';

import {
  ENABLE_GAMEPLAY_ITEM_PLACEHOLDERS,
  GAMEPLAY_ITEM_PREVIEW,
  GAMEPLAY_ITEMS,
  type GameplayItemId,
} from '@/game/presentation/itemPlaceholders';
import { GAMEPLAY } from '@/theme/gameplayLayout';
import { GP, GP_RADIUS, GP_TYPE, gpAlpha } from '@/theme/gameplayUi';
import { GP_MOTION } from '@/theme/gameplayMotion';
import { BombGlyph, SlotGlyph, UndoGlyph } from './glyphs';
import { flash, shake, usePressDepth } from './motionKit';

const SIZE = GAMEPLAY.itemButton;

/**
 * Placeholder booster deck: Undo, Extra Slot, Bomb. Press/activation
 * feedback only — no gameplay, economy, or solver. Glyphs are drawn locally;
 * the illustrated PNGs are not used here.
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

/**
 * One booster bay. Touch-down depth + brighter rim (UI thread); release plays
 * a cyan activation ring. An empty booster has a dashed rim and a faint glyph
 * and answers a tap with a soft shake instead — no haptic, nothing implied.
 */
const ItemButton = memo(function ItemButton({
  id, label, count,
}: {
  id: GameplayItemId;
  label: string;
  count: number;
}) {
  const empty = count <= 0;
  const reducedMotion = useReducedMotion();
  const { depth, pressIn, pressOut } = usePressDepth();
  const ring = useSharedValue(0);
  const shakeX = useSharedValue(0);

  const onPressOut = () => {
    pressOut();
    if (empty) {
      if (!reducedMotion) shake(shakeX, GP_MOTION.shakeSoft);
    } else {
      flash(ring, 40, 280);
    }
  };

  const bayStyle = useAnimatedStyle(() => ({
    borderColor: empty ? GP.hairline : interpolateColor(depth.value, [0, 1], [GP.hairlineStrong, GP.cyan]),
    transform: [
      { translateX: shakeX.value },
      { scale: 1 - depth.value * (reducedMotion ? 0.04 : 0.08) },
    ],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value * 0.9,
    transform: [{ scale: reducedMotion ? 1 : 1 + (1 - ring.value) * 0.18 }],
  }));

  const ink = empty ? GP.textFaint : GP.cyan;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${count}`}
      accessibilityState={{ disabled: empty }}
      hitSlop={4}
      onPressIn={pressIn}
      onPressOut={onPressOut}
    >
      <Animated.View style={[styles.btn, empty && styles.btnEmpty, bayStyle]}>
        {id === 'undo' ? <UndoGlyph color={ink} /> : null}
        {id === 'extraSlot' ? <SlotGlyph color={ink} /> : null}
        {id === 'bomb' ? <BombGlyph color={ink} spark={empty ? GP.textFaint : GP.gold} /> : null}
        <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />
        {count > 0 ? (
          <View style={styles.badge} pointerEvents="none">
            <Text style={styles.badgeNum}>{count}</Text>
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    alignSelf: 'center',
    paddingTop: 6,
  },
  // Same well material as Holding and the tunnel bays.
  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: GP_RADIUS.bay,
    backgroundColor: GP.well,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnEmpty: {
    borderStyle: 'dashed',
    backgroundColor: gpAlpha(GP.well, 0.4),
  },
  ring: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: GP_RADIUS.bay + 3,
    borderWidth: 2,
    borderColor: GP.cyan,
  },
  // This number is how the player judges whether a booster is worth tapping.
  badge: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 4,
    borderRadius: 11,
    backgroundColor: GP.canvas,
    borderWidth: 2,
    borderColor: GP.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeNum: {
    ...GP_TYPE.numeral,
    color: GP.text,
    lineHeight: 15,
  },
});
