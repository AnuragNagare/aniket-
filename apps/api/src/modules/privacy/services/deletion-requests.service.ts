import { Injectable } from '@nestjs/common';
import type {
  DeletionRequestDto,
  DeletionRequestInput,
  DismissDeletionRequestInput,
} from '@worktrail/types';
import { AppError } from '../../../common/errors/app-error.js';
import { AuditService } from '../../../common/audit/audit.service.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { AuthContext } from '../../auth/types/auth-context.js';

const toDto = (r: any, employeeName?: string): DeletionRequestDto => ({
  id: r.id,
  companyId: r.companyId,
  employeeId: r.employeeId,
  employeeName,
  reason: r.reason,
  status: r.status,
  resolvedBy: r.resolvedBy,
  resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
  note: r.note,
  createdAt: r.createdAt.toISOString(),
});

@Injectable()
export class DeletionRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(auth: AuthContext, input: DeletionRequestInput): Promise<{ request: DeletionRequestDto; created: boolean }> {
    const employee = await this.prisma.employee.findFirst({
      where: { userId: auth.userId, companyId: auth.companyId, deletedAt: null },
    });
    if (!employee) {
      throw new AppError(404, 'NOT_FOUND', 'Employee record not found.');
    }

    const openRequest = await this.prisma.deletionRequest.findFirst({
      where: { employeeId: employee.id, status: 'OPEN' },
    });
    if (openRequest) {
      return { request: toDto(openRequest, employee.name), created: false };
    }

    const created = await this.prisma.deletionRequest.create({
      data: {
        companyId: auth.companyId,
        employeeId: employee.id,
        reason: input.reason,
        status: 'OPEN',
      },
    });

    await this.audit.record({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      action: 'deletion.requested',
      entityType: 'deletion_request',
      entityId: created.id,
    });

    return { request: toDto(created, employee.name), created: true };
  }

  async list(auth: AuthContext): Promise<DeletionRequestDto[]> {
    const rows = await this.prisma.deletionRequest.findMany({
      where: { companyId: auth.companyId },
      orderBy: { createdAt: 'desc' },
    });

    const employeeIds = [...new Set(rows.map((r) => r.employeeId))];
    const employees = employeeIds.length > 0
      ? await this.prisma.employee.findMany({
          where: { id: { in: employeeIds } },
          select: { id: true, name: true },
        })
      : [];
    const empMap = new Map(employees.map((e) => [e.id, e.name]));

    return rows.map((r) => toDto(r, empMap.get(r.employeeId)));
  }

  async dismiss(
    auth: AuthContext,
    id: string,
    input: DismissDeletionRequestInput,
  ): Promise<DeletionRequestDto> {
    const req = await this.prisma.deletionRequest.findFirst({
      where: { id, companyId: auth.companyId },
    });
    if (!req) {
      throw new AppError(404, 'NOT_FOUND', 'Deletion request not found.');
    }

    const updated = await this.prisma.deletionRequest.update({
      where: { id },
      data: {
        status: 'DISMISSED',
        resolvedBy: auth.userId,
        resolvedAt: new Date(),
        note: input.note,
      },
    });

    await this.audit.record({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      action: 'deletion.dismissed',
      entityType: 'deletion_request',
      entityId: updated.id,
      metadata: { note: input.note },
    });

    const emp = await this.prisma.employee.findUnique({
      where: { id: updated.employeeId },
      select: { name: true },
    });

    return toDto(updated, emp?.name);
  }
}
