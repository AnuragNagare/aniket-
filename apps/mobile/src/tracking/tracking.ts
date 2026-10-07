import * as Location from 'expo-location';
import { getBackgroundPermission } from '../location/location';
import { TASK_NAME, TRACKING_OPTIONS } from './constants';
import { getOutbox } from './store';
import { syncNow } from './uploader';

export type TrackingMode = 'background' | 'startEndOnly';
export type TrackingStatus = {
  mode: TrackingMode | 'off';
  pending: number;
  lastSentAt: string | null;
  pendingEnd: boolean;
};

const isRunning = async () =>
  (await Promise.resolve(Location.hasStartedLocationUpdatesAsync(TASK_NAME)).catch(() => false)) ?? false;

/** Begins 5-minute background updates for a session the server has confirmed. */
export async function startTracking(sessionId: string): Promise<TrackingMode> {
  await (await getOutbox()).setMeta('trackingSessionId', sessionId);
  if ((await getBackgroundPermission()) !== 'granted') return 'startEndOnly';
  if (await isRunning()) return 'background';
  try {
    await Promise.resolve(Location.startLocationUpdatesAsync(TASK_NAME, TRACKING_OPTIONS));
    return 'background';
  } catch {
    return 'startEndOnly';
  }
}

/** Stops recording immediately (before End work is even sent) and uploads what is queued. */
export async function stopTracking(): Promise<void> {
  if (await isRunning()) {
    await Promise.resolve(Location.stopLocationUpdatesAsync(TASK_NAME)).catch(() => undefined);
  }
  await (await getOutbox()).setMeta('trackingSessionId', null);
  void syncNow().catch(() => undefined);
}

/** Makes the phone match the server: track exactly while a session is running. */
export async function reconcileTracking(activeSessionId: string | null): Promise<void> {
  if (activeSessionId) await startTracking(activeSessionId);
  else if ((await isRunning()) || (await (await getOutbox()).getMeta('trackingSessionId'))) await stopTracking();
}

export async function getTrackingStatus(): Promise<TrackingStatus> {
  const box = await getOutbox();
  const sessionId = await box.getMeta('trackingSessionId');
  return {
    mode: !sessionId ? 'off' : (await isRunning()) ? 'background' : 'startEndOnly',
    pending: await box.count(),
    lastSentAt: await box.getMeta('lastSentAt'),
    pendingEnd: Boolean(await box.getMeta('pendingEnd')),
  };
}
