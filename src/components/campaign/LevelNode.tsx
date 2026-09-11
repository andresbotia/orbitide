import { Pressable, StyleSheet, Text } from 'react-native';

import type { LevelSlotState } from '@/game/levels/campaignProgress';
import { arcade } from '@/theme/arcade';
import { radius } from '@/theme/spacing';

interface LevelNodeProps {
  levelId: number;
  /** Position within the world (1-based), shown instead of the raw campaign id. */
  positionInWorld: number;
  state: LevelSlotState;
  accent: string;
  size: number;
  onPress: () => void;
}

/**
 * One level-select node: a docking socket, lit with the world's accent when
 * current, filled + checked when complete, dimmed and inert when locked.
 * Mirrors the Tunnel/Holding "physical hardware" bevel language so the whole
 * campaign screen reads as one machine (DESIGN.md §6).
 */
export function LevelNode({ levelId, positionInWorld, state, accent, size, onPress }: LevelNodeProps) {
  const locked = state === 'locked';
  const current = state === 'current';
  const complete = state === 'complete';

  const a11yLabel = locked
    ? `Level ${positionInWorld}, locked`
    : current
      ? `Level ${positionInWorld}, current level`
      : `Level ${positionInWorld}, complete. Tap to replay.`;

  return (
    <Pressable
      onPress={onPress}
      disabled={locked}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ disabled: locked, selected: current }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.node,
        { width: size, height: size, borderRadius: radius.md },
        locked && styles.locked,
        current && { borderColor: accent, backgroundColor: arcade.metalRaised },
        complete && { backgroundColor: accent + '26' },
        pressed && !locked && styles.pressed,
      ]}
      key={levelId}
    >
      <Text style={[styles.number, current && { color: accent }, locked && styles.numberLocked]}>
        {positionInWorld}
      </Text>
      {complete ? <Text style={[styles.check, { color: accent }]}>✓</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  node: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderTopColor: arcade.metalHi,
    borderLeftColor: arcade.metalHi,
    borderRightColor: arcade.metalLo,
    borderBottomColor: arcade.metalLo,
    backgroundColor: arcade.metal,
  },
  locked: { opacity: 0.4 },
  pressed: { transform: [{ translateY: 1 }, { scale: 0.96 }] },
  number: { fontSize: 17, fontWeight: '700', color: arcade.metalEdge },
  numberLocked: { color: arcade.metalEdge },
  check: { position: 'absolute', bottom: 3, fontSize: 10, fontWeight: '800' },
});
