import * as Location from 'expo-location';
import { setOutboxForTests } from '../src/tracking/store';
import { getTrackingStatus, reconcileTracking, startTracking, stopTracking } from '../src/tracking/tracking';
import { TASK_NAME } from '../src/tracking/constants';
import * as uploader from '../src/tracking/uploader';
import { MemoryOutbox } from './fakes/memory-outbox';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getBackgroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
  hasStartedLocationUpdatesAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
}));
const L = Location as jest.Mocked<typeof Location>;
const perm = (granted: boolean) =>
  ({ granted, status: granted ? 'granted' : 'denied', canAskAgain: true }) as never;

let box: MemoryOutbox;
beforeEach(() => {
  jest.clearAllMocks();
  box = new MemoryOutbox();
  setOutboxForTests(box);
  jest.spyOn(uploader, 'syncNow').mockResolvedValue();
  L.hasStartedLocationUpdatesAsync.mockResolvedValue(false);
  L.startLocationUpdatesAsync.mockResolvedValue();
  L.stopLocationUpdatesAsync.mockResolvedValue();
});

describe('tracking', () => {
  it('starts 5-minute background updates with a notification when allowed', async () => {
    L.getBackgroundPermissionsAsync.mockResolvedValue(perm(true));
    await expect(startTracking('s1')).resolves.toBe('background');
    expect(L.startLocationUpdatesAsync).toHaveBeenCalledWith(
      TASK_NAME,
      expect.objectContaining({
        timeInterval: 300_000,
        foregroundService: expect.objectContaining({
          notificationTitle: expect.stringContaining('at work'),
          killServiceOnDestroy: false,
        }),
      }),
    );
    expect(await box.getMeta('trackingSessionId')).toBe('s1');
  });

  it('falls back to start/end only when "Allow all the time" was refused', async () => {
    L.getBackgroundPermissionsAsync.mockResolvedValue(perm(false));
    await expect(startTracking('s1')).resolves.toBe('startEndOnly');
    expect(L.startLocationUpdatesAsync).not.toHaveBeenCalled();
    expect(await getTrackingStatus()).toMatchObject({ mode: 'startEndOnly' });
  });

  it('stop ends updates, forgets the session and uploads what is left', async () => {
    await box.setMeta('trackingSessionId', 's1');
    L.hasStartedLocationUpdatesAsync.mockResolvedValue(true);
    await stopTracking();
    expect(L.stopLocationUpdatesAsync).toHaveBeenCalledWith(TASK_NAME);
    expect(await box.getMeta('trackingSessionId')).toBeNull();
    expect(uploader.syncNow).toHaveBeenCalled();
  });

  it('reconcile restarts tracking after the phone killed the app mid-shift', async () => {
    L.getBackgroundPermissionsAsync.mockResolvedValue(perm(true));
    await reconcileTracking('s1');
    expect(L.startLocationUpdatesAsync).toHaveBeenCalled();
  });

  it('reconcile stops tracking that outlived its session', async () => {
    await box.setMeta('trackingSessionId', 'old');
    L.hasStartedLocationUpdatesAsync.mockResolvedValue(true);
    await reconcileTracking(null);
    expect(L.stopLocationUpdatesAsync).toHaveBeenCalled();
  });

  it('status reports pending points and the last send time', async () => {
    await box.setMeta('trackingSessionId', 's1');
    await box.setMeta('lastSentAt', '2026-10-06T04:54:00.000Z');
    L.hasStartedLocationUpdatesAsync.mockResolvedValue(true);
    await box.insert([
      {
        clientPointId: 'a',
        sessionId: 's1',
        payload: { clientPointId: 'a', latitude: 1, longitude: 1, capturedAt: '2026-10-06T05:00:00Z' },
        attempts: 1,
        nextAttemptAt: 0,
      },
    ]);
    expect(await getTrackingStatus()).toEqual({
      mode: 'background',
      pending: 1,
      lastSentAt: '2026-10-06T04:54:00.000Z',
      pendingEnd: false,
    });
  });
});
