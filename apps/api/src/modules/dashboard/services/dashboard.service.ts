import { Injectable } from '@nestjs/common';
import type { DashboardResponse, UpdateCategory } from '@worktrail/types';
import { AppError } from '../../../common/errors/app-error.js';
import {
  dayBounds,
  isIsoDate,
  minutesWithin,
  previousDay,
  todayIn,
} from '../../../common/utils/time.js';
import { PrismaService } from '../../../database/prisma.service.js';

const RECENT_UPDATES_LIMIT = 8;

/** Builds the admin dashboard for one calendar day in the company's timezone. */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async get(companyId: string, dateParam?: string): Promise<DashboardResponse> {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    const tz = company.timezone;
    const date = dateParam ?? todayIn(tz);
    if (!isIsoDate(date)) {
      throw new AppError(400, 'INVALID_DATE', 'Use a date in the format YYYY-MM-DD.');
    }

    const now = new Date();
    const day = dayBounds(date, tz);
    const yesterday = dayBounds(previousDay(date), tz);

    const [employees, sessions, updatesToday, updatesYesterday, recent, lastPoints] =
      await Promise.all([
        this.prisma.employee.findMany({
          where: { companyId },
          select: {
            id: true,
            name: true,
            designation: true,
            sessions: { where: { status: 'ACTIVE' }, select: { id: true }, take: 1 },
          },
          orderBy: { name: 'asc' },
        }),
        // Every session that overlaps yesterday or the selected day.
        this.prisma.workSession.findMany({
          where: {
            companyId,
            startedAtServer: { lt: day.end },
            OR: [{ endedAtServer: null }, { endedAtServer: { gt: yesterday.start } }],
          },
          select: { employeeId: true, startedAtServer: true, endedAtServer: true },
        }),
        this.prisma.workUpdate.count({
          where: { companyId, submittedAt: { gte: day.start, lt: day.end } },
        }),
        this.prisma.workUpdate.count({
          where: { companyId, submittedAt: { gte: yesterday.start, lt: yesterday.end } },
        }),
        this.prisma.workUpdate.findMany({
          where: { companyId, submittedAt: { gte: day.start, lt: day.end } },
          orderBy: { submittedAt: 'desc' },
          take: RECENT_UPDATES_LIMIT,
          select: {
            id: true,
            employeeId: true,
            text: true,
            submittedAt: true,
            category: true,
            inputMethod: true,
            employee: { select: { name: true } },
          },
        }),
        // Latest point per employee captured before the end of the selected day.
        this.prisma.locationPoint.findMany({
          where: { companyId, capturedAt: { lt: day.end } },
          orderBy: [{ employeeId: 'asc' }, { capturedAt: 'desc' }],
          distinct: ['employeeId'],
          select: { employeeId: true, latitude: true, longitude: true, capturedAt: true },
        }),
      ]);

    const minutesFor = (employeeId: string, bounds: { start: Date; end: Date }) =>
      minutesWithin(
        sessions
          .filter((s) => s.employeeId === employeeId)
          .map((s) => ({ start: s.startedAtServer, end: s.endedAtServer })),
        bounds.start,
        bounds.end,
        now,
      );
    const pointByEmployee = new Map(lastPoints.map((p) => [p.employeeId, p]));

    const workHours = employees
      .map((e) => ({ employeeId: e.id, name: e.name, minutes: minutesFor(e.id, day) }))
      .filter((w) => w.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes);

    return {
      date,
      timezone: tz,
      kpis: {
        totalEmployees: employees.length,
        workingNow: employees.filter((e) => e.sessions.length > 0).length,
        checkedInToday: workHours.length,
        workMinutesToday: workHours.reduce((sum, w) => sum + w.minutes, 0),
        workMinutesYesterday: employees.reduce((sum, e) => sum + minutesFor(e.id, yesterday), 0),
        updatesToday,
        updatesYesterday,
      },
      locations: employees.map((e) => {
        const p = pointByEmployee.get(e.id);
        return {
          employeeId: e.id,
          name: e.name,
          designation: e.designation,
          status: e.sessions.length ? ('WORKING' as const) : ('OFF_DUTY' as const),
          lastPoint: p
            ? {
                latitude: Number(p.latitude),
                longitude: Number(p.longitude),
                capturedAt: p.capturedAt.toISOString(),
              }
            : null,
        };
      }),
      recentUpdates: recent.map((u) => ({
        id: u.id,
        employeeId: u.employeeId,
        employeeName: u.employee.name,
        text: u.text,
        submittedAt: u.submittedAt.toISOString(),
        category: (u.category as UpdateCategory | null) ?? null,
        inputMethod: u.inputMethod,
        summary: (u as { aiSummary?: string | null }).aiSummary ?? null,
      })),
      workHours,
    };
  }
}
