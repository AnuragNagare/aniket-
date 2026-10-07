import { describe, expect, it } from 'vitest';
import { EndSessionSchema, LocationBatchSchema } from '../src/index.js';

const point = (i: number) => ({
  clientPointId: `6f1c2b1e-3a51-4d5e-9b7a-1c2d3e4f${String(i).padStart(4, '0')}`,
  latitude: 19.07,
  longitude: 72.87,
  accuracyMeters: 20,
  capturedAt: '2026-10-06T04:05:00.000Z',
});
const sessionId = '0e5c1d3a-8f0b-4c4e-9d1e-2a3b4c5d6e7f';

describe('LocationBatchSchema', () => {
  it('defaults the source to BACKGROUND and keeps speed/bearing', () => {
    const out = LocationBatchSchema.parse({ sessionId, points: [{ ...point(1), speedMps: 1.2, bearing: 90 }] });
    expect(out.points[0]).toMatchObject({ source: 'BACKGROUND', speedMps: 1.2, bearing: 90 });
  });

  it('rejects an empty batch and one over 100 points', () => {
    expect(LocationBatchSchema.safeParse({ sessionId, points: [] }).error?.issues[0]?.message).toBe('Send at least one point.');
    const many = Array.from({ length: 101 }, (_, i) => point(i));
    expect(LocationBatchSchema.safeParse({ sessionId, points: many }).error?.issues[0]?.message).toBe('Send at most 100 points at a time.');
  });

  it('rejects negative speed (phones report -1 for unknown)', () => {
    expect(LocationBatchSchema.safeParse({ sessionId, points: [{ ...point(1), speedMps: -1 }] }).success).toBe(false);
  });
});

describe('EndSessionSchema', () => {
  it('accepts an optional endedAt for an end made offline', () => {
    expect(EndSessionSchema.parse({ deviceTime: '2026-10-06T12:00:00.000Z', endedAt: '2026-10-06T11:58:00.000Z' }).endedAt).toBe('2026-10-06T11:58:00.000Z');
  });
});
