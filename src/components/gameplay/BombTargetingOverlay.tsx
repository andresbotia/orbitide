import { memo, useCallback } from 'react';
import {
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { GameState } from '@/game/engine/types';
import { isCoreV2 } from '@/game/engine/ruleset';
import { isValidBombTarget } from '@/game/engine/bomb';
import { computeBoardGeometry, type Point } from '@/game/rendering/boardGeometry';
import { GP, GP_RADIUS, GP_TYPE, gpAlpha } from '@/theme/gameplayUi';
import { feedback } from '@/game/feedback';

interface BombTargetingOverlayProps {
  width: number;
  height: number;
  state: GameState;
  onTarget: (target: Point) => void;
  onCancel: () => void;
}

/**
 * Restrained targeting overlay when Bomb is armed.
 * Intercepts board taps, validates pixel target in cell coordinates,
 * and passes the validated target to the session.
 */
export const BombTargetingOverlay = memo(function BombTargetingOverlay({
  width,
  height,
  state,
  onTarget,
  onCancel,
}: BombTargetingOverlayProps) {
  const geo = computeBoardGeometry(Math.max(width, height), state.width, state.height, {
    roundedRect: isCoreV2(state.ruleset),
    box: { width, height },
  });

  const handlePress = useCallback(
    (e: GestureResponderEvent) => {
      const { locationX, locationY } = e.nativeEvent;
      const gridX = Math.floor((locationX - geo.gridOrigin.x) / geo.cell);
      const gridY = Math.floor((locationY - geo.gridOrigin.y) / geo.cell);

      if (
        gridX >= 0 &&
        gridX < state.width &&
        gridY >= 0 &&
        gridY < state.height &&
        isValidBombTarget(state, { x: gridX, y: gridY })
      ) {
        onTarget({ x: gridX, y: gridY });
      } else {
        feedback.emit('denied');
      }
    },
    [geo, state, onTarget],
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Interactive touch capture surface over the board */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel="Select target pixel for bomb"
      >
        {/* Restrained targeting cue frame around the board */}
        <View style={styles.cueFrame} pointerEvents="none">
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>

        {/* Floating guidance pill */}
        <View style={styles.bannerWrap} pointerEvents="none">
          <View style={styles.banner}>
            <View style={styles.goldPip} />
            <Text style={styles.bannerText}>SELECT TARGET PIXEL (3×3)</Text>
            <View style={styles.goldPip} />
          </View>
        </View>
      </Pressable>
    </View>
  );
});

/**
 * Compact Skia / Reanimated detonation flash for the 3x3 region.
 * Disposes after 220ms.
 */
export const BombDetonationFlash = memo(function BombDetonationFlash({
  point,
  size,
}: {
  point: Point;
  size: number;
}) {
  const scale = useSharedValue(0.4);
  const opacity = useSharedValue(1);

  scale.set(withTiming(1.3, { duration: 200 }));
  opacity.set(withSequence(withTiming(1, { duration: 40 }), withTiming(0, { duration: 160 })));

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.detonationRing,
        {
          left: point.x - size / 2,
          top: point.y - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        animStyle,
      ]}
    />
  );
});

const styles = StyleSheet.create({
  cueFrame: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1,
    borderColor: gpAlpha(GP.gold, 0.4),
    borderRadius: GP_RADIUS.panel,
  },
  corner: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderColor: GP.gold,
  },
  cornerTL: { top: 2, left: 2, borderTopWidth: 2, borderLeftWidth: 2 },
  cornerTR: { top: 2, right: 2, borderTopWidth: 2, borderRightWidth: 2 },
  cornerBL: { bottom: 2, left: 2, borderBottomWidth: 2, borderLeftWidth: 2 },
  cornerBR: { bottom: 2, right: 2, borderBottomWidth: 2, borderRightWidth: 2 },
  bannerWrap: {
    position: 'absolute',
    top: 10,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: gpAlpha(GP.canvas, 0.9),
    borderWidth: 1,
    borderColor: GP.gold,
  },
  goldPip: {
    width: 5,
    height: 5,
    borderRadius: 1,
    backgroundColor: GP.gold,
  },
  bannerText: {
    ...GP_TYPE.label,
    color: GP.gold,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  detonationRing: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: GP.gold,
    backgroundColor: gpAlpha(GP.gold, 0.25),
  },
});
