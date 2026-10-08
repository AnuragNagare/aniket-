import { Injectable } from '@nestjs/common';
import { PRIVACY_NOTICE_VERSION, type ConsentInput, type ConsentDto } from '@worktrail/types';
import { AppError } from '../../../common/errors/app-error.js';
import { AuditService } from '../../../common/audit/audit.service.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { AuthContext } from '../../auth/types/auth-context.js';

@Injectable()
export class ConsentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  currentVersion(): string {
    return process.env.PRIVACY_NOTICE_VERSION_OVERRIDE || PRIVACY_NOTICE_VERSION;
  }

  async current(employeeId: string) {
    return this.prisma.consentRecord.findUnique({
      where: {
        employeeId_version: {
          employeeId,
          version: this.currentVersion(),
        },
      },
    });
  }

  async require(employeeId: string): Promise<void> {
    const existing = await this.current(employeeId);
    if (!existing) {
      throw new AppError(
        409,
        'CONSENT_REQUIRED',
        'Please read and accept the privacy notice first.',
      );
    }
  }

  async record(auth: AuthContext, input: ConsentInput): Promise<ConsentDto> {
    const activeVersion = this.currentVersion();
    if (input.version !== activeVersion) {
      throw new AppError(
        400,
        'INVALID_VERSION',
        'Please reload the notice and try again.',
      );
    }

    const employee = await this.prisma.employee.findFirst({
      where: { userId: auth.userId, companyId: auth.companyId },
    });
    if (!employee) {
      throw new AppError(403, 'FORBIDDEN', 'No employee profile linked to this account.');
    }

    const existing = await this.prisma.consentRecord.findUnique({
      where: {
        employeeId_version: {
          employeeId: employee.id,
          version: input.version,
        },
      },
    });

    if (existing) {
      return {
        version: existing.version,
        acceptedAt: existing.acceptedAt.toISOString(),
      };
    }

    const record = await this.prisma.consentRecord.create({
      data: {
        companyId: auth.companyId,
        employeeId: employee.id,
        version: input.version,
        appVersion: input.appVersion ?? null,
        deviceModel: input.deviceModel ?? null,
      },
    });

    await this.audit.record({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      action: 'consent.recorded',
      entityType: 'employee',
      entityId: employee.id,
      metadata: {
        version: input.version,
        appVersion: input.appVersion ?? null,
        deviceModel: input.deviceModel ?? null,
      },
    });

    return {
      version: record.version,
      acceptedAt: record.acceptedAt.toISOString(),
    };
  }
}
