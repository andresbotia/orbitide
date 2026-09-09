import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { serializeToJSON, serializeToTS } from '@/game/studio/serialize';
import type { StudioLevel } from '@/game/studio/types';
import { StudioButton } from './StudioButton';
import { studioSpace, studioTheme } from './theme';

interface StudioActionBarProps {
  level: StudioLevel;
  exportable: boolean;
  onPlay: () => void;
}

/**
 * Bottom action bar. Save/export is local-only (no backend): the developer
 * copies the canonical TS to paste into `levelDefinitions.ts`, or downloads a
 * `.json` sidecar — either way the level ends up committed to Git like any other
 * level. Hard-invalid levels cannot be exported.
 */
export function StudioActionBar({ level, exportable, onPlay }: StudioActionBarProps) {
  const [flash, setFlash] = useState<string | null>(null);

  const note = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash((cur) => (cur === msg ? null : cur)), 2500);
  };

  const copyTS = async () => {
    try {
      await navigator.clipboard.writeText(serializeToTS(level));
      note('Copied canonical TS — paste into LEVEL_DEFINITIONS');
    } catch {
      note('Clipboard blocked — select the text in the preview instead');
    }
  };

  const downloadJSON = () => {
    try {
      const blob = new Blob([serializeToJSON(level)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `level-${level.id}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      note(`Downloaded level-${level.id}.json`);
    } catch (e) {
      note(`Download failed: ${(e as Error).message}`);
    }
  };

  return (
    <View style={styles.bar}>
      <StudioButton label="▶ Play Level" variant="primary" disabled={!exportable} onPress={onPlay} />
      <View style={styles.spacer} />
      {flash ? <Text style={styles.flash}>{flash}</Text> : null}
      <StudioButton label="Copy as TS" disabled={!exportable} onPress={copyTS} />
      <StudioButton label="Download JSON" disabled={!exportable} onPress={downloadJSON} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: studioSpace.sm,
    paddingHorizontal: studioSpace.lg,
    paddingVertical: studioSpace.md,
    borderTopWidth: 1,
    borderTopColor: studioTheme.border,
    backgroundColor: studioTheme.panel,
  },
  spacer: { flex: 1 },
  flash: { color: studioTheme.ok, fontSize: 11, fontFamily: studioTheme.mono },
});
