import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ChargeSpec, OrbColor } from '@/game/engine/types';
import { ORB_COLORS } from '@/game/studio/grid';
import type { StudioLevel } from '@/game/studio/types';
import { orbColors, orbLabel } from '@/theme/colors';
import { StudioButton } from './StudioButton';
import { studioSpace, studioTheme } from './theme';

interface TunnelQueueEditorProps {
  level: StudioLevel;
  onAdd: (tunnel: number) => void;
  onRemove: (tunnel: number, index: number) => void;
  onUpdate: (tunnel: number, index: number, patch: Partial<ChargeSpec>) => void;
  onMove: (tunnel: number, index: number, direction: -1 | 1) => void;
  onDuplicate: (tunnel: number, index: number) => void;
}

const TUNNEL_LABEL = ['A', 'B', 'C'];

/** Editor for all three deterministic launch-tunnel queues. */
export function TunnelQueueEditor({ level, onAdd, onRemove, onUpdate, onMove, onDuplicate }: TunnelQueueEditorProps) {
  const [picking, setPicking] = useState<{ t: number; i: number } | null>(null);

  return (
    <View style={styles.wrap}>
      {level.tunnels.map((queue, t) => (
        <View key={t} style={styles.tunnel}>
          <View style={styles.tunnelHeader}>
            <Text style={styles.tunnelTitle}>Tunnel {TUNNEL_LABEL[t]}</Text>
            <Text style={styles.tunnelMeta}>{queue.length} charge{queue.length === 1 ? '' : 's'} · front first</Text>
          </View>

          {queue.length === 0 ? <Text style={styles.empty}>empty</Text> : null}

          {queue.map((spec, i) => (
            <View key={i} style={styles.chargeBlock}>
              <View style={styles.chargeRow}>
                <Text style={styles.index}>{i + 1}</Text>
                <Pressable
                  onPress={() => setPicking(picking?.t === t && picking?.i === i ? null : { t, i })}
                  style={[styles.swatch, { backgroundColor: orbColors[spec.color] }]}
                  accessibilityLabel={`Charge colour ${orbLabel[spec.color]}`}
                />
                <Text style={styles.colorName}>{spec.color}</Text>
                <View style={styles.cap}>
                  <StudioButton label="–" compact onPress={() => onUpdate(t, i, { capacity: Math.max(1, spec.capacity - 1) })} />
                  <Text style={styles.capValue}>{spec.capacity}</Text>
                  <StudioButton label="+" compact onPress={() => onUpdate(t, i, { capacity: spec.capacity + 1 })} />
                </View>
              </View>
              <View style={styles.chargeActions}>
                <StudioButton label="↑" compact onPress={() => onMove(t, i, -1)} disabled={i === 0} />
                <StudioButton label="↓" compact onPress={() => onMove(t, i, 1)} disabled={i === queue.length - 1} />
                <StudioButton label="dup" compact onPress={() => onDuplicate(t, i)} />
                <StudioButton label="del" compact variant="danger" onPress={() => { onRemove(t, i); setPicking(null); }} />
              </View>
              {picking?.t === t && picking?.i === i ? (
                <View style={styles.picker}>
                  {ORB_COLORS.map((c: OrbColor) => (
                    <Pressable
                      key={c}
                      onPress={() => { onUpdate(t, i, { color: c }); setPicking(null); }}
                      style={[styles.pickSwatch, { backgroundColor: orbColors[c] }, c === spec.color && styles.pickActive]}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          ))}

          <StudioButton label="+ Add charge" compact onPress={() => onAdd(t)} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: studioSpace.md },
  tunnel: {
    borderWidth: 1,
    borderColor: studioTheme.border,
    borderRadius: 6,
    padding: studioSpace.sm,
    backgroundColor: studioTheme.bg,
    gap: studioSpace.sm,
  },
  tunnelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  tunnelTitle: { color: studioTheme.text, fontSize: 13, fontWeight: '700' },
  tunnelMeta: { color: studioTheme.textFaint, fontSize: 10, fontFamily: studioTheme.mono },
  empty: { color: studioTheme.textFaint, fontSize: 11, fontStyle: 'italic' },
  chargeBlock: {
    borderWidth: 1,
    borderColor: studioTheme.border,
    borderRadius: 5,
    padding: 6,
    gap: 6,
    backgroundColor: studioTheme.panel,
  },
  chargeRow: { flexDirection: 'row', alignItems: 'center', gap: studioSpace.sm },
  index: { color: studioTheme.textFaint, fontSize: 11, width: 14, fontFamily: studioTheme.mono },
  swatch: { width: 22, height: 22, borderRadius: 4, borderWidth: 1, borderColor: studioTheme.borderStrong },
  colorName: { color: studioTheme.textDim, fontSize: 11, flex: 1 },
  cap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  capValue: { color: studioTheme.text, fontSize: 13, fontFamily: studioTheme.mono, minWidth: 22, textAlign: 'center' },
  chargeActions: { flexDirection: 'row', gap: 4 },
  picker: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, paddingTop: 4 },
  pickSwatch: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: 'transparent' },
  pickActive: { borderColor: studioTheme.text },
});
