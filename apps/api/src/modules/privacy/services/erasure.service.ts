import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { EraseEmployeeInput } from '@worktrail/types';
import { AppError } from '../../../common/errors/app-error.js';
import { AuditService } from '../../../common/audit/audit.service.js';
import { FILE_STORAGE, type FileStorage } from '../../../common/storage/file-storage.js';
import { JOB_QUEUE, type JobQueue } from '../../../common/queue/job-queue.js';
import { PrismaService } from '../../../database/prisma.service.js';
import { UserStatusCache } from '../../auth/services/user-status-cache.service.js';
import type { AuthContext } from '../../auth/types/auth-context.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BATCH = 5000;

@Injectable()
export class ErasureService {
  private readonly log = new Logger(ErasureService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(JOB_QUEUE) private readonly jobQueue: JobQueue,
    private readonly userStatusCache: UserStatusCache,
  ) {}

  async requestErasure(
    auth: AuthContext,
    employeeId: string,
    input: EraseEmployeeInput,
  ): Promise<{ message: string }> {
    if (!UUID.test(employeeId)) {
      throw new AppError(404, 'NOT_FOUND', 'Employee not found.');
    }

    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId: auth.companyId, deletedAt: null },
    });
    if (!employee) {
      throw new AppError(404, 'NOT_FOUND', 'Employee not found.');
    }

    if (input.confirmName !== employee.name) {
      throw new AppError(400, 'CONFIRMATION_MISMATCH', "Type the employee's name exactly to confirm.");
    }

    await this.audit.record({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      action: 'employee.erased',
      entityType: 'employee',
      entityId: employee.id,
      metadata: { requested: true },
    });

    await this.jobQueue.add('privacy.erase', {
      employeeId: employee.id,
      companyId: auth.companyId,
    });

    return { message: 'Erasure scheduled.' };
  }

  async erase(employeeId: string, companyId: string): Promise<void> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { user: true },
    });
    if (!employee) return;

    const counts: Record<string, number> = {
      sessions: 0,
      points: 0,
      updates: 0,
      summaries: 0,
      reports: 0,
      exports: 0,
    };

    // 1. Deactivate user and active sessions
    if (employee.userId) {
      await this.prisma.user.updateMany({
        where: { id: employee.userId },
        data: { status: 'DISABLED' },
      });
      await this.prisma.refreshToken.updateMany({
        where: { userId: employee.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      this.userStatusCache.invalidate(employee.userId);
    }

    const now = new Date();
    await this.prisma.workSession.updateMany({
      where: { employeeId: employee.id, status: 'ACTIVE' },
      data: { status: 'INCOMPLETE', endedAtServer: now },
    });

    // 2. Storage cleanup and database deletion for reports and exports
    const reports = await this.prisma.report.findMany({
      where: { employeeId: employee.id },
      select: { id: true, storageKey: true },
    });
    for (const r of reports) {
      if (r.storageKey) {
        await this.storage.remove(r.storageKey).catch(() => undefined);
      }
    }
    const delReports = await this.prisma.report.deleteMany({
      where: { employeeId: employee.id },
    });
    counts.reports = delReports.count;

    const exports = await this.prisma.dataExport.findMany({
      where: { employeeId: employee.id },
      select: { id: true, storageKey: true },
    });
    for (const exp of exports) {
      if (exp.storageKey) {
        await this.storage.remove(exp.storageKey).catch(() => undefined);
      }
    }
    const delExports = await this.prisma.dataExport.deleteMany({
      where: { employeeId: employee.id },
    });
    counts.exports = delExports.count;

    // 3. Batched deletion of location points
    let pointsDeleted = 0;
    for (;;) {
      const n = await this.prisma.$executeRaw`
        DELETE FROM location_points WHERE id IN (
          SELECT id FROM location_points WHERE employee_id = ${employee.id}::uuid
          LIMIT ${BATCH})`;
      pointsDeleted += n;
      if (n < BATCH) break;
    }
    counts.points = pointsDeleted;

    // Delete generated_summaries, updates, sessions
    const delSummaries = await this.prisma.generatedSummary.deleteMany({
      where: { employeeId: employee.id },
    });
    counts.summaries = delSummaries.count;

    const delUpdates = await this.prisma.workUpdate.deleteMany({
      where: { employeeId: employee.id },
    });
    counts.updates = delUpdates.count;

    const delSessions = await this.prisma.workSession.deleteMany({
      where: { employeeId: employee.id },
    });
    counts.sessions = delSessions.count;

    // 4. Delete consent records and invitations
    await this.prisma.consentRecord.deleteMany({
      where: { employeeId: employee.id },
    });
    await this.prisma.invitation.deleteMany({
      where: { employeeId: employee.id },
    });

    // 5. Anonymise employee and user
    await this.prisma.employee.update({
      where: { id: employee.id },
      data: {
        name: 'Deleted employee',
        email: null,
        phone: null,
        employeeCode: null,
        designation: null,
        deletedAt: now,
      },
    });

    if (employee.userId) {
      const unusableHash = `$argon2id$v=19$m=65536,t=3,p=4$${randomBytes(32).toString('base64')}`;
      await this.prisma.user.update({
        where: { id: employee.userId },
        data: {
          name: 'Deleted employee',
          email: `deleted+${employee.userId}@invalid`,
          phone: null,
          passwordHash: unusableHash,
          status: 'DISABLED',
        },
      });
    }

    // 6. Mark open deletion requests as DONE
    await this.prisma.deletionRequest.updateMany({
      where: { employeeId: employee.id, status: 'OPEN' },
      data: { status: 'DONE', resolvedAt: now },
    });

    // 7. Write final employee.erased audit row
    await this.audit.record({
      companyId,
      action: 'employee.erased',
      entityType: 'employee',
      entityId: employee.id,
      metadata: { completed: true, counts },
    });
  }
}
