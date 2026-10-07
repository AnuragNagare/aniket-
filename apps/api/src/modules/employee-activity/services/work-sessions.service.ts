import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { LEFT_RUNNING_AFTER_MS, type WorkSessionsQuery, type WorkSessionsResponse } from '@worktrail/types';
import { PrismaService } from '../../../database/prisma.service.js';
import { overlapping, periodBounds, toAdminSession } from './activity.service.js';

@Injectable()
export class WorkSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, q: WorkSessionsQuery): Promise<WorkSessionsResponse> {
    const company = await this.prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    const { start, end } = periodBounds(q, company.timezone);
    const now = new Date();
    const stuckBefore = new Date(now.getTime() - LEFT_RUNNING_AFTER_MS);

    const where: Prisma.WorkSessionWhereInput = { companyId, ...overlapping(start, end) };
    if (q.query) where.employee = { name: { contains: q.query, mode: 'insensitive' } };
    if (q.status === 'ACTIVE') Object.assign(where, { status: 'ACTIVE', startedAtServer: { lt: end, gt: stuckBefore } });
    if (q.status === 'LEFT_RUNNING') Object.assign(where, { status: 'ACTIVE', startedAtServer: { lte: stuckBefore } });
    if (q.status === 'COMPLETED') where.status = 'COMPLETED';
    if (q.status === 'CLOSED') where.status = 'INCOMPLETE';

    const [rows, total] = await Promise.all([
      this.prisma.workSession.findMany({
        where,
        include: { employee: { select: { name: true } } },
        orderBy: { startedAtServer: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.workSession.count({ where }),
    ]);
    const stats = await this.prisma.locationPoint.groupBy({
      by: ['sessionId'],
      where: { sessionId: { in: rows.map((r) => r.id) } },
      _count: { _all: true },
      _max: { capturedAt: true },
    });
    const by = new Map(stats.map((s) => [s.sessionId, s]));
    return {
      timezone: company.timezone,
      items: rows.map((r) => ({
        ...toAdminSession(r, by.get(r.id)?._count._all ?? 0, by.get(r.id)?._max.capturedAt ?? null, now),
        employeeId: r.employeeId,
        employeeName: r.employee.name,
      })),
      page: q.page,
      pageSize: q.pageSize,
      total,
    };
  }
}
