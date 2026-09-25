import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';

import {
  ENABLE_GAMEPLAY_ITEM_PLACEHOLDERS,
  GAMEPLAY_ITEMS,
  type GameplayItemId,
} from '@/game/presentation/itemPlaceholders';
import { AV, AV_COMPACT_HEIGHT, AV_DEPTH, AV_FONT, AV_SIZE, AV_SIZE_COMPACT } from '@/theme/arcadiaV2';
import { GP } from '@/theme/gameplayUi';
import { GP_MOTION } from '@/theme/gameplayMotion';
import { BombGlyph, SlotGlyph, UndoGlyph } from './glyphs';
import { flash, shake, usePressDepth } from './motionKit';

const LIP = AV_DEPTH.plateLip;

export interface ItemRackProps {
  inventory?: Record<GameplayItemId, number>;
  canUndo?: boolean;
  extraSlotActive?: boolean;
  bombArmed?: boolean;
  disabled?: boolean;
  onPressItem?: (itemId: GameplayItemId) => void;
}

/**
 * Production booster deck (M6 logic, M7A v2 look): Undo, Extra Slot, Bomb.
 * Displays real inventory quantities, active/armed states, disabled states,
 * and zero-inventory restock affordances. 56pt plates, 20pt apart (48pt on
 * small phones); 64pt tap targets.
 */
export const ItemRack = memo(function ItemRack({
  inventory = { undo: 2, extraSlot: 2, bomb: 2 },
  canUndo = false,
  extraSlotActive = false,
  bombArmed = false,
  disabled = false,
  onPressItem,
}: ItemRackProps) {
  const { height } = useWindowDimensions();
  const size = height <= AV_COMPACT_HEIGHT ? AV_SIZE_COMPACT.item : AV_SIZE.item;
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
            size={size}
            onPress={() => onPressItem?.(item.id)}
          />
        );
      })}
    </View>
  );
});

/**
 * One v2 item plate: 56pt light plate, radius 18, 4pt #AFC5F5 lip, soft
 * lift, blue stroke icon, amber count badge (22pt) top-right. Count 0 → the
 * badge becomes a mint "+" (restock) and the plate stays full opacity.
 * - Touch-down: the plate seats into its lip.
 * - Use: one cyan ring pulse (a response to the tap, never idle).
 * - Armed / active: a static cyan selection ring.
 * - Unavailable (e.g. nothing to undo): icon dims; a tap gives a soft shake.
 */
const ItemButton = memo(function ItemButton({
  id,
  label,
  count,
  disabled,
  selected,
  size,
  onPress,
}: {
  id: GameplayItemId;
  label: string;
  count: number;
  disabled: boolean;
  selected: boolean;
  size: number;
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

  const faceStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: shakeX.value },
      { translateY: depth.value * (reducedMotion ? 1.5 : LIP - 1) },
    ],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: selected ? 1 : ring.value * 0.9,
    transform: [{ scale: reducedMotion || selected ? 1 : 1 + (1 - ring.value) * 0.18 }],
  }));

  const dim = disabled && !empty && !selected;
  const icon = size * 0.5;
  const radius = Math.round(size * 0.32);
  const hitSlop = Math.max(0, Math.ceil((AV_SIZE.itemTap - size) / 2));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={empty ? `${label}, none left, tap to restock` : `${label}, ${count}`}
      accessibilityState={{ disabled: disabled && !empty, selected }}
      hitSlop={hitSlop}
      onPressIn={pressIn}
      onPressOut={pressOut}
      onPress={handlePress}
    >
      <View style={[styles.lift, { width: size, height: size + LIP }]}>
        <View style={[styles.lip, { top: LIP, height: size, borderRadius: radius }]} />
        <Animated.View style={faceStyle}>
          <LinearGradient colors={[AV.plate, AV.plateLow]} style={[styles.face, { width: size, height: size, borderRadius: radius }]}>
            <View style={dim ? styles.iconDim : null}>
              {id === 'undo' ? <UndoGlyph size={icon} /> : null}
              {id === 'extraSlot' ? <SlotGlyph size={icon} /> : null}
              {id === 'bomb' ? <BombGlyph size={icon} /> : null}
            </View>
          </LinearGradient>
          <Animated.View pointerEvents="none" style={[styles.ring, { borderRadius: radius + 4 }, ringStyle]} />
          {/* Badge: count, or a mint "+" restock affordance at zero. */}
          <View style={[styles.badge, empty && styles.badgeEmpty]} pointerEvents="none">
            <Text style={[styles.badgeNum, empty && styles.badgeNumEmpty]}>
              {empty ? '+' : count}
            </Text>
          </View>
        </Animated.View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: AV_SIZE.itemGap,
    alignSelf: 'center',
    paddingTop: 6,
  },
  lift: {
    ...AV_DEPTH.lift,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 8 },
  },
  lip: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: AV.plateLip,
  },
  face: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconDim: { opacity: 0.4 },
  ring: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderWidth: 2,
    borderColor: GP.cyan,
  },
  badge: {
    position: 'absolute',
    right: -6,
    top: -6,
    minWidth: AV_SIZE.itemBadge,
    height: AV_SIZE.itemBadge,
    paddingHorizontal: 4,
    borderRadius: AV_SIZE.itemBadge / 2,
    backgroundColor: AV.gold,
    borderWidth: 2,
    borderColor: AV.shellBottom,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeEmpty: {
    backgroundColor: AV.mint,
  },
  badgeNum: {
    fontFamily: AV_FONT.black,
    color: AV.goldInk,
    fontSize: 11,
    lineHeight: 14,
    fontVariant: ['tabular-nums'],
  },
  badgeNumEmpty: {
    color: AV.white,
    fontSize: 14,
    lineHeight: 16,
  },
});
