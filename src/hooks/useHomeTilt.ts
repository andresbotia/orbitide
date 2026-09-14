import { useEffect, useState } from 'react';

import { DEFAULT_SETTINGS, loadSettings, writeSettings } from '@/storage/settings';

/**
 * Home scene gyroscope-tilt preference. Defaults ON. Same module-level cache
 * pattern as `useColorAssist`, so every mounted consumer stays in sync without a
 * context provider. Reduced motion is applied by the consumer and always wins.
 */
let cached = DEFAULT_SETTINGS.homeTilt;
let loaded = false;
const listeners = new Set<(v: boolean) => void>();

function broadcast(v: boolean) {
  cached = v;
  for (const l of listeners) l(v);
}

export async function setHomeTiltEnabled(enabled: boolean): Promise<void> {
  broadcast(enabled);
  const current = await loadSettings();
  await writeSettings({ ...current, homeTilt: enabled });
}

export function useHomeTilt(): boolean {
  const [enabled, setLocal] = useState(cached);

  useEffect(() => {
    const listener = (v: boolean) => setLocal(v);
    listeners.add(listener);
    if (!loaded) {
      void loadSettings().then((s) => {
        loaded = true;
        broadcast(s.homeTilt);
      });
    }
    return () => { listeners.delete(listener); };
  }, []);

  return enabled;
}
