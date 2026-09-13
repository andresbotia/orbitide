import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { reachablePixels, remainingPixelCount } from '@/game/engine/pixels';
import { activeCapacity, activeCount } from '@/game/engine/selectors';
import type { GameState } from '@/game/engine/types';
import { HAPTICS_ENABLED, setHapticsEnabled } from '@/game/haptics';
import { useColorAssist } from '@/hooks/useColorAssist';
import { palette } from '@/theme/colors';
import { radius, spacing } from '@/theme/spacing';

interface DebugOverlayProps {
  state: GameState;
  locked: boolean;
  onResetProgress: () => void;
}

/**
 * Development-only state inspector. Rendered only when `__DEV__` is true so it
 * never ships in a release build. Starts collapsed to a small dot.
 */
export function DebugOverlay({ state, locked, onResetProgress }: DebugOverlayProps) {
  const [open, setOpen] = useState(false);
  const [haptics, setHaptics] = useState(HAPTICS_ENABLED);
  const colorAssist = useColorAssist();

  if (!__DEV__) return null;

  if (!open) {
    return (
      <Pressable
        style={styles.dot}
        onPress={() => setOpen(true)}
        accessibilityLabel="Open debug overlay"
      >
        <Text style={styles.dotText}>D</Text>
      </Pressable>
    );
  }

  const reachable = reachablePixels(state);
  const reachableByColor = reachable.reduce<Record<string, number>>((acc, p) => {
    acc[p.color] = (acc[p.color] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Text style={styles.title}>DEBUG</Text>
        <Pressable onPress={() => setOpen(false)} hitSlop={10}>
          <Text style={styles.close}>×</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.body}>
        <Row k="level" v={String(state.levelId)} />
        <Row k="status" v={state.status} />
        <Row k="locked" v={String(locked)} />
        <Row k="movesApplied" v={String(state.movesApplied)} />
        <Row
          k="pixels"
          v={`${remainingPixelCount(state)} left / ${state.pixels.length}`}
        />
        <Row
          k="reachable"
          v={
            Object.entries(reachableByColor)
              .map(([c, n]) => `${c}:${n}`)
              .join('  ') || '(none)'
          }
        />
        <Text style={styles.k}>tunnels</Text>
        {state.tunnels.map((t) => (
          <Text key={t.id} style={styles.line}>
            {t.id.replace('tunnel-', 'T')}: {t.queue.length ? `${t.queue[0]?.color}:${t.queue[0]?.capacity} (+${t.queue.length - 1})` : '(empty)'}
          </Text>
        ))}
        <Row
          k="holding"
          v={`[${state.holding.map((c) => `${c.color}:${c.capacity}`).join(', ')}] ${state.holding.length}/${state.holdingCapacity}`}
        />

        <Row k="active" v={`${activeCount(state)}/${activeCapacity(state)}`} />
        {state.epoch ? (
          <>
            <Row k="epoch clock" v={state.epoch.clock.toFixed(2)} />
            {state.activeCharges.map((c) => (
              <Text key={c.id} style={styles.line}>
                #{c.launchSequence} {c.color} {c.remainingCapacity}/{c.capacity} @{c.insertionTime.toFixed(2)}
                {' '}→{c.finishTime.toFixed(2)} {c.landed}
              </Text>
            ))}
          </>
        ) : null}
      </ScrollView>

      <View style={styles.actions}>
        <Pressable
          style={styles.btn}
          onPress={() => {
            const nextValue = !haptics;
            setHaptics(nextValue);
            setHapticsEnabled(nextValue);
          }}
        >
          <Text style={styles.btnText}>haptics: {haptics ? 'on' : 'off'}</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={colorAssist.toggle}>
          <Text style={styles.btnText}>assist: {colorAssist.enabled ? 'on' : 'off'}</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={onResetProgress}>
          <Text style={styles.btnText}>reset progress</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.k}>{k}</Text>
      <Text style={styles.v}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(143,180,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: { color: palette.coreGlow, fontSize: 11, fontWeight: '700' },
  panel: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 240,
    maxHeight: 380,
    backgroundColor: 'rgba(11,14,22,0.96)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: palette.surfaceBorder,
    padding: spacing.sm,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  title: { color: palette.coreGlow, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  close: { color: palette.textSecondary, fontSize: 16, lineHeight: 16 },
  body: { maxHeight: 270 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1 },
  k: { color: palette.textFaint, fontSize: 11, fontFamily: 'monospace' },
  v: { color: palette.textPrimary, fontSize: 11, fontFamily: 'monospace', flexShrink: 1, textAlign: 'right' },
  line: { color: palette.textSecondary, fontSize: 11, fontFamily: 'monospace', paddingLeft: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  btn: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: radius.sm,
    paddingVertical: 6,
    alignItems: 'center',
  },
  btnText: { color: palette.textSecondary, fontSize: 10 },
});
