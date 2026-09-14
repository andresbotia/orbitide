import { useEffect } from 'react';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { DeviceMotion } from 'expo-sensors';

/** Tilt honoured either side of the neutral pose, in radians. */
const CLAMP_RAD = 0.3;
const UPDATE_MS = 32;
/** Per-sample smoothing toward the raw reading; removes sensor jitter. */
const SMOOTHING = 0.25;
/** Per-sample drift of the neutral pose toward however the phone is held. */
const RECENTER = 0.02;

type DeviceMotionModule = typeof DeviceMotion;

/**
 * Loaded lazily: expo-sensors is a native module, and a dev client built before
 * it was added throws at import time. That case is treated exactly like missing
 * hardware — the scene simply doesn't tilt.
 */
function loadDeviceMotion(): DeviceMotionModule | null {
  try {
    return (require('expo-sensors') as { DeviceMotion: DeviceMotionModule }).DeviceMotion;
  } catch {
    return null;
  }
}

const clampUnit = (v: number) => Math.max(-1, Math.min(1, v));

export interface DeviceTilt {
  /** Left/right tilt (gamma), in [-1, 1] at the ±0.3 rad clamp. */
  x: SharedValue<number>;
  /** Forward/back tilt (beta), in [-1, 1] at the ±0.3 rad clamp. */
  y: SharedValue<number>;
}

/**
 * Device tilt as two shared values, measured from a slowly re-centring neutral
 * pose so the scene rests level however the phone is held. Both stay at 0 when
 * disabled, when the sensor reports unavailable, or when the native module is
 * missing.
 */
export function useDeviceTilt(enabled: boolean): DeviceTilt {
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  useEffect(() => {
    x.set(0);
    y.set(0);
    if (!enabled) return;
    const motion = loadDeviceMotion();
    if (!motion) return;

    let alive = true;
    let subscription: { remove: () => void } | null = null;
    let baseBeta: number | null = null;
    let baseGamma = 0;
    let smoothX = 0;
    let smoothY = 0;

    motion
      .isAvailableAsync()
      .then((available) => {
        if (!alive || !available) return;
        motion.setUpdateInterval(UPDATE_MS);
        subscription = motion.addListener(({ rotation }) => {
          if (!rotation) return;
          const { beta, gamma } = rotation;
          if (baseBeta === null) {
            baseBeta = beta;
            baseGamma = gamma;
          }
          baseBeta += (beta - baseBeta) * RECENTER;
          baseGamma += (gamma - baseGamma) * RECENTER;
          smoothX += (clampUnit((gamma - baseGamma) / CLAMP_RAD) - smoothX) * SMOOTHING;
          smoothY += (clampUnit((beta - baseBeta) / CLAMP_RAD) - smoothY) * SMOOTHING;
          x.set(smoothX);
          y.set(smoothY);
        });
      })
      .catch(() => {
        // Availability check failed: behave as if there is no sensor.
      });

    return () => {
      alive = false;
      subscription?.remove();
      x.set(0);
      y.set(0);
    };
  }, [enabled, x, y]);

  return { x, y };
}
