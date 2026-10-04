import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service.js';

export type AuditAction =
  | 'invitation.created'
  | 'invitation.resent'
  | 'invitation.accepted'
  | 'password.reset';

export type AuditEntry = {
  companyId: string;
  actorUserId?: string | null;
  action: AuditAction;
  entityType: 'invitation' | 'user';
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

type Db = PrismaService | Prisma.TransactionClient;

/** Append-only record of sensitive actions (data-model.pdf → audit_logs). */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Pass the transaction client so the audit row commits or rolls back with the change. */
  async record(entry: AuditEntry, db: Db = this.prisma): Promise<void> {
    await db.auditLog.create({
      data: {
        companyId: entry.companyId,
        actorUserId: entry.actorUserId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        metadata: entry.metadata,
      },
    });
  }
}
