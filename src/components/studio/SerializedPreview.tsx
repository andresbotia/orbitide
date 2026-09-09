import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { serializeToJSON, serializeToTS } from '@/game/studio/serialize';
import type { StudioLevel } from '@/game/studio/types';
import { StudioButton } from './StudioButton';
import { studioSpace, studioTheme } from './theme';

interface SerializedPreviewProps {
  level: StudioLevel;
  exportable: boolean;
}

/**
 * The canonical serialised level definition, exactly as it would be committed to
 * `levelDefinitions.ts` (TS) or a `.json` sidecar. Deterministic and read-only;
 * Copy / Download live on the bottom action bar.
 */
export function SerializedPreview({ level, exportable }: SerializedPreviewProps) {
  const [format, setFormat] = useState<'ts' | 'json'>('ts');
  const text = format === 'ts' ? serializeToTS(level) : serializeToJSON(level);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={styles.tabs}>
          <StudioButton label="TS" compact variant={format === 'ts' ? 'primary' : 'default'} onPress={() => setFormat('ts')} />
          <StudioButton label="JSON" compact variant={format === 'json' ? 'primary' : 'default'} onPress={() => setFormat('json')} />
        </View>
        {!exportable ? <Text style={styles.blocked}>hard-invalid — fix errors before committing</Text> : null}
      </View>
      <ScrollView horizontal style={styles.codeScroll}>
        <ScrollView style={styles.codeScrollY} contentContainerStyle={styles.codeInner}>
          <Text selectable style={styles.code}>{text}</Text>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: studioSpace.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: studioSpace.sm, flexWrap: 'wrap' },
  tabs: { flexDirection: 'row', gap: 4 },
  blocked: { color: studioTheme.warning, fontSize: 10, fontFamily: studioTheme.mono },
  codeScroll: {
    borderWidth: 1,
    borderColor: studioTheme.border,
    backgroundColor: studioTheme.bg,
    borderRadius: 5,
    maxHeight: 260,
  },
  codeScrollY: { maxHeight: 260 },
  codeInner: { padding: studioSpace.sm },
  code: { color: studioTheme.textDim, fontSize: 11, lineHeight: 15, fontFamily: studioTheme.mono },
});
