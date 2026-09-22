import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';

import {
  ENABLE_GAMEPLAY_ITEM_PLACEHOLDERS,
  GAMEPLAY_ITEMS,
  type GameplayItemId,
} from '@/game/presentation/itemPlaceholders';
import { GAMEPLAY } from '@/theme/gameplayLayout';
import { GP, GP_RADIUS, GP_TYPE, gpAlpha } from '@/theme/gameplayUi';
import { GP_MOTION } from '@/theme/gameplayMotion';
import { BombGlyph, SlotGlyph, UndoGlyph } from './glyphs';
import { flash, shake, usePressDepth } from './motionKit';

const SIZE = GAMEPLAY.itemButton;

export interface ItemRackProps {
  inventory?: Record<GameplayItemId, number>;
  canUndo?: boolean;
  extraSlotActive?: boolean;
  bombArmed?: boolean;
  disabled?: boolean;
  onPressItem?: (itemId: GameplayItemId) => void;
}

/**
 * Production booster deck for M6: Undo, Extra Slot, Bomb.
 * Displays real inventory quantities, active/armed states, disabled states,
 * and zero-inventory restock affordances.
 */
export const ItemRack = memo(function ItemRack({
  inventory = { undo: 2, extraSlot: 2, bomb: 2 },
  canUndo = false,
  extraSlotActive = false,
  bombArmed = false,
  disabled = false,
  onPressItem,
}: ItemRackProps) {
  if (!ENABLE_GAMEPLAY_ITEM_PLACEHOLDERS) return null;

  return (
    <View style={styles.row} accessibilityRole="toolbar" accessibilityLabel="Items">
      {GAMEPLAY_ITEMS.map((item) => {
        const count = inventory[item.id] ?? 0;
        let isItemDisabled = disabled;
        let isSelected = false;

        if (item.id === 'undo') {
          // If count > 0, disabled when no undo action is available
          if (count > 0 && !canUndo) {
            isItemDisabled = true;
          }
        } else if (item.id === 'extraSlot') {
          // If already activated this run, disabled
          if (extraSlotActive) {
            isItemDisabled = true;
            isSelected = true;
          }
        } else if (item.id === 'bomb') {
          if (bombArmed) {
            isSelected = true;
            isItemDisabled = false;
          }
        }

        return (
          <ItemButton
            key={item.id}
            id={item.id}
            label={item.accessibilityLabel}
            count={count}
            disabled={isItemDisabled}
            selected={isSelected}
            onPress={() => onPressItem?.(item.id)}
          />
        );
      })}
    </View>
  );
});

/**
 * One booster bay.
 * - Touch-down depth + rim glow.
 * - Empty items (count 0) show a [+] badge that opens restock on tap.
 * - Armed items show a steady cyan/gold highlight ring.
 */
const ItemButton = memo(function ItemButton({
  id,
  label,
  count,
  disabled,
  selected,
  onPress,
}: {
  id: GameplayItemId;
  label: string;
  count: number;
  disabled: boolean;
  selected: boolean;
  onPress?: () => void;
}) {
  const empty = count <= 0;
  const reducedMotion = useReducedMotion();
  const { depth, pressIn, pressOut } = usePressDepth();
  const ring = useSharedValue(0);
  const shakeX = useSharedValue(0);

  const handlePress = () => {
    if (disabled && !empty) {
      if (!reducedMotion) shake(shakeX, GP_MOTION.shakeSoft);
      return;
    }
    if (!empty) {
      flash(ring, 40, 260);
    }
    onPress?.();
  };

  const bayStyle = useAnimatedStyle(() => {
    let borderColor = empty
      ? GP.hairline
      : disabled
        ? GP.hairline
        : interpolateColor(depth.value, [0, 1], [GP.hairlineStrong, GP.cyan]);

    if (selected) {
      borderColor = GP.gold;
    }

    return {
      borderColor,
      transform: [
        { translateX: shakeX.value },
        { scale: 1 - depth.value * (reducedMotion ? 0.04 : 0.08) },
      ],
    };
  });

  const ringStyle = useAnimatedStyle(() => {
    const activeRing = selected ? 1 : ring.value;
    return {
      opacity: activeRing * 0.9,
      borderColor: selected ? GP.gold : GP.cyan,
      transform: [{ scale: reducedMotion ? 1 : 1 + (1 - ring.value) * (selected ? 0.04 : 0.18) }],
    };
  });

  const ink = empty
    ? GP.textFaint
    : disabled
      ? GP.textMuted
      : selected
        ? GP.gold
        : GP.cyan;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${count}`}
      accessibilityState={{ disabled: disabled && !empty, selected }}
      hitSlop={4}
      onPressIn={pressIn}
      onPressOut={pressOut}
      onPress={handlePress}
    >
      <Animated.View style={[styles.btn, empty && styles.btnEmpty, selected && styles.btnSelected, bayStyle]}>
        {id === 'undo' ? <UndoGlyph color={ink} /> : null}
        {id === 'extraSlot' ? <SlotGlyph color={ink} /> : null}
        {id === 'bomb' ? <BombGlyph color={ink} spark={empty || disabled ? GP.textFaint : GP.gold} /> : null}

        <Animated.View pointerEvents="none" style={[styles.ring, ringStyle]} />

        {/* Badge: count or [+] restock affordance */}
        <View style={[styles.badge, empty && styles.badgeEmpty]} pointerEvents="none">
          <Text style={[styles.badgeNum, empty && styles.badgeNumEmpty]}>
            {empty ? '+' : count}
          </Text>
        </View>
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
  btnSelected: {
    backgroundColor: gpAlpha(GP.wellDeep, 0.9),
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
  badgeEmpty: {
    borderColor: GP.hairlineStrong,
    backgroundColor: GP.panel,
  },
  badgeNum: {
    ...GP_TYPE.numeral,
    color: GP.text,
    fontSize: 11,
    lineHeight: 15,
  },
  badgeNumEmpty: {
    color: GP.gold,
    fontSize: 13,
    lineHeight: 14,
    fontWeight: '700',
  },
});
