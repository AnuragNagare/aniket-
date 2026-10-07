import * as Location from 'expo-location';
import { currentFix, requestPermission } from '../src/location/location';

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
}));
jest.mock('expo-battery', () => ({ getBatteryLevelAsync: jest.fn(async () => 0.64) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '6f1c2b1e-3a51-4d5e-9b7a-1c2d3e4f5a6b' }));

const L = Location as jest.Mocked<typeof Location>;
const granted = { granted: true, status: 'granted', canAskAgain: true } as never;
const position = {
  coords: { latitude: 19.07, longitude: 72.87, accuracy: 12 },
  timestamp: Date.parse('2026-10-05T03:30:00Z'),
} as never;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('location', () => {
  it('reports a blocked permission so the app can send people to Settings', async () => {
    L.requestForegroundPermissionsAsync.mockResolvedValue({
      granted: false,
      status: 'denied',
      canAskAgain: false,
    } as never);
    await expect(requestPermission()).resolves.toBe('blocked');
  });

  it('returns a full fix with a client point id and battery level', async () => {
    L.getForegroundPermissionsAsync.mockResolvedValue(granted);
    L.hasServicesEnabledAsync.mockResolvedValue(true);
    L.getCurrentPositionAsync.mockResolvedValue(position);
    await expect(currentFix()).resolves.toEqual({
      ok: true,
      fix: {
        clientPointId: '6f1c2b1e-3a51-4d5e-9b7a-1c2d3e4f5a6b',
        latitude: 19.07,
        longitude: 72.87,
        accuracyMeters: 12,
        capturedAt: '2026-10-05T03:30:00.000Z',
        batteryLevel: 0.64,
      },
    });
  });

  it('says when GPS is switched off', async () => {
    L.getForegroundPermissionsAsync.mockResolvedValue(granted);
    L.hasServicesEnabledAsync.mockResolvedValue(false);
    await expect(currentFix()).resolves.toEqual({ ok: false, reason: 'SERVICES_OFF' });
  });

  it('falls back to a recent last-known position, then gives up after the timeout', async () => {
    L.getForegroundPermissionsAsync.mockResolvedValue(granted);
    L.hasServicesEnabledAsync.mockResolvedValue(true);
    L.getCurrentPositionAsync.mockReturnValue(new Promise(() => undefined) as never);
    L.getLastKnownPositionAsync.mockResolvedValueOnce(position).mockResolvedValueOnce(null as never);
    await expect(currentFix(20)).resolves.toMatchObject({ ok: true });
    await expect(currentFix(20)).resolves.toEqual({ ok: false, reason: 'NO_FIX' });
  });

  it('needs permission before reading location', async () => {
    L.getForegroundPermissionsAsync.mockResolvedValue({
      granted: false,
      status: 'undetermined',
      canAskAgain: true,
    } as never);
    await expect(currentFix()).resolves.toEqual({ ok: false, reason: 'PERMISSION' });
    expect(L.getCurrentPositionAsync).not.toHaveBeenCalled();
  });
});
