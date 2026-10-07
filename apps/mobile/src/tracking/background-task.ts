import { randomUUID } from 'expo-crypto';
import type * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import type { BatchPoint } from '@worktrail/types';
import { TASK_NAME } from './constants';
import { getOutbox } from './store';
import { syncNow } from './uploader';

/** Phones report -1 for "unknown" speed and heading; store those as null. */
const known = (n: number | null | undefined) => (n != null && n >= 0 ? n : null);

export const toPoint = (loc: Location.LocationObject, uuid: () => string = randomUUID): BatchPoint => ({
  clientPointId: uuid(),
  latitude: loc.coords.latitude,
  longitude: loc.coords.longitude,
  accuracyMeters: loc.coords.accuracy ?? null,
  speedMps: known(loc.coords.speed),
  bearing: known(loc.coords.heading),
  capturedAt: new Date(loc.timestamp).toISOString(),
  source: 'BACKGROUND',
});

/** Called by Android with fresh locations, even when the app is closed. */
export async function handleLocations(locations: Location.LocationObject[]) {
  const box = await getOutbox();
  const sessionId = await box.getMeta('trackingSessionId');
  if (!sessionId || locations.length === 0) return; // never record outside a work session
  await box.insert(
    locations.map((loc) => {
      const payload = toPoint(loc);
      return { clientPointId: payload.clientPointId, sessionId, payload, attempts: 0, nextAttemptAt: 0 };
    }),
  );
  await syncNow().catch(() => undefined);
}

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TASK_NAME, async ({ data, error }) => {
  if (error || !data) return;
  await handleLocations(data.locations ?? []).catch(() => undefined);
});
