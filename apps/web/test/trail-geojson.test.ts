import { describe, expect, it } from 'vitest';
import type { LocationTrailResponse } from '@worktrail/types';
import { trailToGeoJson } from '@/lib/trail-geojson';

const point = (id: string, sessionId: string, min: number, lat: number, quality: 'GOOD' | 'LOW_ACCURACY' = 'GOOD') => ({
  id,
  sessionId,
  latitude: lat,
  longitude: 72.8,
  accuracyMeters: quality === 'GOOD' ? 15 : 300,
  speedMps: null,
  capturedAt: new Date(Date.UTC(2026, 9, 5, 4, min)).toISOString(),
  source: 'BACKGROUND' as const,
  qualityFlag: quality,
});
const trail = (points: ReturnType<typeof point>[], gaps: LocationTrailResponse['gaps'] = []): LocationTrailResponse => ({
  timezone: 'Asia/Kolkata',
  sessions: [{ id: 's1', status: 'COMPLETED', startedAt: '', endedAt: '' }],
  points,
  gaps,
  stats: { pointCount: points.length, lowAccuracyCount: 0, gapCount: gaps.length, distanceKm: 0 },
  truncated: false,
});

describe('trailToGeoJson', () => {
  it('draws one route line per session from GOOD points, and start/end markers', () => {
    const g = trailToGeoJson(trail([point('a', 's1', 0, 19.0), point('b', 's1', 5, 19.01, 'LOW_ACCURACY'), point('c', 's1', 10, 19.02)]));
    expect(g.routes.features).toHaveLength(1);
    expect(g.routes.features[0]!.geometry.coordinates).toEqual([[72.8, 19.0], [72.8, 19.02]]);
    expect(g.markers.map((m) => [m.kind, m.latitude])).toEqual([['start', 19.0], ['end', 19.02]]);
    expect(g.points.features.map((f) => f.properties.approximate)).toEqual([false, true, false]);
  });

  it('draws gaps as dashed segments between the points around them', () => {
    const g = trailToGeoJson(trail([point('a', 's1', 0, 19.0), point('b', 's1', 50, 19.05)], [
      { sessionId: 's1', from: new Date(Date.UTC(2026, 9, 5, 4, 0)).toISOString(), to: new Date(Date.UTC(2026, 9, 5, 4, 50)).toISOString(), minutes: 50 },
    ]));
    expect(g.gaps.features[0]!.geometry.coordinates).toEqual([[72.8, 19.0], [72.8, 19.05]]);
  });

  it('handles no points and a single point without crashing', () => {
    expect(trailToGeoJson(trail([])).bounds).toBeNull();
    const one = trailToGeoJson(trail([point('a', 's1', 0, 19.0)]));
    expect(one.routes.features).toHaveLength(0);
    expect(one.markers).toHaveLength(1);
    expect(one.bounds).toEqual([[72.8, 19.0], [72.8, 19.0]]);
  });
});
