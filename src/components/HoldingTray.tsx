import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Charge } from '@/game/engine/types';
import type { Point } from '@/game/rendering/boardGeometry';
import { orbColors, orbGlow, orbLabel } from '@/theme/colors';
import { arcade } from '@/theme/arcade';
import { spacing, typography } from '@/theme/spacing';

interface HoldingTrayProps {
  holding: Charge[];
  capacity: number;
  overflow: boolean;
  disabled: boolean;
  usefulIds: Set<string>;
  onLaunch: (id: string) => void;
  onSourceLayout: (key: string, point: Point) => void;
  message: string;
  layoutVersion: number;
  /** Future Extra Slot booster — draws the inert [+] affordance when true. */
  boosterSlot?: boolean;
}

/**
 * Holding — three permanent recessed sockets. Empty reads as machined socket;
 * occupied holds a dimensional orb with its capacity. 2/3 shows restrained
 * pressure, 3/3 reads clearly full but never implies automatic failure. Held
 * charges never auto-launch; a manual tap relaunches a useful one.
 */
export function HoldingTray({
  holding, capacity, overflow, disabled, usefulIds, onLaunch, onSourceLayout, message, layoutVersion, boosterSlot,
}: HoldingTrayProps) {
  const slots = useRef<(View | null)[]>([]);
  useEffect(() => {
    slots.current.forEach((node, index) => node?.measureInWindow((x, y, width, height) =>
      onSourceLayout(`holding-${index}`, { x: x + width / 2, y: y + height / 2 })));
  }, [layoutVersion, onSourceLayout]);

  const pressure = holding.length >= 2 && !overflow;

  return (
    <View style={styles.container}>
      <Text style={[styles.label, pressure && styles.labelPressure, overflow && styles.labelFull]}>
        HOLDING {holding.length}/{capacity}
      </Text>

      <View style={[styles.deck, pressure && styles.deckPressure, overflow && styles.deckFull]}>
        {Array.from({ length: capacity }, (_, index) => {
          const charge = holding[index];
          const useful = !!charge && usefulIds.has(charge.id);
          return (
            <Pressable
              key={index}
              ref={(node) => { slots.current[index] = node; }}
              collapsable={false}
              onLayout={() => slots.current[index]?.measureInWindow((x, y, width, height) =>
                onSourceLayout(`holding-${index}`, { x: x + width / 2, y: y + height / 2 }))}
              disabled={disabled || !charge}
              onPressIn={() => charge && onLaunch(charge.id)}
              accessibilityRole="button"
              accessibilityState={{ disabled: disabled || !charge }}
              accessibilityLabel={charge
                ? `Relaunch ${orbLabel[charge.color]} charge, capacity ${charge.capacity}`
                : `Holding slot ${index + 1}, empty`}
              accessibilityHint={useful ? 'Tap to launch again' : 'No exposed matching pixels yet'}
              style={({ pressed }) => [
                styles.socket,
                useful && styles.socketReady,
                pressed && charge && styles.socketPressed,
              ]}
            >
              {charge ? (
                <View style={[styles.orb, { backgroundColor: orbColors[charge.color], borderColor: orbGlow[charge.color], opacity: useful ? 1 : 0.7 }]}>
                  <View style={styles.orbGloss} />
                  <Text style={styles.count}>{charge.capacity}</Text>
                </View>
              ) : (
                <View style={styles.socketWell} />
              )}
            </Pressable>
          );
        })}

        {boosterSlot ? (
          <View style={[styles.socket, styles.boosterSlot]}>
            <Text style={styles.boosterMark}>+</Text>
          </View>
        ) : null}
      </View>

      <Text accessibilityLiveRegion="polite" style={styles.help}>
        {message || (holding.length ? 'Tap a held charge to launch it again.' : ' ')}
      </Text>
    </View>
  );
}

const SOCKET = 56;

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.sm },
  label: { ...typography.label, color: arcade.metalEdge },
  labelPressure: { color: arcade.warn },
  labelFull: { color: arcade.danger },
  deck: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: 16,
    backgroundColor: arcade.metal,
    borderWidth: 1,
    borderTopColor: arcade.metalHi,
    borderLeftColor: arcade.metalHi,
    borderRightColor: arcade.metalLo,
    borderBottomColor: arcade.metalLo,
  },
  deckPressure: { borderTopColor: arcade.warn, borderLeftColor: arcade.warn },
  deckFull: { borderColor: arcade.danger, borderTopColor: arcade.danger, borderLeftColor: arcade.danger },
  socket: {
    width: SOCKET,
    height: SOCKET,
    borderRadius: 14,
    backgroundColor: arcade.socket,
    borderWidth: 1,
    borderTopColor: arcade.metalLo,
    borderLeftColor: arcade.metalLo,
    borderRightColor: arcade.socketRim,
    borderBottomColor: arcade.socketRim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socketWell: {
    width: SOCKET * 0.5,
    height: SOCKET * 0.5,
    borderRadius: SOCKET * 0.25,
    backgroundColor: arcade.metalLo,
    opacity: 0.7,
  },
  socketReady: { borderColor: arcade.accent, borderTopColor: arcade.accent, borderLeftColor: arcade.accent, borderRightColor: arcade.accent, borderBottomColor: arcade.accent },
  socketPressed: { transform: [{ scale: 0.94 }], backgroundColor: arcade.metalLo },
  orb: {
    width: SOCKET * 0.68,
    height: SOCKET * 0.68,
    borderRadius: SOCKET * 0.34,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  orbGloss: {
    position: 'absolute',
    top: SOCKET * 0.1,
    left: SOCKET * 0.14,
    width: SOCKET * 0.32,
    height: SOCKET * 0.22,
    borderRadius: SOCKET * 0.2,
    backgroundColor: arcade.glassHi,
    opacity: 0.5,
  },
  boosterSlot: { borderStyle: 'dashed', borderColor: arcade.metalEdge, opacity: 0.5 },
  boosterMark: { color: arcade.metalEdge, fontSize: 22, fontWeight: '700' },
  count: { color: '#05060A', fontSize: 17, fontWeight: '800' },
  help: { color: arcade.metalEdge, fontSize: 12, minHeight: 16, textAlign: 'center', paddingHorizontal: 12 },
});
