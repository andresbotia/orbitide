import { useCallback, useEffect, useState } from 'react';

import { loadSettings, writeSettings } from '@/storage/settings';

/**
 * Presentation-level Color Assist preference. Defaults OFF. A module-level cache
 * keeps every mounted consumer in sync without a context provider, mirroring the
 * lightweight haptics-enabled pattern.
 */
let cached = false;
let loaded = false;
const listeners = new Set<(v: boolean) => void>();

function broadcast(v: boolean) {
  cached = v;
  for (const l of listeners) l(v);
}

export async function setColorAssistEnabled(enabled: boolean): Promise<void> {
  broadcast(enabled);
  const current = await loadSettings();
  await writeSettings({ ...current, colorAssist: enabled });
}

export interface ColorAssistApi {
  enabled: boolean;
  ready: boolean;
  setEnabled: (v: boolean) => void;
  toggle: () => void;
}

export function useColorAssist(): ColorAssistApi {
  const [enabled, setLocal] = useState(cached);
  const [ready, setReady] = useState(loaded);

  useEffect(() => {
    const listener = (v: boolean) => setLocal(v);
    listeners.add(listener);
    if (!loaded) {
      void loadSettings().then((s) => {
        loaded = true;
        broadcast(s.colorAssist);
        setReady(true);
      });
    }
    return () => { listeners.delete(listener); };
  }, []);

  const setEnabled = useCallback((v: boolean) => { void setColorAssistEnabled(v); }, []);
  const toggle = useCallback(() => { void setColorAssistEnabled(!cached); }, []);

  return { enabled, ready, setEnabled, toggle };
}
