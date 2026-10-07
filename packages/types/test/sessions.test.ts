import { describe, expect, it } from 'vitest';
import { EndSessionSchema, LocationFixSchema, StartSessionSchema } from '../src/index.js';

const fix = {
  clientPointId: '6f1c2b1e-3a51-4d5e-9b7a-1c2d3e4f5a6b',
  latitude: 19.076,
  longitude: 72.8777,
  accuracyMeters: 18,
  capturedAt: '2026-10-05T03:30:05.000Z',
  batteryLevel: 0.72,
};

describe('session schemas', () => {
  it('accepts a start with or without a location', () => {
    expect(
      StartSessionSchema.safeParse({
        deviceTime: '2026-10-05T03:30:00.000Z',
        initialLocation: fix,
      }).success,
    ).toBe(true);
    expect(StartSessionSchema.safeParse({ deviceTime: '2026-10-05T03:30:00.000Z' }).success).toBe(
      true,
    );
  });

  it('rejects impossible coordinates with a readable message', () => {
    const r = LocationFixSchema.safeParse({ ...fix, latitude: 95 });
    expect(r.error?.issues[0]?.message).toBe('Latitude must be between -90 and 90.');
  });

  it('requires a uuid client point id so retries can be de-duplicated', () => {
    expect(LocationFixSchema.safeParse({ ...fix, clientPointId: 'abc' }).success).toBe(false);
  });

  it('allows unknown accuracy and battery', () => {
    expect(
      LocationFixSchema.safeParse({ ...fix, accuracyMeters: null, batteryLevel: null }).success,
    ).toBe(true);
  });

  it('EndSessionSchema requires deviceTime', () => {
    expect(EndSessionSchema.safeParse({}).success).toBe(false);
  });
});
