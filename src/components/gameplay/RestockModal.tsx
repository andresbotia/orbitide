import { memo, useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ITEM_DISPLAY_NAMES, M6_ECONOMY, type GameplayItemId } from '@/game/economy/config';
import { feedback } from '@/game/feedback';
import { shake, usePressDepth } from '@/components/gameplay/motionKit';
import { GP, GP_DISPLAY_FONT, GP_RADIUS, GP_TYPE, gpAlpha } from '@/theme/gameplayUi';
import { GP_MOTION } from '@/theme/gameplayMotion';

interface RestockModalProps {
  itemId: GameplayItemId | null;
  coins: number;
  onClose: () => void;
  onBuy: (itemId: GameplayItemId) => Promise<{ success: boolean; reason?: string }>;
}

/**
 * Pixel Arcadia restock confirmation modal.
 * Lightweight, gameplay-integrated, no full store screen.
 */
export const RestockModal = memo(function RestockModal({
  itemId,
  coins,
  onClose,
  onBuy,
}: RestockModalProps) {
  const visible = itemId !== null;
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [prevItemId, setPrevItemId] = useState(itemId);
  if (itemId !== prevItemId) {
    setPrevItemId(itemId);
    setErrorNotice(null);
    setBusy(false);
  }
  const reducedMotion = useReducedMotion();

  const shakeX = useSharedValue(0);
  const modalScale = useSharedValue(visible ? 1 : 0.95);
  const modalOpacity = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (visible) {
      modalScale.set(0.95);
      modalOpacity.set(0);
      modalScale.set(withTiming(1, { duration: reducedMotion ? 0 : 160, easing: Easing.out(Easing.quad) }));
      modalOpacity.set(withTiming(1, { duration: reducedMotion ? 0 : 140 }));
    }
  }, [visible, reducedMotion, modalScale, modalOpacity]);

  const handleCancel = useCallback(() => {
    feedback.emit('select');
    onClose();
  }, [onClose]);

  const handleConfirm = useCallback(async () => {
    if (!itemId || busy) return;
    setBusy(true);
    setErrorNotice(null);

    const price = M6_ECONOMY.itemPrices[itemId];
    if (coins < price) {
      feedback.emit('denied');
      setErrorNotice('Not enough coins');
      if (!reducedMotion) shake(shakeX, GP_MOTION.shakeSoft);
      setBusy(false);
      return;
    }

    const res = await onBuy(itemId);
    if (res.success) {
      feedback.emit('reward');
      onClose();
    } else {
      feedback.emit('denied');
      setErrorNotice('Not enough coins');
      if (!reducedMotion) shake(shakeX, GP_MOTION.shakeSoft);
    }
    setBusy(false);
  }, [itemId, busy, coins, onBuy, onClose, reducedMotion, shakeX]);

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: modalOpacity.value,
    transform: [{ scale: modalScale.value }, { translateX: shakeX.value }],
  }));

  if (!visible || !itemId) return null;

  const price = M6_ECONOMY.itemPrices[itemId];
  const displayName = ITEM_DISPLAY_NAMES[itemId];

  return (
    <Modal
      transparent
      animationType="none"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleCancel} />

        <Animated.View style={[styles.card, containerAnimatedStyle]}>
          <View pointerEvents="none" style={styles.cardLitEdge} />

          <View style={styles.header}>
            <Text style={styles.kicker}>RESTOCK</Text>
            <Text style={styles.title}>{displayName.toUpperCase()}</Text>
          </View>

          <Text style={styles.prompt}>
            Restock 1 {displayName} for{' '}
            <Text style={styles.priceHighlight}>{price} coins</Text>?
          </Text>

          <View style={styles.balanceRow}>
            <View style={styles.coinPip} />
            <Text style={styles.balanceText}>Balance: {coins} coins</Text>
          </View>

          {errorNotice ? (
            <Text style={styles.errorText}>{errorNotice}</Text>
          ) : null}

          <View style={styles.actionRow}>
            <ModalButton label="CANCEL" onPress={handleCancel} variant="secondary" />
            <ModalButton
              label={`GET · ${price}`}
              onPress={handleConfirm}
              variant="primary"
              disabled={busy}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
});

function ModalButton({
  label,
  onPress,
  variant,
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant: 'primary' | 'secondary';
  disabled?: boolean;
}) {
  const { depth, pressIn, pressOut } = usePressDepth();
  const isPrimary = variant === 'primary';

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - depth.value * 0.05 }],
    borderColor: isPrimary
      ? interpolateColor(depth.value, [0, 1], [GP.gold, GP.cyan])
      : GP.hairlineStrong,
  }));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.buttonWrapper}
    >
      <Animated.View
        style={[
          styles.button,
          isPrimary ? styles.buttonPrimary : styles.buttonSecondary,
          animStyle,
        ]}
      >
        <Text style={[styles.buttonText, isPrimary ? styles.buttonTextPrimary : styles.buttonTextSecondary]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: gpAlpha(GP.canvas, 0.75),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: GP.panel,
    borderRadius: GP_RADIUS.panel,
    borderWidth: 1,
    borderColor: GP.hairlineStrong,
    paddingTop: 20,
    paddingBottom: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 12,
  },
  cardLitEdge: {
    position: 'absolute',
    top: -1,
    left: 20,
    right: 20,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: GP.cyan,
    opacity: 0.8,
  },
  header: {
    alignItems: 'center',
    gap: 4,
  },
  kicker: {
    ...GP_TYPE.label,
    fontSize: 10,
    color: GP.cyan,
    letterSpacing: 2,
  },
  title: {
    color: GP.text,
    fontFamily: GP_DISPLAY_FONT,
    fontSize: 18,
    letterSpacing: 1.5,
  },
  prompt: {
    ...GP_TYPE.body,
    fontSize: 14,
    color: GP.textSecondary,
    textAlign: 'center',
  },
  priceHighlight: {
    color: GP.gold,
    fontWeight: '700',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: GP.wellDeep,
    borderWidth: 1,
    borderColor: GP.hairline,
  },
  coinPip: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: GP.gold,
    transform: [{ rotate: '45deg' }],
  },
  balanceText: {
    ...GP_TYPE.label,
    fontSize: 11,
    color: GP.textMuted,
    fontVariant: ['tabular-nums'],
  },
  errorText: {
    ...GP_TYPE.label,
    color: GP.danger,
    fontSize: 12,
    letterSpacing: 1,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 6,
  },
  buttonWrapper: {
    flex: 1,
  },
  button: {
    height: 40,
    borderRadius: GP_RADIUS.control,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  buttonPrimary: {
    backgroundColor: GP.well,
    borderColor: GP.gold,
  },
  buttonSecondary: {
    backgroundColor: GP.canvas,
    borderColor: GP.hairlineStrong,
  },
  buttonText: {
    ...GP_TYPE.label,
    fontSize: 12,
    letterSpacing: 1.5,
  },
  buttonTextPrimary: {
    color: GP.gold,
    fontWeight: '700',
  },
  buttonTextSecondary: {
    color: GP.textSecondary,
  },
});
