import * as Battery from 'expo-battery';
import { randomUUID } from 'expo-crypto';
import * as Location from 'expo-location';
import type { LocationFix } from '@worktrail/types';

export type PermissionState = 'granted' | 'undetermined' | 'denied' | 'blocked';
export type FixResult =
  | { ok: true; fix: LocationFix }
  | { ok: false; reason: 'PERMISSION' | 'SERVICES_OFF' | 'NO_FIX' };

const LAST_KNOWN_MAX_AGE_MS = 2 * 60_000;

const toState = (p: Location.LocationPermissionResponse): PermissionState => {
  if (p.granted) return 'granted';
  if (p.status === 'undetermined') return 'undetermined';
  return p.canAskAgain ? 'denied' : 'blocked';
};

export const getPermission = async () => toState(await Location.getForegroundPermissionsAsync());
export const requestPermission = async () =>
  toState(await Location.requestForegroundPermissionsAsync());

export const getBackgroundPermission = async () => toState(await Location.getBackgroundPermissionsAsync());
/** On Android 11+ this opens the system page where the person picks "Allow all the time". */
export const requestBackgroundPermission = async () => toState(await Location.requestBackgroundPermissionsAsync());

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/** One location reading for Start/End work. Never throws; explains why when there's no fix. */
export async function currentFix(timeoutMs = 10_000): Promise<FixResult> {
  if ((await getPermission()) !== 'granted') return { ok: false, reason: 'PERMISSION' };
  if (!(await Location.hasServicesEnabledAsync())) return { ok: false, reason: 'SERVICES_OFF' };

  let position: Location.LocationObject | null = null;
  try {
    const currentPromise = Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    if (currentPromise && typeof currentPromise.then === 'function') {
      position = await withTimeout(currentPromise, timeoutMs);
    }
  } catch {
    position = null;
  }

  if (!position) {
    try {
      const lastPromise = Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS });
      if (lastPromise && typeof lastPromise.then === 'function') {
        position = await lastPromise;
      }
    } catch {
      position = null;
    }
  }

  if (!position) return { ok: false, reason: 'NO_FIX' };

  let battery = -1;
  try {
    const batteryPromise = Battery.getBatteryLevelAsync();
    if (batteryPromise && typeof batteryPromise.then === 'function') {
      battery = await batteryPromise;
    }
  } catch {
    battery = -1;
  }

  return {
    ok: true,
    fix: {
      clientPointId: randomUUID(),
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracyMeters: position.coords.accuracy ?? null,
      capturedAt: new Date(position.timestamp).toISOString(),
      batteryLevel: battery >= 0 ? battery : null,
    },
  };
}
