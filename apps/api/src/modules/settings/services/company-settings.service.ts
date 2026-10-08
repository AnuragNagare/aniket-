import { Injectable } from '@nestjs/common';
import type { CompanyDto, UpdateCompanyInput } from '@worktrail/types';
import { PrismaService } from '../../../database/prisma.service.js';
import { AuditService } from '../../../common/audit/audit.service.js';
import type { AuthContext } from '../../auth/types/auth-context.js';

@Injectable()
export class CompanySettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async get(auth: AuthContext): Promise<CompanyDto> {
    const c = await this.prisma.company.findUniqueOrThrow({
      where: { id: auth.companyId },
    });
    return {
      id: c.id,
      name: c.name,
      timezone: c.timezone,
      preciseLocationRetentionDays: c.preciseLocationRetentionDays,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  async update(auth: AuthContext, input: UpdateCompanyInput): Promise<CompanyDto> {
    const existing = await this.prisma.company.findUniqueOrThrow({
      where: { id: auth.companyId },
    });

    if (
      input.preciseLocationRetentionDays !== undefined &&
      input.preciseLocationRetentionDays !== existing.preciseLocationRetentionDays
    ) {
      await this.audit.record({
        companyId: auth.companyId,
        actorUserId: auth.userId,
        action: 'retention.updated',
        entityType: 'company',
        entityId: auth.companyId,
        metadata: {
          from: existing.preciseLocationRetentionDays,
          to: input.preciseLocationRetentionDays,
        },
      });
    }

    const changedFields: string[] = [];
    if (input.name !== undefined && input.name !== existing.name) changedFields.push('name');
    if (input.timezone !== undefined && input.timezone !== existing.timezone) changedFields.push('timezone');

    if (changedFields.length > 0) {
      await this.audit.record({
        companyId: auth.companyId,
        actorUserId: auth.userId,
        action: 'company.updated',
        entityType: 'company',
        entityId: auth.companyId,
        metadata: {
          changed: changedFields,
        },
      });
    }

    const updated = await this.prisma.company.update({
      where: { id: auth.companyId },
      data: {
        name: input.name ?? undefined,
        timezone: input.timezone ?? undefined,
        preciseLocationRetentionDays: input.preciseLocationRetentionDays ?? undefined,
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      timezone: updated.timezone,
      preciseLocationRetentionDays: updated.preciseLocationRetentionDays,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}
