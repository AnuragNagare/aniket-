import { Inject, Injectable, Logger } from '@nestjs/common';
import { ZipArchive } from 'archiver';
import { addDays } from 'date-fns';
import type { DataExportDto } from '@worktrail/types';
import { AppError } from '../../../common/errors/app-error.js';
import { AuditService } from '../../../common/audit/audit.service.js';
import { FILE_STORAGE, type FileStorage } from '../../../common/storage/file-storage.js';
import { JOB_QUEUE, type JobQueue } from '../../../common/queue/job-queue.js';
import { PrismaService } from '../../../database/prisma.service.js';
import type { AuthContext } from '../../auth/types/auth-context.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '';
  let str = String(val);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const toDto = (r: any, employeeName?: string): DataExportDto => ({
  id: r.id,
  companyId: r.companyId,
  employeeId: r.employeeId,
  employeeName,
  status: r.status,
  byteSize: r.byteSize,
  createdAt: r.createdAt.toISOString(),
  generatedAt: r.generatedAt ? r.generatedAt.toISOString() : null,
  expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
});

@Injectable()
export class ExportsService {
  private readonly log = new Logger(ExportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(JOB_QUEUE) private readonly jobQueue: JobQueue,
  ) {}

  async requestExport(auth: AuthContext, employeeId: string): Promise<DataExportDto> {
    if (!UUID.test(employeeId)) {
      throw new AppError(404, 'NOT_FOUND', 'Employee not found.');
    }

    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId: auth.companyId, deletedAt: null },
    });
    if (!employee) {
      throw new AppError(404, 'NOT_FOUND', 'Employee not found.');
    }

    const exportRow = await this.prisma.dataExport.create({
      data: {
        companyId: auth.companyId,
        employeeId: employee.id,
        requestedByUserId: auth.userId,
        status: 'QUEUED',
      },
    });

    const storageKey = `${auth.companyId}/${exportRow.id}.zip`;
    await this.prisma.dataExport.update({
      where: { id: exportRow.id },
      data: { storageKey },
    });

    await this.jobQueue.add('privacy.export', {
      exportId: exportRow.id,
      companyId: auth.companyId,
      employeeId: employee.id,
    });

    await this.audit.record({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      action: 'export.requested',
      entityType: 'export',
      entityId: exportRow.id,
    });

    return toDto(exportRow, employee.name);
  }

  async getExport(auth: AuthContext, exportId: string): Promise<DataExportDto> {
    if (!UUID.test(exportId)) {
      throw new AppError(404, 'NOT_FOUND', 'Export not found.');
    }

    const row = await this.prisma.dataExport.findFirst({
      where: { id: exportId, companyId: auth.companyId },
    });
    if (!row) {
      throw new AppError(404, 'NOT_FOUND', 'Export not found.');
    }

    const emp = await this.prisma.employee.findUnique({
      where: { id: row.employeeId },
      select: { name: true },
    });

    return toDto(row, emp?.name);
  }

  async download(auth: AuthContext, exportId: string) {
    if (!UUID.test(exportId)) {
      throw new AppError(404, 'NOT_FOUND', 'Export not found.');
    }

    const row = await this.prisma.dataExport.findFirst({
      where: { id: exportId, companyId: auth.companyId },
    });
    if (!row) {
      throw new AppError(404, 'NOT_FOUND', 'Export not found.');
    }

    if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
      throw new AppError(410, 'EXPORT_EXPIRED', 'This data export has expired. Request a new export.');
    }

    if (row.status !== 'READY' || !row.storageKey) {
      throw new AppError(404, 'NOT_READY', 'Export is not ready for download yet.');
    }

    const stream = await this.storage.stream(row.storageKey);

    await this.audit.record({
      companyId: auth.companyId,
      actorUserId: auth.userId,
      action: 'export.downloaded',
      entityType: 'export',
      entityId: row.id,
      metadata: { byteSize: row.byteSize ?? 0 },
    });

    return {
      stream,
      filename: `worktrail-export-${row.id}.zip`,
      size: row.byteSize ?? 0,
    };
  }

  async runExportJob(data: { exportId: string; companyId: string; employeeId: string }) {
    const row = await this.prisma.dataExport.findUnique({ where: { id: data.exportId } });
    if (!row) return;

    await this.prisma.dataExport.update({
      where: { id: row.id },
      data: { status: 'GENERATING' },
    });

    try {
      const employee = await this.prisma.employee.findUniqueOrThrow({
        where: { id: data.employeeId },
      });

      // 1. Sessions CSV
      const sessions = await this.prisma.workSession.findMany({
        where: { employeeId: data.employeeId },
        orderBy: { startedAtServer: 'asc' },
      });
      let sessionsCsv = 'id,started_at,ended_at,status,total_minutes\n';
      for (const s of sessions) {
        sessionsCsv += [
          s.id,
          s.startedAtServer.toISOString(),
          s.endedAtServer ? s.endedAtServer.toISOString() : '',
          s.status,
          s.totalMinutes !== null ? s.totalMinutes : '',
        ].map(escapeCsv).join(',') + '\n';
      }

      // 2. Locations CSV (stream / paged in chunks of 5000)
      let locationsCsv = 'captured_at,latitude,longitude,accuracy,source,battery\n';
      let locCursor: string | undefined;
      let totalLocations = 0;
      for (;;) {
        const batch = await this.prisma.locationPoint.findMany({
          where: { employeeId: data.employeeId },
          orderBy: { id: 'asc' },
          take: 5000,
          skip: locCursor ? 1 : 0,
          cursor: locCursor ? { id: locCursor } : undefined,
        });
        if (batch.length === 0) break;
        totalLocations += batch.length;
        for (const pt of batch) {
          locationsCsv += [
            pt.capturedAt.toISOString(),
            pt.latitude.toString(),
            pt.longitude.toString(),
            pt.accuracyMeters !== null ? pt.accuracyMeters.toString() : '',
            pt.source,
            pt.batteryLevel !== null ? pt.batteryLevel.toString() : '',
          ].map(escapeCsv).join(',') + '\n';
        }
        locCursor = batch[batch.length - 1]!.id;
        if (batch.length < 5000) break;
      }

      // 3. Updates CSV
      const updates = await this.prisma.workUpdate.findMany({
        where: { employeeId: data.employeeId },
        orderBy: { submittedAt: 'asc' },
      });
      let updatesCsv = 'submitted_at,text,category,input_method\n';
      for (const u of updates) {
        updatesCsv += [
          u.submittedAt.toISOString(),
          u.text,
          u.category ?? '',
          u.inputMethod,
        ].map(escapeCsv).join(',') + '\n';
      }

      // 4. README.txt
      const readme = [
        'Work Trail Employee Data Export',
        '================================',
        `Employee Name: ${employee.name}`,
        `Employee Email: ${employee.email ?? 'None'}`,
        `Export Generated: ${new Date().toISOString()}`,
        '',
        'Files included:',
        `- sessions.csv: ${sessions.length} sessions`,
        `- locations.csv: ${totalLocations} precise locations`,
        `- updates.csv: ${updates.length} updates`,
      ].join('\n');

      // Create ZIP buffer using archiver
      const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
        const archive = new ZipArchive({ zlib: { level: 9 } });
        const chunks: Buffer[] = [];
        archive.on('data', (c: Buffer) => chunks.push(c));
        archive.on('end', () => resolve(Buffer.concat(chunks)));
        archive.on('error', (e: Error) => reject(e));

        archive.append(sessionsCsv, { name: 'sessions.csv' });
        archive.append(locationsCsv, { name: 'locations.csv' });
        archive.append(updatesCsv, { name: 'updates.csv' });
        archive.append(readme, { name: 'README.txt' });

        archive.finalize().catch(reject);
      });

      const storageKey = row.storageKey || `${data.companyId}/${row.id}.zip`;
      await this.storage.put(storageKey, zipBuffer);

      const now = new Date();
      await this.prisma.dataExport.update({
        where: { id: row.id },
        data: {
          status: 'READY',
          storageKey,
          byteSize: zipBuffer.length,
          generatedAt: now,
          expiresAt: addDays(now, 7),
        },
      });
    } catch (err: any) {
      this.log.error(`Export job ${data.exportId} failed: ${err.message}`, err.stack);
      await this.prisma.dataExport.update({
        where: { id: row.id },
        data: {
          status: 'FAILED',
          failureReason: err.message ?? 'Generation failed',
        },
      });
    }
  }
}
