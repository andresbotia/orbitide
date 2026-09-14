import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'orbitide/settings/v1';

/**
 * Presentation preferences. Kept deliberately small — no full Settings screen in
 * this pass. Color Assist defaults OFF; product logic decides when to recommend
 * it (see `recommendColorAssist`). Home tilt defaults ON; reduced motion always
 * overrides it.
 *
 * Writers must merge with the stored value (`{ ...current, key }`) so one
 * preference never erases another.
 */
export interface Settings {
  colorAssist: boolean;
  /** Gyroscope parallax on the Home scene. */
  homeTilt: boolean;
}

export const DEFAULT_SETTINGS: Settings = { colorAssist: false, homeTilt: true };

function sanitize(raw: unknown): Settings {
  if (raw && typeof raw === 'object') {
    const r = raw as Record<string, unknown>;
    return {
      colorAssist: r.colorAssist === true,
      // Absent in settings saved before this key existed: fall back to ON.
      homeTilt: r.homeTilt !== false,
    };
  }
  return { ...DEFAULT_SETTINGS };
}

export async function loadSettings(): Promise<Settings> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...DEFAULT_SETTINGS };
    return sanitize(JSON.parse(stored));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function writeSettings(next: Settings): Promise<Settings> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Non-fatal: preference simply won't persist this session.
  }
  return next;
}
