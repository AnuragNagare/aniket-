import { Injectable } from '@nestjs/common';
import type { DateRange, LocationTrailResponse, TrailPoint } from '@worktrail/types';
import { distanceKm, findGaps } from '../../../common/utils/trail.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { overlapping, periodBounds } from './activity.service.js';
import { EmployeeAccessService } from './employee-access.service.js';

export const TRAIL_POINT_LIMIT = 5000;
const num = (v: { toNumber(): number } | null) => (v == null ? null : v.toNumber());

@Injectable()
export class TrailService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EmployeeAccessService,
  ) {}

  async trail(companyId: string, employeeId: string, range: DateRange): Promise<LocationTrailResponse> {
    const employee = await this.access.find(companyId, employeeId);
    const { start, end } = periodBounds(range, employee.company.timezone);
    const now = new Date();

    const [sessions, rows] = await Promise.all([
      this.prisma.workSession.findMany({ where: { employeeId: employee.id, ...overlapping(start, end) }, orderBy: { startedAtServer: 'asc' } }),
      this.prisma.locationPoint.findMany({
        where: { employeeId: employee.id, capturedAt: { gte: start, lt: end } },
        orderBy: { capturedAt: 'asc' },
        take: TRAIL_POINT_LIMIT + 1,
      }),
    ]);
    const truncated = rows.length > TRAIL_POINT_LIMIT;
    const kept = rows.slice(0, TRAIL_POINT_LIMIT);

    const points: TrailPoint[] = kept.map((p) => ({
      id: p.id,
      sessionId: p.sessionId,
      latitude: p.latitude.toNumber(),
      longitude: p.longitude.toNumber(),
      accuracyMeters: num(p.accuracyMeters),
      speedMps: num(p.speedMps),
      capturedAt: p.capturedAt.toISOString(),
      source: p.source,
      qualityFlag: p.qualityFlag,
    }));
    const clip = (d: Date) => new Date(Math.min(Math.max(d.getTime(), start.getTime()), end.getTime(), now.getTime()));
    const gaps = findGaps(
      sessions.map((s) => ({ id: s.id, start: clip(s.startedAtServer), end: clip(s.endedAtServer ?? now) })),
      kept.map((p) => ({ sessionId: p.sessionId, capturedAt: p.capturedAt })),
    );

    return {
      timezone: employee.company.timezone,
      sessions: sessions.map((s) => ({ id: s.id, status: s.status, startedAt: s.startedAtServer.toISOString(), endedAt: s.endedAtServer?.toISOString() ?? null })),
      points,
      gaps,
      stats: {
        pointCount: points.length,
        lowAccuracyCount: points.filter((p) => p.qualityFlag === 'LOW_ACCURACY' || p.qualityFlag === 'SUSPICIOUS').length,
        gapCount: gaps.length,
        distanceKm: distanceKm(points.map((p) => ({ ...p, capturedAt: new Date(p.capturedAt) }))),
      },
      truncated,
    };
  }
}
