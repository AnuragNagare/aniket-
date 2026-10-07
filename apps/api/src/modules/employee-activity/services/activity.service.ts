import { Injectable } from '@nestjs/common';
import type { Prisma, WorkSession } from '@prisma/client';
import {
  type AdminSessionDto,
  type DateRange,
  type EmployeeSessionsResponse,
  type EmployeeSummary,
  type EmployeeUpdatesQuery,
  type EmployeeUpdatesResponse,
  LEFT_RUNNING_AFTER_MS,
} from '@worktrail/types';
import { dayBounds, minutesWithin, shiftDate } from '../../../common/utils/time.js';
import { distanceKm } from '../../../common/utils/trail.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { toUpdateDto } from '../../updates/services/updates.service.js';
import { EmployeeAccessService } from './employee-access.service.js';

export function periodBounds(range: DateRange, tz: string) {
  const dates: string[] = [];
  for (let d = range.from; d <= range.to; d = shiftDate(d, 1)) dates.push(d);
  return { start: dayBounds(range.from, tz).start, end: dayBounds(range.to, tz).end, dates };
}

export const isLeftRunning = (s: Pick<WorkSession, 'status' | 'startedAtServer'>, now: Date) =>
  s.status === 'ACTIVE' && now.getTime() - s.startedAtServer.getTime() >= LEFT_RUNNING_AFTER_MS;

export function toAdminSession(s: WorkSession, pointCount: number, lastLocationAt: Date | null, now: Date): AdminSessionDto {
  return {
    id: s.id,
    status: s.status,
    startedAt: s.startedAtServer.toISOString(),
    endedAt: s.endedAtServer?.toISOString() ?? null,
    totalMinutes: s.totalMinutes,
    lastLocationAt: lastLocationAt?.toISOString() ?? null,
    pointCount,
    leftRunning: isLeftRunning(s, now),
  };
}

/** Sessions overlapping [start, end). */
export const overlapping = (start: Date, end: Date): Prisma.WorkSessionWhereInput => ({
  startedAtServer: { lt: end },
  OR: [{ endedAtServer: null }, { endedAtServer: { gt: start } }],
});

@Injectable()
export class ActivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EmployeeAccessService,
  ) {}

  async sessions(companyId: string, employeeId: string, range: DateRange): Promise<EmployeeSessionsResponse> {
    const employee = await this.access.find(companyId, employeeId);
    const tz = employee.company.timezone;
    const { start, end, dates } = periodBounds(range, tz);
    const now = new Date();
    const sessions = await this.prisma.workSession.findMany({
      where: { employeeId: employee.id, ...overlapping(start, end) },
      orderBy: { startedAtServer: 'desc' },
    });
    const stats = await this.prisma.locationPoint.groupBy({
      by: ['sessionId'],
      where: { sessionId: { in: sessions.map((s) => s.id) } },
      _count: { _all: true },
      _max: { capturedAt: true },
    });
    const bySession = new Map(stats.map((s) => [s.sessionId, s]));
    const spans = sessions.map((s) => ({ start: s.startedAtServer, end: s.endedAtServer }));
    const days = dates.map((date) => {
      const b = dayBounds(date, tz);
      return { date, minutes: minutesWithin(spans, b.start, b.end, now) };
    });
    return {
      timezone: tz,
      sessions: sessions.map((s) =>
        toAdminSession(s, bySession.get(s.id)?._count._all ?? 0, bySession.get(s.id)?._max.capturedAt ?? null, now),
      ),
      days,
      totalMinutes: days.reduce((sum, d) => sum + d.minutes, 0),
    };
  }

  async summary(companyId: string, employeeId: string, range: DateRange): Promise<EmployeeSummary> {
    const employee = await this.access.find(companyId, employeeId);
    const { start, end } = periodBounds(range, employee.company.timezone);
    const [sessions, updateCount, points, last] = await Promise.all([
      this.sessions(companyId, employeeId, range),
      this.prisma.workUpdate.count({ where: { employeeId: employee.id, submittedAt: { gte: start, lt: end } } }),
      this.prisma.locationPoint.findMany({
        where: { employeeId: employee.id, capturedAt: { gte: start, lt: end } },
        select: { sessionId: true, capturedAt: true, latitude: true, longitude: true, qualityFlag: true },
      }),
      this.prisma.locationPoint.findFirst({ where: { employeeId: employee.id }, orderBy: { capturedAt: 'desc' }, select: { capturedAt: true } }),
    ]);
    return {
      from: range.from,
      to: range.to,
      totalMinutes: sessions.totalMinutes,
      daysWorked: sessions.days.filter((d) => d.minutes > 0).length,
      updateCount,
      pointCount: points.length,
      distanceKm: distanceKm(points.map((p) => ({ ...p, latitude: Number(p.latitude), longitude: Number(p.longitude) }))),
      lastSeenAt: last?.capturedAt.toISOString() ?? null,
      leftRunning: sessions.sessions.some((s) => s.leftRunning),
    };
  }

  async updates(companyId: string, employeeId: string, q: EmployeeUpdatesQuery): Promise<EmployeeUpdatesResponse> {
    const employee = await this.access.find(companyId, employeeId);
    const { start, end } = periodBounds(q, employee.company.timezone);
    const where: Prisma.WorkUpdateWhereInput = {
      employeeId: employee.id,
      submittedAt: { gte: start, lt: end },
      ...(q.category ? { category: q.category } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.workUpdate.findMany({ where, orderBy: { submittedAt: 'desc' }, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
      this.prisma.workUpdate.count({ where }),
    ]);
    return { items: rows.map(toUpdateDto), page: q.page, pageSize: q.pageSize, total };
  }
}
