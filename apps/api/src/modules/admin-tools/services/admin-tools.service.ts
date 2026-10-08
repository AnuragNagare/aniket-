import { Injectable } from '@nestjs/common';
import { AppError } from '../../../common/errors/app-error.js';
import { AuditService } from '../../../common/audit/audit.service.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { PasswordResetService } from '../../auth/services/password-reset.service.js';
import { UserStatusCache } from '../../auth/services/user-status-cache.service.js';
import type { AuthContext } from '../../auth/types/auth-context.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class AdminToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly passwordResetService: PasswordResetService,
    private readonly userStatusCache: UserStatusCache,
  ) {}

  async deactivate(auth: AuthContext, employeeId: string) {
    if (!UUID.test(employeeId)) {
      throw new AppError(404, 'NOT_FOUND', 'Employee not found.');
    }

    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId: auth.companyId, deletedAt: null },
      include: { user: true },
    });
    if (!employee) {
      throw new AppError(404, 'NOT_FOUND', 'Employee not found.');
    }

    if (!employee.userId || !employee.user) {
      throw new AppError(
        409,
        'NOT_JOINED',
        "This person hasn't joined yet. Revoke the invitation instead.",
      );
    }

    if (employee.user.status === 'DISABLED') {
      throw new AppError(409, 'ALREADY_DEACTIVATED', 'This employee is already deactivated.');
    }

    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      // 1. Mark user DISABLED
      await tx.user.update({
        where: { id: employee.userId! },
        data: { status: 'DISABLED' },
      });

      // 2. Revoke refresh tokens
      await tx.refreshToken.updateMany({
        where: { userId: employee.userId!, revokedAt: null },
        data: { revokedAt: now },
      });

      // 3. End any active session as INCOMPLETE
      const activeSessions = await tx.workSession.findMany({
        where: { employeeId: employee.id, status: 'ACTIVE' },
      });

      for (const session of activeSessions) {
        const totalMinutes = Math.max(
          1,
          Math.round((now.getTime() - session.startedAtServer.getTime()) / 60000),
        );
        await tx.workSession.update({
          where: { id: session.id },
          data: {
            status: 'INCOMPLETE',
            endedAtServer: now,
            totalMinutes,
          },
        });

        await this.audit.record(
          {
            companyId: auth.companyId,
            actorUserId: auth.userId,
            action: 'session.closed_by_admin',
            entityType: 'session',
            entityId: session.id,
            metadata: { reason: 'employee_deactivated' },
          },
          tx,
        );
      }

      await this.audit.record(
        {
          companyId: auth.companyId,
          actorUserId: auth.userId,
          action: 'employee.deactivated',
          entityType: 'employee',
          entityId: employee.id,
        },
        tx,
      );
    });

    this.userStatusCache.invalidate(employee.userId);

    return { ok: true, status: 'DISABLED' };
  }

  async reactivate(auth: AuthContext, employeeId: string) {
    if (!UUID.test(employeeId)) {
      throw new AppError(404, 'NOT_FOUND', 'Employee not found.');
    }

    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId: auth.companyId, deletedAt: null },
      include: { user: true },
    });
    if (!employee) {
      throw new AppError(404, 'NOT_FOUND', 'Employee not found.');
    }

    if (!employee.userId || !employee.user) {
      throw new AppError(
        409,
        'NOT_JOINED',
        "This person hasn't joined yet. Revoke the invitation instead.",
      );
    }

    if (employee.user.status === 'ACTIVE') {
      throw new AppError(409, 'ALREADY_ACTIVE', 'This employee is already active.');
    }

    await this.prisma.user.update({
      where: { id: employee.userId },
      data: { status: 'ACTIVE' },
    });

    this.userStatusCache.invalidate(employee.userId);

    await this.audit.record({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      action: 'employee.reactivated',
      entityType: 'employee',
      entityId: employee.id,
    });

    return { ok: true, status: 'ACTIVE' };
  }

  async passwordReset(auth: AuthContext, employeeId: string) {
    if (!UUID.test(employeeId)) {
      throw new AppError(404, 'NOT_FOUND', 'Employee not found.');
    }

    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId: auth.companyId, deletedAt: null },
      include: { user: true },
    });
    if (!employee) {
      throw new AppError(404, 'NOT_FOUND', 'Employee not found.');
    }

    const email = employee.user?.email ?? employee.email;
    if (!email) {
      throw new AppError(409, 'NO_EMAIL', 'This employee has no email address.');
    }

    await this.passwordResetService.request(email);

    await this.audit.record({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      action: 'employee.password_reset_sent',
      entityType: 'employee',
      entityId: employee.id,
    });

    return { ok: true };
  }
}
