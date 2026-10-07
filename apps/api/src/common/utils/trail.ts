import type { TrailGap } from '@worktrail/types';
import { haversineKm, type LatLng } from './geo.js';

/** A silence longer than three missed 5-minute targets counts as a gap. */
export const GAP_MS = 15 * 60_000;
/** Faster than this between two points is treated as a GPS glitch, not travel. */
export const MAX_PLAUSIBLE_KMH = 150;

type GapSession = { id: string; start: Date; end: Date };
type GapPoint = { sessionId: string; capturedAt: Date };
type DistPoint = GapPoint & LatLng & { qualityFlag: string };

export function findGaps(sessions: GapSession[], points: GapPoint[]): TrailGap[] {
  const gaps: TrailGap[] = [];
  for (const s of sessions) {
    const times = points
      .filter((p) => p.sessionId === s.id)
      .map((p) => p.capturedAt.getTime())
      .filter((ms) => ms >= s.start.getTime() && ms <= s.end.getTime())
      .sort((a, b) => a - b);
    const marks = [s.start.getTime(), ...times, s.end.getTime()];
    for (let i = 1; i < marks.length; i++) {
      const from = marks[i - 1]!;
      const to = marks[i]!;
      if (to - from > GAP_MS) {
        gaps.push({ sessionId: s.id, from: new Date(from).toISOString(), to: new Date(to).toISOString(), minutes: Math.round((to - from) / 60_000) });
      }
    }
  }
  return gaps;
}

export function distanceKm(points: DistPoint[]): number {
  const good = points
    .filter((p) => p.qualityFlag === 'GOOD')
    .sort((a, b) => a.sessionId.localeCompare(b.sessionId) || a.capturedAt.getTime() - b.capturedAt.getTime());
  let km = 0;
  for (let i = 1; i < good.length; i++) {
    const a = good[i - 1]!;
    const b = good[i]!;
    if (a.sessionId !== b.sessionId) continue;
    const step = haversineKm(a, b);
    const hours = (b.capturedAt.getTime() - a.capturedAt.getTime()) / 3_600_000;
    if (hours > 0 && step / hours > MAX_PLAUSIBLE_KMH) continue;
    km += step;
  }
  return Math.round(km * 10) / 10;
}
