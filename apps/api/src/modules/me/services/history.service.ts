import { Injectable } from '@nestjs/common';
import type { HistoryQuery, HistoryResponse } from '@worktrail/types';
import { dayBounds } from '../../../common/utils/time.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { CurrentEmployeeService } from '../../sessions/services/current-employee.service.js';
import { toUpdateDto } from '../../updates/services/updates.service.js';

/** The signed-in employee's own sessions and updates for a date range (company timezone). */
@Injectable()
export class HistoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentEmployee: CurrentEmployeeService,
  ) {}

  async get(auth: AuthContext, q: HistoryQuery): Promise<HistoryResponse> {
    const employee = await this.currentEmployee.forAuth(auth);
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: employee.companyId } });
    const start = dayBounds(q.from, company.timezone).start;
    const end = dayBounds(q.to, company.timezone).end;

    const [sessions, updates] = await Promise.all([
      this.prisma.workSession.findMany({
        where: {
          employeeId: employee.id,
          startedAtServer: { lt: end },
          OR: [{ endedAtServer: null }, { endedAtServer: { gt: start } }],
        },
        orderBy: { startedAtServer: 'desc' },
      }),
      this.prisma.workUpdate.findMany({
        where: { employeeId: employee.id, submittedAt: { gte: start, lt: end } },
        orderBy: { submittedAt: 'desc' },
      }),
    ]);

    return {
      timezone: company.timezone,
      sessions: sessions.map((s) => ({
        id: s.id,
        status: s.status,
        startedAt: s.startedAtServer.toISOString(),
        endedAt: s.endedAtServer?.toISOString() ?? null,
        totalMinutes: s.totalMinutes,
        lastLocationAt: null,
      })),
      updates: updates.map(toUpdateDto),
    };
  }
}
