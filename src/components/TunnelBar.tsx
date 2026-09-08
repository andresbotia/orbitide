import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';

import { visibleCharges } from '@/game/engine/selectors';
import type { GameState } from '@/game/engine/types';
import { orbColors, orbGlow, orbLabel, palette } from '@/theme/colors';
import { radius, spacing, typography } from '@/theme/spacing';

interface TunnelBarProps {
  state: GameState;
  disabled: boolean;
  onLaunch: (tunnelId: string) => void;
}

/**
 * The three Launch Tunnels. Only the front charge of each tunnel is shown — the
 * rest of the authored queue stays hidden (a dim "more" pip just signals that
 * the tunnel is not empty).
 */
export function TunnelBar({ state, disabled, onLaunch }: TunnelBarProps) {
  const charges = visibleCharges(state);

  return (
    <View style={styles.row}>
      {charges.map(({ tunnelId, charge }, index) => {
        const tunnel = state.tunnels[index];
        const hasMore = (tunnel?.queue.length ?? 0) > 1;
        const empty = !charge;

        return (
          <Pressable
            key={tunnelId}
            disabled={disabled || empty}
            onPress={() => onLaunch(tunnelId)}
            accessibilityRole="button"
            accessibilityLabel={
              charge
                ? `Launch tunnel ${index + 1}, ${orbLabel[charge.color]} charge ${charge.capacity}`
                : `Tunnel ${index + 1} empty`
            }
            style={({ pressed }) => [
              styles.tunnel,
              empty && styles.tunnelEmpty,
              pressed && !empty && styles.tunnelPressed,
            ]}
          >
            <Text style={styles.tunnelLabel}>T{index + 1}</Text>
            {charge ? (
              <Animated.View
                key={charge.id}
                entering={FadeIn.duration(200)}
                exiting={FadeOut.duration(140)}
                layout={LinearTransition.duration(180)}
                style={[
                  styles.charge,
                  {
                    backgroundColor: orbColors[charge.color],
                    borderColor: orbGlow[charge.color],
                  },
                ]}
              >
                <Text style={styles.capacity}>{charge.capacity}</Text>
              </Animated.View>
            ) : (
              <View style={[styles.charge, styles.chargeEmpty]}>
                <Text style={styles.emptyMark}>—</Text>
              </View>
            )}
            <View style={styles.more}>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={[styles.pip, hasMore ? styles.pipOn : styles.pipOff]}
                />
              ))}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const CHARGE = 46;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
  },
  tunnel: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    backgroundColor: palette.surface,
    minWidth: 78,
  },
  tunnelEmpty: { opacity: 0.4 },
  tunnelPressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  tunnelLabel: { ...typography.label, color: palette.textFaint, fontSize: 10 },
  charge: {
    width: CHARGE,
    height: CHARGE,
    borderRadius: CHARGE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chargeEmpty: {
    backgroundColor: palette.abyss,
    borderColor: palette.surfaceBorder,
  },
  capacity: {
    color: '#05060A',
    fontSize: 18,
    fontWeight: '800',
  },
  emptyMark: { color: palette.textFaint, fontSize: 16 },
  more: { flexDirection: 'row', gap: 3, height: 6 },
  pip: { width: 5, height: 5, borderRadius: 3 },
  pipOn: { backgroundColor: palette.coreGlow, opacity: 0.7 },
  pipOff: { backgroundColor: palette.surfaceBorder },
});
