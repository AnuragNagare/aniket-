import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';
import { getRequestContext } from '../context/request-context.js';

export type AuditAction =
  | 'invitation.created'
  | 'invitation.resent'
  | 'invitation.accepted'
  | 'password.reset'
  | 'session.closed_by_admin'
  | 'summary.requested'
  | 'report.requested'
  | 'report.downloaded'
  | 'admin.signed_in'
  | 'company.updated'
  | 'retention.updated'
  | 'retention.purged'
  | 'consent.recorded'
  | 'deletion.requested'
  | 'deletion.dismissed'
  | 'employee.deactivated'
  | 'employee.reactivated'
  | 'employee.password_reset_sent'
  | 'employee.erased'
  | 'export.requested'
  | 'export.downloaded'
  | 'company.erased';

export type AuditEntityType =
  | 'invitation'
  | 'user'
  | 'session'
  | 'summary'
  | 'report'
  | 'company'
  | 'employee'
  | 'export'
  | 'deletion_request';

export type AuditEntry = {
  companyId: string;
  actorUserId?: string | null;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ip?: string | null;
  userAgent?: string | null;
};

type Db = PrismaService | Prisma.TransactionClient;

/** Append-only record of sensitive actions (data-model.pdf → audit_logs). */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Pass the transaction client so the audit row commits or rolls back with the change. */
  async record(entry: AuditEntry, db: Db = this.prisma): Promise<void> {
    const ctx = getRequestContext();
    const ip = entry.ip !== undefined ? entry.ip : (ctx?.ip ?? null);
    const userAgent = entry.userAgent !== undefined ? entry.userAgent : (ctx?.userAgent ?? null);

    await db.auditLog.create({
      data: {
        companyId: entry.companyId,
        actorUserId: entry.actorUserId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata,
        ip,
        userAgent,
      },
    });
  }
}
