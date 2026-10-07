import { describe, expect, it } from 'vitest';
import { haversineKm } from '../../src/common/utils/geo.js';
import { distanceKm, findGaps } from '../../src/common/utils/trail.js';

const t = (hhmm: string) => new Date(`2026-10-06T${hhmm}:00Z`);
const p = (sessionId: string, hhmm: string, latitude = 19.07, longitude = 72.87, qualityFlag = 'GOOD') =>
  ({ sessionId, capturedAt: t(hhmm), latitude, longitude, qualityFlag });

describe('geo', () => {
  it('measures Mumbai CST to Bandra as roughly 12 km', () => {
    expect(haversineKm({ latitude: 18.94, longitude: 72.835 }, { latitude: 19.054, longitude: 72.84 })).toBeCloseTo(12.7, 0);
  });
});

describe('findGaps', () => {
  const session = { id: 's1', start: t('04:00'), end: t('06:00') };

  it('reports silences longer than 15 minutes, including at the edges', () => {
    const gaps = findGaps([session], [p('s1', '04:05'), p('s1', '04:10'), p('s1', '04:52'), p('s1', '05:40')]);
    expect(gaps.map((g) => [g.from.slice(11, 16), g.to.slice(11, 16), g.minutes])).toEqual([
      ['04:10', '04:52', 42],
      ['04:52', '05:40', 48],
      ['05:40', '06:00', 20],
    ]);
  });

  it('treats a session with no points as one gap', () => {
    expect(findGaps([session], [])).toEqual([{ sessionId: 's1', from: t('04:00').toISOString(), to: t('06:00').toISOString(), minutes: 120 }]);
  });

  it('ignores short silences and other sessions’ points', () => {
    const gaps = findGaps([{ id: 's1', start: t('04:00'), end: t('04:20') }], [p('s1', '04:05'), p('s1', '04:18'), p('s2', '04:10')]);
    expect(gaps).toEqual([]);
  });
});

describe('distanceKm', () => {
  it('adds up GOOD points within a session', () => {
    expect(distanceKm([p('s1', '04:00', 18.94, 72.835), p('s1', '04:30', 19.054, 72.84)])).toBeCloseTo(12.7, 0);
  });

  it('skips approximate points, session boundaries and impossible jumps', () => {
    const km = distanceKm([
      p('s1', '04:00', 19.0, 72.8),
      p('s1', '04:05', 19.5, 72.8, 'LOW_ACCURACY'),
      p('s1', '04:10', 19.001, 72.8),
      p('s1', '04:15', 21.0, 72.8), // ~220 km in 5 min: GPS glitch
      p('s2', '05:00', 19.2, 72.8),
    ]);
    expect(km).toBeCloseTo(0.1, 1);
  });
});
