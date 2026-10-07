import { setOutboxForTests } from '../src/tracking/store';
import { handleLocations, toPoint } from '../src/tracking/background-task';
import * as uploader from '../src/tracking/uploader';
import { MemoryOutbox } from './fakes/memory-outbox';

jest.mock('expo-location', () => ({ Accuracy: { Balanced: 3 } }));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => '11111111-1111-4111-8111-111111111111') }));

const loc = (speed: number, heading: number) => ({
  coords: { latitude: 19.07, longitude: 72.87, accuracy: 22, speed, heading, altitude: 0, altitudeAccuracy: 0 },
  timestamp: Date.parse('2026-10-06T04:05:00Z'),
});

describe('background task', () => {
  let box: MemoryOutbox;
  beforeEach(() => {
    box = new MemoryOutbox();
    setOutboxForTests(box);
    jest.spyOn(uploader, 'syncNow').mockResolvedValue();
  });

  it('turns a location into a BACKGROUND point, dropping unknown (-1) speed and heading', () => {
    expect(toPoint(loc(-1, -1) as never, () => 'id-1')).toEqual({
      clientPointId: 'id-1',
      latitude: 19.07,
      longitude: 72.87,
      accuracyMeters: 22,
      speedMps: null,
      bearing: null,
      capturedAt: '2026-10-06T04:05:00.000Z',
      source: 'BACKGROUND',
    });
  });

  it('queues points for the active session and starts an upload', async () => {
    await box.setMeta('trackingSessionId', 's1');
    await handleLocations([loc(1.2, 90) as never]);
    expect(await box.count()).toBe(1);
    expect([...box.rows.values()][0]).toMatchObject({
      sessionId: 's1',
      payload: { speedMps: 1.2, bearing: 90 },
    });
    expect(uploader.syncNow).toHaveBeenCalled();
  });

  it('ignores locations when no work session is running', async () => {
    await handleLocations([loc(1, 1) as never]);
    expect(await box.count()).toBe(0);
  });
});
