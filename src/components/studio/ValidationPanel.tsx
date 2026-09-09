import { StyleSheet, Text, View } from 'react-native';

import type { ValidationReport } from '@/game/studio/types';
import { studioSpace, studioTheme } from './theme';

/** Renders the shared {@link ValidationReport}. It never re-derives a rule. */
export function ValidationPanel({ report }: { report: ValidationReport }) {
  const clean = report.errors.length === 0 && report.warnings.length === 0;
  return (
    <View style={styles.wrap}>
      <View style={styles.statusRow}>
        <View style={[styles.badge, report.ok ? styles.badgeOk : styles.badgeErr]}>
          <Text style={styles.badgeText}>{report.ok ? 'VALID' : 'INVALID'}</Text>
        </View>
        <Text style={styles.summary}>
          {report.errors.length} error{report.errors.length === 1 ? '' : 's'} · {report.warnings.length} warning{report.warnings.length === 1 ? '' : 's'}
          {report.exportable ? '' : ' · not exportable'}
        </Text>
      </View>

      {clean ? <Text style={styles.clean}>No issues.</Text> : null}

      {report.errors.map((issue, i) => (
        <Text key={`e${i}`} style={[styles.line, styles.errorLine]}>■ {issue.message}</Text>
      ))}
      {report.warnings.map((issue, i) => (
        <Text key={`w${i}`} style={[styles.line, styles.warnLine]}>▲ {issue.message}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: studioSpace.sm },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  badgeOk: { backgroundColor: studioTheme.ok },
  badgeErr: { backgroundColor: studioTheme.error },
  badgeText: { color: '#0a0c11', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  summary: { color: studioTheme.textDim, fontSize: 11, fontFamily: studioTheme.mono },
  clean: { color: studioTheme.textFaint, fontSize: 11 },
  line: { fontSize: 11, lineHeight: 15, fontFamily: studioTheme.mono },
  errorLine: { color: studioTheme.error },
  warnLine: { color: studioTheme.warning },
});
