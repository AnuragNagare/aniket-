import { Injectable } from '@nestjs/common';
import type { DateRange } from '@worktrail/types';
import { periodTypeFor } from '@worktrail/types';
import { formatInTimeZone } from 'date-fns-tz';
import { PrismaService } from '../../../database/prisma.service.js';
import { ActivityService, periodBounds } from '../../employee-activity/services/activity.service.js';
import { EmployeeAccessService } from '../../employee-activity/services/employee-access.service.js';
import { TrailService } from '../../employee-activity/services/trail.service.js';
import { EmployeesService } from '../../employees/services/employees.service.js';
import { PeriodSummaryService } from '../../summaries/services/period-summary.service.js';
import { toUpdateDto } from '../../updates/services/updates.service.js';
import type { ReportData } from '../pdf/report-html.js';

@Injectable()
export class ReportDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeAccess: EmployeeAccessService,
    private readonly employeesService: EmployeesService,
    private readonly activityService: ActivityService,
    private readonly trailService: TrailService,
    private readonly periodSummaryService: PeriodSummaryService,
  ) {}

  async collect(companyId: string, employeeId: string, range: DateRange): Promise<ReportData> {
    const employeeRow = await this.employeeAccess.find(companyId, employeeId);
    const tz = employeeRow.company.timezone;
    const { start, end } = periodBounds(range, tz);

    const [employeeDetail, sessionsRes, trailRes, summary, updateRows] = await Promise.all([
      this.employeesService.get(companyId, employeeId),
      this.activityService.sessions(companyId, employeeId, range),
      this.trailService.trail(companyId, employeeId, range),
      this.periodSummaryService.get(companyId, employeeId, range),
      this.prisma.workUpdate.findMany({
        where: { employeeId, submittedAt: { gte: start, lt: end } },
        orderBy: { submittedAt: 'asc' },
        take: 2000,
      }),
    ]);

    const periodType = periodTypeFor(range.from, range.to);
    const periodLabel =
      periodType === 'DAILY'
        ? formatInTimeZone(start, tz, 'd MMM yyyy')
        : periodType === 'MONTHLY'
          ? formatInTimeZone(start, tz, 'MMMM yyyy')
          : `${formatInTimeZone(start, tz, 'd MMM yyyy')} – ${formatInTimeZone(new Date(end.getTime() - 1), tz, 'd MMM yyyy')}`;

    const daysWorked = sessionsRes.days.filter((d) => d.minutes > 0).length;
    const totals = {
      totalMinutes: sessionsRes.totalMinutes,
      daysWorked,
      sessionCount: sessionsRes.sessions.length,
      updateCount: updateRows.length,
      pointCount: trailRes.stats.pointCount,
      distanceKm: trailRes.stats.distanceKm,
      gapCount: trailRes.stats.gapCount,
    };

    const notes: string[] = summary?.report?.dataNotes ? [...summary.report.dataNotes] : [];

    return {
      company: {
        name: employeeRow.company.name,
        timezone: tz,
      },
      employee: {
        id: employeeDetail.id,
        name: employeeDetail.name,
        email: employeeDetail.email,
        phone: employeeDetail.phone,
        designation: employeeDetail.designation,
        employeeCode: employeeDetail.employeeCode,
      },
      from: range.from,
      to: range.to,
      periodLabel,
      generatedAt: new Date().toISOString(),
      totals,
      sessions: sessionsRes.sessions,
      updates: updateRows.map(toUpdateDto),
      summary,
      notes,
    };
  }
}
