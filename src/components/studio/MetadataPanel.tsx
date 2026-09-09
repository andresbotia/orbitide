import type { ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import type { LevelDifficulty } from '@/game/engine/types';
import { LEVEL_DIFFICULTIES } from '@/game/studio/constants';
import { GRID_RANGE, TUNED_GRID_SIZES } from '@/game/studio/grid';
import type { StudioLevel } from '@/game/studio/types';
import { StudioButton } from './StudioButton';
import { studioSpace, studioTheme } from './theme';

interface MetadataPanelProps {
  level: StudioLevel;
  onMeta: (patch: Partial<Pick<StudioLevel, 'id' | 'title' | 'themeId' | 'difficulty'>>) => void;
  onResize: (width: number, height: number) => void;
}

export function MetadataPanel({ level, onMeta, onResize }: MetadataPanelProps) {
  return (
    <View style={styles.wrap}>
      <Field label="Level ID">
        <TextInput
          value={String(level.id)}
          onChangeText={(t) => {
            const n = Number.parseInt(t, 10);
            if (Number.isFinite(n)) onMeta({ id: n });
          }}
          keyboardType="number-pad"
          style={styles.input}
        />
      </Field>
      <Field label="Title">
        <TextInput value={level.title} onChangeText={(t) => onMeta({ title: t })} style={styles.input} />
      </Field>
      <Field label="Theme / artwork">
        <TextInput value={level.themeId} onChangeText={(t) => onMeta({ themeId: t })} style={styles.input} />
      </Field>

      <Field label="Difficulty">
        <View style={styles.segmented}>
          {LEVEL_DIFFICULTIES.map((d: LevelDifficulty) => (
            <StudioButton
              key={d}
              label={d}
              compact
              variant={level.difficulty === d ? 'primary' : 'default'}
              onPress={() => onMeta({ difficulty: d })}
            />
          ))}
        </View>
      </Field>

      <Field label="Grid size">
        <View style={styles.dimRow}>
          <Dimension
            value={level.width}
            onChange={(w) => onResize(w, level.height)}
            axis="W"
          />
          <Text style={styles.times}>×</Text>
          <Dimension
            value={level.height}
            onChange={(h) => onResize(level.width, h)}
            axis="H"
          />
        </View>
        <View style={styles.presetRow}>
          {TUNED_GRID_SIZES.map((s) => (
            <StudioButton key={s} label={`${s}²`} compact onPress={() => onResize(s, s)} />
          ))}
        </View>
      </Field>
    </View>
  );
}

function Dimension({ value, axis, onChange }: { value: number; axis: string; onChange: (n: number) => void }) {
  const clamp = (n: number) => Math.max(GRID_RANGE.min, Math.min(GRID_RANGE.max, n));
  return (
    <View style={styles.dim}>
      <StudioButton label="–" compact onPress={() => onChange(clamp(value - 1))} disabled={value <= GRID_RANGE.min} />
      <Text style={styles.dimValue}>{axis} {value}</Text>
      <StudioButton label="+" compact onPress={() => onChange(clamp(value + 1))} disabled={value >= GRID_RANGE.max} />
    </View>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: studioSpace.md },
  field: { gap: studioSpace.xs },
  label: { color: studioTheme.textDim, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: studioTheme.border,
    backgroundColor: studioTheme.bg,
    color: studioTheme.text,
    paddingHorizontal: studioSpace.sm,
    paddingVertical: 6,
    borderRadius: 5,
    fontSize: 13,
  },
  segmented: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  dimRow: { flexDirection: 'row', alignItems: 'center', gap: studioSpace.sm },
  dim: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dimValue: { color: studioTheme.text, fontSize: 12, fontFamily: studioTheme.mono, minWidth: 34, textAlign: 'center' },
  times: { color: studioTheme.textFaint, fontSize: 14 },
  presetRow: { flexDirection: 'row', gap: 4, marginTop: 4 },
});
