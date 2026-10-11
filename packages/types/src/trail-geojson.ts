import type { LocationTrailResponse, TrailPoint } from './employee-activity.js';

type Line = { type: 'Feature'; properties: { sessionId: string }; geometry: { type: 'LineString'; coordinates: number[][] } };
type Dot = {
  type: 'Feature';
  properties: { id: string; approximate: boolean; capturedAt: string; accuracyMeters: number | null; speedMps: number | null; source: string };
  geometry: { type: 'Point'; coordinates: number[] };
};
export type Marker = { kind: 'start' | 'end'; sessionId: string; latitude: number; longitude: number; time: string };

const coord = (p: TrailPoint) => [p.longitude, p.latitude];
const fc = <T,>(features: T[]) => ({ type: 'FeatureCollection' as const, features });

/** Turns the API trail into MapLibre layers: route lines, gap segments, dots and S/E markers. */
export function trailToGeoJson(trail: LocationTrailResponse) {
  const bySession = new Map<string, TrailPoint[]>();
  for (const p of trail.points) bySession.set(p.sessionId, [...(bySession.get(p.sessionId) ?? []), p]);

  const routes: Line[] = [];
  const markers: Marker[] = [];
  for (const [sessionId, pts] of bySession) {
    const good = pts.filter((p) => p.qualityFlag === 'GOOD');
    if (good.length > 1) routes.push({ type: 'Feature', properties: { sessionId }, geometry: { type: 'LineString', coordinates: good.map(coord) } });
    const first = pts[0]!;
    const last = pts[pts.length - 1]!;
    markers.push({ kind: 'start', sessionId, latitude: first.latitude, longitude: first.longitude, time: first.capturedAt });
    if (last !== first) markers.push({ kind: 'end', sessionId, latitude: last.latitude, longitude: last.longitude, time: last.capturedAt });
  }

  const gaps: Line[] = [];
  for (const g of trail.gaps) {
    const pts = bySession.get(g.sessionId) ?? [];
    const before = [...pts].reverse().find((p) => p.capturedAt <= g.from);
    const after = pts.find((p) => p.capturedAt >= g.to);
    if (before && after && before !== after) {
      gaps.push({ type: 'Feature', properties: { sessionId: g.sessionId }, geometry: { type: 'LineString', coordinates: [coord(before), coord(after)] } });
    }
  }

  const points: Dot[] = trail.points.map((p) => ({
    type: 'Feature',
    properties: { id: p.id, approximate: p.qualityFlag !== 'GOOD', capturedAt: p.capturedAt, accuracyMeters: p.accuracyMeters, speedMps: p.speedMps, source: p.source },
    geometry: { type: 'Point', coordinates: coord(p) },
  }));

  const lngs = trail.points.map((p) => p.longitude);
  const lats = trail.points.map((p) => p.latitude);
  const bounds = trail.points.length
    ? ([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]] as [[number, number], [number, number]])
    : null;

  return { routes: fc(routes), gaps: fc(gaps), points: fc(points), markers, bounds };
}
