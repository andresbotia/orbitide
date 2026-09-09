import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

/**
 * True only while the screen is focused AND the app is foregrounded. Home's
 * ambient motion subscribes to this so it pauses on navigation away and on
 * backgrounding (performance + battery), and resumes cleanly on return.
 */
export function useAmbientActive(): boolean {
  const [active, setActive] = useState(true);
  const focused = useRef(true);
  const foreground = useRef(AppState.currentState === 'active');

  const sync = useCallback(() => {
    setActive(focused.current && foreground.current);
  }, []);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      sync();
      const sub = AppState.addEventListener('change', (next) => {
        foreground.current = next === 'active';
        sync();
      });
      return () => {
        focused.current = false;
        sync();
        sub.remove();
      };
    }, [sync]),
  );

  return active;
}
