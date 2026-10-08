import { Injectable } from '@nestjs/common';
import {
  AUDIT_ACTION_LABELS,
  type AuditAction,
  type AuditLogItem,
  type AuditLogQuery,
  type AuditLogsResponse,
} from '@worktrail/types';
import { PrismaService } from '../../../database/prisma.service.js';
import type { AuthContext } from '../../auth/types/auth-context.js';

const WHITELISTED_METADATA_KEYS = new Set([
  'from',
  'to',
  'deleted',
  'byteSize',
  'format',
  'reason',
  'cutoff',
  'status',
]);

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(auth: AuthContext, query: AuditLogQuery): Promise<AuditLogsResponse> {
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 25));
    const skip = (page - 1) * pageSize;

    const where: any = {
      companyId: auth.companyId,
    };

    if (query.action) {
      where.action = query.action;
    }

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) {
        where.createdAt.gte = new Date(query.from);
      }
      if (query.to) {
        where.createdAt.lte = new Date(query.to);
      }
    }

    const [total, rows] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
    ]);

    // Batch resolve actor names
    const actorUserIds = [...new Set(rows.map((r) => r.actorUserId).filter((id): id is string => Boolean(id)))];
    const users = actorUserIds.length > 0
      ? await this.prisma.user.findMany({
          where: { id: { in: actorUserIds } },
          select: { id: true, name: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    // Batch resolve employee names
    const employeeIds = [
      ...new Set(
        rows
          .filter((r) => r.entityType === 'employee' && r.entityId)
          .map((r) => r.entityId as string),
      ),
    ];
    const employees = employeeIds.length > 0
      ? await this.prisma.employee.findMany({
          where: { id: { in: employeeIds } },
          select: { id: true, name: true },
        })
      : [];
    const employeeMap = new Map(employees.map((e) => [e.id, e.name]));

    // Batch resolve report names
    const reportIds = [
      ...new Set(
        rows
          .filter((r) => r.entityType === 'report' && r.entityId)
          .map((r) => r.entityId as string),
      ),
    ];
    const reports = reportIds.length > 0
      ? await this.prisma.report.findMany({
          where: { id: { in: reportIds } },
          select: { id: true, employee: { select: { name: true } } },
        })
      : [];
    const reportMap = new Map(
      reports.map((r) => [r.id, `${r.employee.name} report`]),
    );

    // Batch resolve invitation names
    const invitationIds = [
      ...new Set(
        rows
          .filter((r) => r.entityType === 'invitation' && r.entityId)
          .map((r) => r.entityId as string),
      ),
    ];
    const invitations = invitationIds.length > 0
      ? await this.prisma.invitation.findMany({
          where: { id: { in: invitationIds } },
          select: { id: true, employee: { select: { name: true } } },
        })
      : [];
    const invitationMap = new Map(
      invitations.map((inv) => [inv.id, inv.employee.name]),
    );

    const items: AuditLogItem[] = rows.map((r) => {
      let entityName: string | null = null;
      if (r.entityType === 'employee' && r.entityId) {
        entityName = employeeMap.get(r.entityId) ?? null;
      } else if (r.entityType === 'report' && r.entityId) {
        entityName = reportMap.get(r.entityId) ?? null;
      } else if (r.entityType === 'invitation' && r.entityId) {
        entityName = invitationMap.get(r.entityId) ?? null;
      }


      // Filter details strictly to whitelisted keys with primitive string/number values
      const details: Record<string, string | number> = {};
      if (r.metadata && typeof r.metadata === 'object' && !Array.isArray(r.metadata)) {
        for (const [k, v] of Object.entries(r.metadata as Record<string, unknown>)) {
          if (WHITELISTED_METADATA_KEYS.has(k) && (typeof v === 'string' || typeof v === 'number')) {
            details[k] = v;
          }
        }
      }

      const action = r.action as AuditAction;
      const label = AUDIT_ACTION_LABELS[action] ?? r.action;
      const actorName = r.actorUserId ? userMap.get(r.actorUserId) ?? null : null;

      return {
        id: r.id,
        action,
        label,
        actorName,
        entityType: r.entityType,
        entityName,
        createdAt: r.createdAt.toISOString(),
        ip: r.ip,
        details,
      };
    });

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }
}
