import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import type { LevelDefinition } from '@/game/engine/types';
import PlaytestStage from './PlaytestStage';
import { StudioButton } from './StudioButton';
import { StudioErrorBoundary } from './StudioErrorBoundary';
import { studioSpace, studioTheme } from './theme';

/** canvaskit-wasm shipped with @shopify/react-native-skia 2.6.2. */
const CANVASKIT_VERSION = '0.41.0';
const CANVASKIT_BASE = `https://cdn.jsdelivr.net/npm/canvaskit-wasm@${CANVASKIT_VERSION}/bin/full/`;

type LoadState = 'loading' | 'ready' | 'failed';

interface CanvasKitGlobal {
  CanvasKit?: unknown;
  CanvasKitInit?: (opts: { locateFile: (file: string) => string }) => Promise<unknown>;
}

/**
 * Loads CanvasKit from the jsDelivr CDN via a plain <script> tag (web only) and
 * publishes it as `global.CanvasKit`, which @shopify/react-native-skia's web
 * renderer reads. Deliberately NOT `@shopify/.../web`'s `WithSkiaWeb` /
 * `LoadSkiaWeb` — those statically `import "canvaskit-wasm/bin/full/canvaskit"`,
 * which pulls Node `fs` into the graph and breaks the native bundle.
 */
function useCanvasKitWeb(): LoadState {
  const g = globalThis as unknown as CanvasKitGlobal;
  const [state, setState] = useState<LoadState>(g.CanvasKit ? 'ready' : 'loading');

  useEffect(() => {
    if (g.CanvasKit) return;
    let cancelled = false;
    const script = document.createElement('script');
    script.src = `${CANVASKIT_BASE}canvaskit.js`;
    script.async = true;
    script.onload = () => {
      g.CanvasKitInit?.({ locateFile: (file) => `${CANVASKIT_BASE}${file}` })
        .then((ck) => {
          if (cancelled) return;
          g.CanvasKit = ck;
          setState('ready');
        })
        .catch(() => { if (!cancelled) setState('failed'); });
    };
    script.onerror = () => { if (!cancelled) setState('failed'); };
    document.head.appendChild(script);
    return () => { cancelled = true; };
  }, [g]);

  return state;
}

interface StudioPlaytestProps {
  level: LevelDefinition;
  onExit: () => void;
}

/** Web-only wrapper: ensures CanvasKit is ready, then mounts the real board. */
export function StudioPlaytest({ level, onExit }: StudioPlaytestProps) {
  const canvasKit = useCanvasKitWeb();

  if (canvasKit === 'failed') {
    return (
      <View style={styles.center}>
        <Text style={styles.failed}>
          Could not load CanvasKit from the CDN. The editor still works — check
          the network, or run `npx setup-skia-web` and reload.
        </Text>
        <StudioButton label="Back to editor" variant="primary" onPress={onExit} />
      </View>
    );
  }

  if (canvasKit === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={studioTheme.accent} />
        <Text style={styles.loadingText}>Loading CanvasKit…</Text>
      </View>
    );
  }

  return (
    <StudioErrorBoundary title="Playtest could not start" onReset={onExit}>
      <PlaytestStage level={level} onExit={onExit} />
    </StudioErrorBoundary>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: studioSpace.md, padding: studioSpace.xl },
  loadingText: { color: studioTheme.textDim, fontSize: 12, fontFamily: studioTheme.mono },
  failed: { color: studioTheme.warning, fontSize: 12, fontFamily: studioTheme.mono, textAlign: 'center', maxWidth: 380 },
});
