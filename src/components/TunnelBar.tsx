import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Point } from '@/game/rendering/boardGeometry';
import { ColorAssistMark } from '@/components/ColorAssistMark';
import { visibleCharges } from '@/game/engine/selectors';
import type { GameState } from '@/game/engine/types';
import { orbColors, orbGlow, orbLabel } from '@/theme/colors';
import { arcade } from '@/theme/arcade';
import { spacing } from '@/theme/spacing';

interface TunnelBarProps {
  state: GameState;
  layoutVersion: number;
  disabled: boolean;
  colorAssist?: boolean;
  onLaunch: (tunnelId: string) => void;
  onSourceLayout: (key: string, point: Point) => void;
}

/**
 * The three Launch Tunnels as physical arcade hardware: dark matte housings, a
 * bright readable front charge with its capacity number, a large tap target and
 * a recessed magazine that *implies* a loaded queue without revealing the
 * authored future charges. Housings stay subordinate to the board.
 */
export function TunnelBar({ state, disabled, colorAssist, onLaunch, onSourceLayout, layoutVersion }: TunnelBarProps) {
  const charges = visibleCharges(state);
  const sources = useRef<(View | null)[]>([]);

  useEffect(() => {
    sources.current.forEach((node, index) => node?.measureInWindow((x, y, width, height) =>
      onSourceLayout(`tunnel-${index}`, { x: x + width / 2, y: y + height / 2 })));
  }, [layoutVersion, onSourceLayout]);

  return (
    <View style={styles.row}>
      {charges.map(({ tunnelId, charge }, index) => {
        const tunnel = state.tunnels[index];
        const queued = tunnel?.queue.length ?? 0;
        const hasMore = queued > 1;
        const empty = !charge;

        return (
          <Pressable
            key={tunnelId}
            disabled={disabled || empty}
            onPressIn={() => onLaunch(tunnelId)}
            accessibilityState={{ disabled: disabled || empty }}
            accessibilityRole="button"
            accessibilityLabel={
              charge
                ? `Launch tunnel ${index + 1}, ${orbLabel[charge.color]} charge ${charge.capacity}`
                : `Tunnel ${index + 1} empty`
            }
            hitSlop={6}
            style={({ pressed }) => [
              styles.tunnel,
              empty && styles.tunnelEmpty,
              pressed && !empty && styles.tunnelPressed,
            ]}
          >
            {/* Recessed magazine — depth only, never the actual queue. */}
            <View style={styles.magazine}>
              <View style={[styles.plate, hasMore ? styles.plateLoaded : styles.plateFlat]} />
              <View style={[styles.plate, styles.plateBack, queued > 2 ? styles.plateLoaded : styles.plateFlat]} />
            </View>

            <View style={styles.port}>
              {charge ? (
                <View
                  ref={(node: View | null) => { sources.current[index] = node; }}
                  onLayout={() => sources.current[index]?.measureInWindow((x, y, width, height) =>
                    onSourceLayout(tunnelId, { x: x + width / 2, y: y + height / 2 }))}
                  collapsable={false}
                  key={charge.id}
                  style={[
                    styles.charge,
                    { backgroundColor: orbColors[charge.color], borderColor: orbGlow[charge.color] },
                  ]}
                >
                  <View style={styles.chargeGloss} />
                  <Text style={styles.capacity}>{charge.capacity}</Text>
                  {colorAssist ? (
                    <View style={styles.assist} pointerEvents="none">
                      <ColorAssistMark color={charge.color} size={15} etched />
                    </View>
                  ) : null}
                </View>
              ) : (
                <View style={[styles.charge, styles.chargeEmpty]}>
                  <Text style={styles.emptyMark}>—</Text>
                </View>
              )}
            </View>

            <Text style={styles.tunnelLabel}>T{index + 1}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const CHARGE = 46;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md },
  tunnel: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderTopColor: arcade.metalHi,
    borderLeftColor: arcade.metalHi,
    borderRightColor: arcade.metalLo,
    borderBottomColor: arcade.metalLo,
    backgroundColor: arcade.metal,
    minWidth: 82,
  },
  tunnelEmpty: { opacity: 0.35 },
  tunnelPressed: { transform: [{ translateY: 1 }, { scale: 0.97 }], backgroundColor: arcade.metalLo },
  magazine: {
    width: 34,
    height: 10,
    marginBottom: spacing.xs,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  plate: { position: 'absolute', width: 30, height: 4, borderRadius: 2 },
  plateBack: { width: 22, bottom: 5 },
  plateLoaded: { backgroundColor: arcade.accentDim },
  plateFlat: { backgroundColor: arcade.metalLo },
  port: {
    width: CHARGE + 12,
    height: CHARGE + 12,
    borderRadius: (CHARGE + 12) / 2,
    backgroundColor: arcade.socket,
    borderWidth: 1,
    // Recessed-well shading (dark top-left, rim bottom-right) — same concave
    // language as HoldingTray's socket, so both hardware read as one family.
    borderTopColor: arcade.metalLo,
    borderLeftColor: arcade.metalLo,
    borderRightColor: arcade.socketRim,
    borderBottomColor: arcade.socketRim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  charge: {
    width: CHARGE,
    height: CHARGE,
    borderRadius: CHARGE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chargeGloss: {
    position: 'absolute',
    top: CHARGE * 0.16,
    left: CHARGE * 0.2,
    width: CHARGE * 0.5,
    height: CHARGE * 0.36,
    borderRadius: CHARGE * 0.3,
    backgroundColor: arcade.glassHi,
    opacity: 0.5,
  },
  chargeEmpty: { backgroundColor: arcade.metalLo, borderColor: arcade.socketRim },
  assist: { position: 'absolute', bottom: 3, alignSelf: 'center' },
  capacity: { color: '#05060A', fontSize: 18, fontWeight: '800' },
  emptyMark: { color: arcade.metalEdge, fontSize: 16 },
  tunnelLabel: { marginTop: spacing.xs, color: arcade.metalEdge, fontSize: 10, letterSpacing: 3, fontWeight: '700' },
});
