import { Injectable } from '@nestjs/common';
import type { AdminSessionDto, CloseSessionInput } from '@worktrail/types';
import { AuditService } from '../../../common/audit/audit.service.js';
import { AppError } from '../../../common/errors/app-error.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { AuthContext } from '../../auth/types/auth-context.js';
import { toAdminSession } from './activity.service.js';
import { EmployeeAccessService } from './employee-access.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An admin ends a session the employee forgot to end. Recorded as INCOMPLETE and audited. */
@Injectable()
export class CloseSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: EmployeeAccessService,
    private readonly audit: AuditService,
  ) {}

  async close(auth: AuthContext, employeeId: string, sessionId: string, input: CloseSessionInput): Promise<AdminSessionDto> {
    const employee = await this.access.find(auth.companyId, employeeId);
    const notFound = new AppError(404, 'NOT_FOUND', 'Work session not found.');
    if (!UUID.test(sessionId)) throw notFound;
    const session = await this.prisma.workSession.findFirst({ where: { id: sessionId, employeeId: employee.id } });
    if (!session) throw notFound;

    const now = new Date();
    const endedAt = new Date(input.endedAt);
    if (endedAt < session.startedAtServer || endedAt > now) {
      throw new AppError(400, 'INVALID_END_TIME', 'Choose an end time between the start of the session and now.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.workSession.updateMany({
        where: { id: session.id, status: 'ACTIVE' },
        data: {
          status: 'INCOMPLETE',
          endedAtServer: endedAt,
          totalMinutes: Math.round((endedAt.getTime() - session.startedAtServer.getTime()) / 60_000),
        },
      });
      if (claimed.count === 0) throw new AppError(409, 'SESSION_NOT_ACTIVE', 'This work session has already ended.');
      await this.audit.record(
        {
          companyId: auth.companyId,
          actorUserId: auth.userId,
          action: 'session.closed_by_admin',
          entityType: 'session',
          entityId: session.id,
          metadata: { endedAt: endedAt.toISOString() },
        },
        tx,
      );
      return tx.workSession.findUniqueOrThrow({ where: { id: session.id } });
    });

    const stats = await this.prisma.locationPoint.aggregate({ where: { sessionId: session.id }, _count: { _all: true }, _max: { capturedAt: true } });
    return toAdminSession(updated, stats._count._all, stats._max.capturedAt, now);
  }
}
